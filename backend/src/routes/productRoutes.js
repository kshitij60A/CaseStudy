const express = require('express');
const router = express.Router();
const { getProducts, createProduct, updateInventory } = require('../controllers/productController');
const authenticateToken = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

// All product routes require login
router.use(authenticateToken);

// GET /api/products - Anyone logged in can view products
router.get('/', getProducts);

// POST /api/products - Only ADMIN can create products
router.post('/', authorizeRoles('ADMIN'), createProduct);

// PUT /api/products/:id/inventory - Only ADMIN can update inventory
router.put('/:id/inventory', authorizeRoles('ADMIN'), updateInventory);

module.exports = router;
