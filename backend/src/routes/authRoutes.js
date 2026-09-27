const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const authenticateToken = require('../middleware/authMiddleware');

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me (requires token)
router.get('/me', authenticateToken, getMe);

module.exports = router;
