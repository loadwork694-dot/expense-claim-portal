const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const Category = require('./models/Category');
const User = require('./models/User');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Middleware
app.use(express.json());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin))
}));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/claims', require('./routes/claimRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// MongoDB Connection & Server Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ledger-expensesnap';

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET must be configured before starting the server');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    const starterCategories = [
      { name: 'Fuel', limitPerClaim: 5000 },
      { name: 'Travel', limitPerClaim: 10000 },
      { name: 'Meals', limitPerClaim: 2500 },
      { name: 'Petty Cash', limitPerClaim: 5000 }
    ];
    for (const category of starterCategories) {
      await Category.updateOne(
        { name: category.name },
        { $setOnInsert: { ...category, isActive: true } },
        { upsert: true }
      );
    }
    await Category.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );
    await User.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );
    await User.updateMany(
      { department: { $in: [null, ''] } },
      { $set: { department: 'General' } }
    );
    await User.updateMany(
      { role: 'Accountant' },
      { $set: { role: 'Accounts' } }
    );
    await User.collection.updateMany(
      { $or: [{ requestedRole: { $exists: true } }, { manager: { $exists: true } }] },
      { $unset: { requestedRole: 1, manager: 1 } }
    );

    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (ADMIN_NAME && ADMIN_EMAIL && ADMIN_PASSWORD) {
      const email = ADMIN_EMAIL.trim().toLowerCase();
      const existingAdmin = await User.findOne({ email });
      if (!existingAdmin) {
        await User.create({
          name: ADMIN_NAME,
          email,
          password: await bcrypt.hash(ADMIN_PASSWORD, 10),
          role: 'Admin',
          department: 'Administration'
        });
        console.log('Initial admin account created from environment configuration');
      }
    } else if (!(await User.exists({ role: 'Admin' }))) {
      console.warn('No administrator account exists. Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD to bootstrap one.');
    }

    console.log('✅ Connected to MongoDB successfully');
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Server initialization failed:', err.message);
  });

// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'Ledger ExpenseSnap Backend is running successfully!' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must contain valid JSON.' });
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Receipt files must be smaller than 5 MB.' });
  }
  if (typeof error.message === 'string' && error.message.startsWith('Receipt must be')) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
});