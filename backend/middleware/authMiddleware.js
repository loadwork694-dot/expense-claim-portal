const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }

  try {
    const user = await User.findById(decoded.id)
      .select('name email role department isActive');
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'This account is inactive or no longer exists.' });
    }
    req.user = {
      id: user._id.toString(),
      role: user.role === 'Accountant' ? 'Accounts' : user.role,
      name: user.name,
      email: user.email,
      department: user.department || 'General'
    };
    return next();
  } catch (error) {
    console.error('Authentication lookup failed:', error);
    return res.status(500).json({ message: 'Unable to verify this session right now.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
};

module.exports = { protect, authorize };