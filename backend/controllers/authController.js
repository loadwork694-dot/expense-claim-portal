const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const credentialsSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').transform((email) => email.toLowerCase()),
  password: z.string().min(1, 'Password is required')
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['Employee', 'Manager', 'Accounts', 'Admin']).optional().default('Employee')
});

const createAuthResponse = (user) => {
  const role = user.role === 'Accountant' ? 'Accounts' : user.role;
  const token = jwt.sign(
    {
      id: user._id,
      role,
      name: user.name,
      department: user.department || 'General'
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role,
      department: user.department || 'General',
      isActive: user.isActive !== false
    }
  };
};

exports.register = async (req, res) => {
  const validation = registerSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ message: validation.error.issues[0].message });
  }

  try {
    const { name, email, password, role } = validation.data;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      password: hashedPassword,
      department: 'General',
      role: 'Employee',
      requestedRole: role,
      isActive: false
    });

    return res.status(202).json({
      message: 'Your signup request has been sent to an Admin. You can log in after it is approved.'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    console.error('Registration failed:', error);
    return res.status(500).json({ message: 'Unable to create your account right now.' });
  }
};

exports.login = async (req, res) => {
  const validation = credentialsSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ message: validation.error.issues[0].message });
  }

  try {
    const { email, password } = validation.data;
    const user = await User.findOne({ email });

    if (!user || user.isActive === false || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.status(200).json({
      message: 'Login successful.',
      ...createAuthResponse(user)
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ message: 'Unable to log in right now.' });
  }
};
