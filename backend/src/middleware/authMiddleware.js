const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate requests via JWT Bearer header
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <TOKEN>"

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required. Please login.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'industrial-erp-jwt-secret-key-2026');
    req.user = decoded; // Contains id, email, role, name
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
  }
};

module.exports = authenticateToken;
