/**
 * Middleware to restrict route access based on user role(s)
 * @param  {...string} allowedRoles Allowed roles (e.g., 'ADMIN', 'SALES_USER')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, error: 'User authentication missing.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: User role '${req.user.role}' is not authorized to perform this action. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
};

module.exports = authorizeRoles;
