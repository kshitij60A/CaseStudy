const express = require('express');
const router = express.Router();
const { getSalesOrders, getSalesOrderById, updateSalesOrderStatus } = require('../controllers/salesOrderController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

// GET /api/sales-orders
router.get('/', getSalesOrders);

// GET /api/sales-orders/:id
router.get('/:id', getSalesOrderById);

// PATCH /api/sales-orders/:id/status
router.patch('/:id/status', updateSalesOrderStatus);

module.exports = router;
