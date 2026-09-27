const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer } = require('../controllers/customerController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

// GET /api/customers
router.get('/', getCustomers);

// POST /api/customers
router.post('/', createCustomer);

module.exports = router;
