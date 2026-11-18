const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const { protect, authorize } = require('../middleware/authMiddleware');
const { z } = require('zod');

const router = express.Router();
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  limitPerClaim: z.number().positive(),
  isActive: z.boolean().optional()
});

router.use(protect);

router.get('/', async (req, res) => {
  const filter = req.user.role === 'Admin' ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ name: 1 });
  return res.json(categories);
});

router.post('/', authorize('Admin'), async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  try {
    const category = await Category.create(parsed.data);
    return res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A category with this name already exists.' });
    }
    console.error('Category creation failed:', error);
    return res.status(500).json({ message: 'Unable to create the category.' });
  }
});

router.patch('/:id', authorize('Admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid category ID.' });
  }
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
    return res.status(400).json({ message: parsed.success ? 'Provide a category name or limit.' : parsed.error.issues[0].message });
  }
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      runValidators: true
    });
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }
    return res.json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A category with this name already exists.' });
    }
    console.error('Category update failed:', error);
    return res.status(500).json({ message: 'Unable to update the category.' });
  }
});

router.delete('/:id', authorize('Admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid category ID.' });
  }
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!category) {
    return res.status(404).json({ message: 'Category not found.' });
  }
  return res.json({ message: 'Category deactivated.' });
});

module.exports = router;
