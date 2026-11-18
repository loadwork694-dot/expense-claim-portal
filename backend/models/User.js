const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Employee', 'Manager', 'Accounts', 'Admin'],
    default: 'Employee'
  },
  requestedRole: {
    type: String,
    enum: ['Employee', 'Manager', 'Accounts', 'Admin']
  },
  department: {
    type: String,
    required: true,
    trim: true,
    default: 'General'
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);