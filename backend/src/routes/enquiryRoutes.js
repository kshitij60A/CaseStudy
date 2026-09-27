const express = require('express');
const router = express.Router();
const { createEnquiry, getEnquiries, getEnquiryById } = require('../controllers/enquiryController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

// GET /api/enquiries
router.get('/', getEnquiries);

// GET /api/enquiries/:id
router.get('/:id', getEnquiryById);

// POST /api/enquiries
router.post('/', createEnquiry);

module.exports = router;
