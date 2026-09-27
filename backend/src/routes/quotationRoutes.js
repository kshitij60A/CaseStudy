const express = require('express');
const router = express.Router();
const {
  createQuotation,
  getQuotations,
  updateQuotationStatus,
  convertQuotationToSalesOrder,
} = require('../controllers/quotationController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

// GET /api/quotations
router.get('/', getQuotations);

// POST /api/quotations
router.post('/', createQuotation);

// PATCH /api/quotations/:id/status
router.patch('/:id/status', updateQuotationStatus);

// POST /api/quotations/:id/convert  (Convert accepted quotation to sales order)
router.post('/:id/convert', convertQuotationToSalesOrder);

module.exports = router;
