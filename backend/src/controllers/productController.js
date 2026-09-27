const prisma = require('../config/prisma');

// GET /api/products - Get all products with inventory stats
const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventory: true,
      },
      orderBy: { code: 'asc' },
    });

    // Format output to include calculated availableQuantity
    const formatted = products.map((prod) => {
      const physical = prod.inventory ? prod.inventory.physicalQuantity : 0;
      const reserved = prod.inventory ? prod.inventory.reservedQuantity : 0;
      const available = physical - reserved;

      return {
        id: prod.id,
        code: prod.code,
        name: prod.name,
        category: prod.category,
        unit: prod.unit,
        basePrice: prod.basePrice,
        inventory: prod.inventory
          ? {
              id: prod.inventory.id,
              physicalQuantity: physical,
              reservedQuantity: reserved,
              availableQuantity: available,
            }
          : null,
      };
    });

    return res.json({ success: true, products: formatted });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch products.' });
  }
};

// POST /api/products - Create new product (ADMIN only)
const createProduct = async (req, res) => {
  try {
    const { code, name, category, unit, basePrice, initialPhysicalQuantity = 100 } = req.body;

    if (!code || !name || !category || !unit || basePrice === undefined) {
      return res.status(400).json({ success: false, error: 'All fields (code, name, category, unit, basePrice) are required.' });
    }

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ success: false, error: `Product with code '${code}' already exists.` });
    }

    const product = await prisma.product.create({
      data: {
        code,
        name,
        category,
        unit,
        basePrice: Number(basePrice),
        inventory: {
          create: {
            physicalQuantity: Number(initialPhysicalQuantity) || 0,
            reservedQuantity: 0,
          },
        },
      },
      include: { inventory: true },
    });

    return res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ success: false, error: 'Failed to create product.' });
  }
};

// PUT /api/products/:id/inventory - Update physical inventory quantity (ADMIN only)
const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { physicalQuantity } = req.body;

    if (physicalQuantity === undefined || Number(physicalQuantity) < 0) {
      return res.status(400).json({ success: false, error: 'Physical quantity must be a non-negative number.' });
    }

    const currentInventory = await prisma.inventory.findUnique({
      where: { productId: id },
    });

    if (!currentInventory) {
      return res.status(404).json({ success: false, error: 'Inventory record not found for product.' });
    }

    if (Number(physicalQuantity) < currentInventory.reservedQuantity) {
      return res.status(400).json({
        success: false,
        error: `Physical quantity (${physicalQuantity}) cannot be reduced below current reserved quantity (${currentInventory.reservedQuantity}).`,
      });
    }

    const updated = await prisma.inventory.update({
      where: { productId: id },
      data: { physicalQuantity: Number(physicalQuantity) },
    });

    return res.json({
      success: true,
      inventory: {
        ...updated,
        availableQuantity: updated.physicalQuantity - updated.reservedQuantity,
      },
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return res.status(500).json({ success: false, error: 'Failed to update inventory.' });
  }
};

module.exports = {
  getProducts,
  createProduct,
  updateInventory,
};
