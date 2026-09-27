const express = require('express');
const router = express.Router();
const { createDispatch, getDispatches } = require('../controllers/dispatchController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

// GET /api/dispatches
router.get('/', getDispatches);

// POST /api/dispatches
router.post('/', createDispatch);

module.exports = router;
