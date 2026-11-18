const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const Claim = require('../models/Claim');
const { protect, authorize } = require('../middleware/authMiddleware');
const { sendSignupDecisionEmail } = require('../services/emailService');

const router = express.Router();
const roles = ['Employee', 'Manager', 'Accounts', 'Admin'];
const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().transform((email) => email.toLowerCase()).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(roles).optional(),
  department: z.string().trim().min(2).optional(),
  isActive: z.boolean().optional()
});

router.use(protect, authorize('Admin'));

router.get('/users', async (_req, res) => {
  const users = await User.find()
    .select('-password')
    .sort({ name: 1 });
  return res.json(users);
});

router.patch('/users/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'Provide at least one user field to update.' });
  }
  if (data.isActive === false && req.params.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot deactivate your own account.' });
  }

  try {
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const effectiveRole = data.role || existingUser.role;
    const willBeActive = data.isActive === undefined ? existingUser.isActive : data.isActive;
    if (effectiveRole === 'Manager' && willBeActive) {
      const anotherActiveManager = await User.exists({
        _id: { $ne: existingUser._id },
        role: 'Manager',
        isActive: true
      });
      if (anotherActiveManager) {
        return res.status(409).json({ message: 'Only one active Manager can handle all employee claims.' });
      }
    }
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true
    }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }
    console.error('User update failed:', error);
    return res.status(500).json({ message: 'Unable to update the user.' });
  }
});

router.post('/users/:id/approve-role', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.requestedRole) {
      return res.status(404).json({ message: 'Role request not found.' });
    }
    if (user.requestedRole === 'Manager' && await User.exists({
      _id: { $ne: user._id },
      role: 'Manager',
      isActive: true
    })) {
      return res.status(409).json({ message: 'Only one active Manager can handle all employee claims.' });
    }

    user.role = user.requestedRole;
    user.requestedRole = undefined;
    user.isActive = true;
    await user.save();

    let notification = { sent: true };
    try {
      await sendSignupDecisionEmail(user, true, user.role);
    } catch (error) {
      notification = { sent: false, message: error.message };
      console.error('Signup approval email failed:', error);
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    return res.json({ user: safeUser, notification });
  } catch (error) {
    console.error('Role request approval failed:', error);
    return res.status(500).json({ message: 'Unable to approve the role request.' });
  }
});

router.post('/users/:id/reject-role', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.requestedRole) {
      return res.status(404).json({ message: 'Role request not found.' });
    }

    const { name, email, requestedRole } = user;
    await User.findByIdAndDelete(user._id);
    let notification = { sent: true };
    try {
      await sendSignupDecisionEmail({ name, email }, false, requestedRole);
    } catch (error) {
      notification = { sent: false, message: error.message };
      console.error('Signup rejection email failed:', error);
    }

    return res.json({ message: 'Signup request rejected.', notification });
  } catch (error) {
    console.error('Role request rejection failed:', error);
    return res.status(500).json({ message: 'Unable to reject the role request.' });
  }
});

router.delete('/users/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own account.' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.role === 'Manager' && user.isActive) {
      const activeManagerExists = await User.exists({
        _id: { $ne: user._id },
        role: 'Manager',
        isActive: true
      });
      if (!activeManagerExists) {
        return res.status(409).json({ message: 'Delete the other active Manager first or deactivate this one before removing it.' });
      }
    }

    if (user.role === 'Employee') {
      await Claim.deleteMany({ employee: user._id });
    }

    await User.findByIdAndDelete(req.params.id);
    return res.json({ message: `${user.name} was deleted successfully.` });
  } catch (error) {
    console.error('User deletion failed:', error);
    return res.status(500).json({ message: 'Unable to delete the user.' });
  }
});

module.exports = router;
