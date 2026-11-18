const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { z } = require('zod');
const Category = require('../models/Category');
const Claim = require('../models/Claim');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadReceipt } = require('../services/cloudinaryService');
const { sendStatusChangeEmail } = require('../services/emailService');
const { canReviewClaim, getNextStatus } = require('../domain/claimWorkflow');
const {
  maxReceiptSize,
  isSupportedReceiptType,
  validateReceiptFile
} = require('../domain/receiptValidation');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxReceiptSize, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!isSupportedReceiptType(file.mimetype)) {
      return callback(new Error('Receipt must be a JPEG, PNG, WebP image, or PDF.'));
    }
    return callback(null, true);
  }
});

const submitSchema = z.object({
  category: z.string().refine(mongoose.isValidObjectId, 'Select a valid category.'),
  amount: z.coerce.number().positive(),
  date: z.coerce.date(),
  note: z.string().trim().max(500).optional().default(''),
  receiptUrl: z.string().url(),
  receiptPublicId: z.string().min(1)
});

const decisionSchema = z.object({
  action: z.enum(['approve', 'reject', 'paid']),
  comment: z.string().trim().max(500).optional().default(''),
  reason: z.string().trim().max(500).optional().default('')
});

function claimAccessFilter(user) {
  if (user.role === 'Employee') {
    return { employee: user.id };
  }
  return {};
}

function populateClaim(query) {
  return query
    .populate('employee', 'name email department')
    .populate('category', 'name limitPerClaim')
    .populate('history.by', 'name role');
}

router.use(protect);

router.post('/receipt', authorize('Employee'), upload.single('receipt'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Choose a receipt image or PDF to upload.' });
  }
  const validation = validateReceiptFile(req.file);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    const receipt = await uploadReceipt(req.file, req.user.id);
    return res.status(201).json(receipt);
  } catch (error) {
    console.error('Receipt upload failed:', error);
    return res.status(503).json({ message: error.message || 'Receipt storage is unavailable.' });
  }
});

router.post('/', authorize('Employee'), async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  try {
    const data = parsed.data;
    const category = await Category.findOne({ _id: data.category, isActive: true });
    if (!category) {
      return res.status(400).json({ message: 'Select an active category.' });
    }
    const receiptHost = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;
    if (!process.env.CLOUDINARY_CLOUD_NAME || !data.receiptUrl.startsWith(receiptHost)
      || !data.receiptPublicId.startsWith(`expense-claims/${req.user.id}/`)) {
      return res.status(400).json({ message: 'Upload a valid receipt before submitting the claim.' });
    }

    const claim = await Claim.create({
      employee: req.user.id,
      department: req.user.department || 'General',
      category: category._id,
      amount: data.amount,
      date: data.date,
      note: data.note,
      receiptUrl: data.receiptUrl,
      receiptPublicId: data.receiptPublicId,
      limitExceeded: data.amount > category.limitPerClaim,
      history: [{
        action: 'Submitted',
        by: req.user.id,
        byName: req.user.name,
        role: req.user.role,
        comment: 'Claim submitted'
      }]
    });
    const populated = await populateClaim(Claim.findById(claim._id));
    let notification = { sent: true };
    try {
      await sendStatusChangeEmail(populated, 'Submitted', 'Claim submitted');
    } catch (error) {
      notification = { sent: false, message: error.message };
      console.error('Claim submission email failed:', error);
    }
    return res.status(201).json({ claim: populated, notification });
  } catch (error) {
    console.error('Claim submission failed:', error);
    return res.status(500).json({ message: 'Unable to submit the claim.' });
  }
});

router.get('/', authorize('Employee', 'Manager', 'Accounts', 'Admin'), async (req, res) => {
  try {
    const filter = claimAccessFilter(req.user);
    const claims = await populateClaim(Claim.find(filter).sort({ createdAt: -1 }));
    return res.json(claims);
  } catch (error) {
    console.error('Claim list failed:', error);
    return res.status(500).json({ message: 'Unable to load claims.' });
  }
});

router.get('/:id', authorize('Employee', 'Manager', 'Accounts', 'Admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid claim ID.' });
  }
  try {
    const claim = await populateClaim(Claim.findById(req.params.id));
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found.' });
    }
    if (req.user.role === 'Employee' && claim.employee._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You cannot view this claim.' });
    }
    return res.json(claim);
  } catch (error) {
    console.error('Claim detail failed:', error);
    return res.status(500).json({ message: 'Unable to load the claim.' });
  }
});

router.post('/:id/transition', authorize('Manager', 'Accounts'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid claim ID.' });
  }
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  try {
    const claim = await Claim.findById(req.params.id).populate('employee', 'name email department');
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found.' });
    }
    const allowedReviewer = canReviewClaim({
      role: req.user.role,
      actorId: req.user.id,
      employeeId: claim.employee._id.toString()
    });
    if (!allowedReviewer) {
      if (claim.employee._id.toString() === req.user.id) {
        return res.status(403).json({ message: 'You cannot approve or pay your own claim.' });
      }
      return res.status(403).json({ message: 'You cannot review this claim.' });
    }
    const nextStatus = getNextStatus(req.user.role, claim.status, parsed.data.action);
    if (!nextStatus) {
      return res.status(409).json({ message: 'This action is not allowed at the claim’s current stage.' });
    }
    const comment = parsed.data.action === 'reject'
      ? parsed.data.reason || parsed.data.comment
      : parsed.data.comment;
    if (parsed.data.action === 'reject' && comment.length < 3) {
      return res.status(400).json({ message: 'Enter a rejection reason of at least 3 characters.' });
    }

    const updated = await Claim.findOneAndUpdate(
      { _id: claim._id, status: claim.status },
      {
        $set: {
          status: nextStatus,
          rejectReason: nextStatus === 'Rejected' ? comment : ''
        },
        $push: {
          history: {
            action: nextStatus,
            by: req.user.id,
            byName: req.user.name,
            role: req.user.role,
            comment
          }
        }
      },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ message: 'The claim changed while you were reviewing it. Refresh and try again.' });
    }

    const populated = await populateClaim(Claim.findById(updated._id));
    let notification = { sent: true };
    try {
      await sendStatusChangeEmail(populated, nextStatus, comment);
    } catch (error) {
      notification = { sent: false, message: error.message };
      console.error('Claim status email failed:', error);
    }
    return res.json({ claim: populated, notification });
  } catch (error) {
    console.error('Claim transition failed:', error);
    return res.status(500).json({ message: 'Unable to update the claim.' });
  }
});

module.exports = router;
