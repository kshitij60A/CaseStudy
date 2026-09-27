const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

// GET /api/dashboard
router.get('/', getDashboardStats);

module.exports = router;
