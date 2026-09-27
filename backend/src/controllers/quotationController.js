const prisma = require('../config/prisma');
const { calculateQuotationTotals } = require('../utils/pricingCalculator');

// Helper to generate next unique quotation number (e.g., QUO-2026-001)
async function generateQuotationNumber() {
  const count = await prisma.quotation.count();
  const year = new Date().getFullYear();
  return `QUO-${year}-${String(count + 1).padStart(3, '0')}`;
}

// POST /api/quotations - Create quotation against an enquiry
const createQuotation = async (req, res) => {
  try {
    const {
      enquiryId,
      validUntil,
      discountPercent = 0,
      gstPercent = 18,
      items, // Optional override items: [{ productId, quantity, unitPrice, discountPercent, gstPercent }]
    } = req.body;

    if (!enquiryId) {
      return res.status(400).json({ success: false, error: 'Enquiry ID is required.' });
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!enquiry) {
      return res.status(404).json({ success: false, error: 'Referenced enquiry not found.' });
    }

    // Determine line items: if custom items supplied use them, otherwise populate from enquiry items
    let rawItems = [];
    if (items && Array.isArray(items) && items.length > 0) {
      rawItems = items;
    } else {
      rawItems = enquiry.items.map((ei) => ({
        productId: ei.productId,
        quantity: ei.quantity,
        unitPrice: ei.product.basePrice,
        discountPercent: Number(discountPercent),
        gstPercent: Number(gstPercent),
      }));
    }

    if (rawItems.length === 0) {
      return res.status(400).json({ success: false, error: 'No product line items to create quotation.' });
    }

    // MANDATORY BACKEND COMPUTATION & VALIDATION
    const calculated = calculateQuotationTotals(rawItems, Number(discountPercent), Number(gstPercent));

    const quotationNumber = await generateQuotationNumber();
    const expiryDate = validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    // Execute in transaction: create quotation and update enquiry status
    const result = await prisma.$transaction(async (tx) => {
      const createdQuotation = await tx.quotation.create({
        data: {
          quotationNumber,
          enquiryId: enquiry.id,
          customerId: enquiry.customerId,
          validUntil: expiryDate,
          discountPercent: Number(discountPercent),
          gstPercent: Number(gstPercent),
          subtotal: calculated.subtotal,
          totalAmount: calculated.totalAmount, // Strictly backend calculated
          status: 'DRAFT',
          items: {
            create: calculated.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              gstPercent: item.gstPercent,
              lineAmount: item.lineAmount,
            })),
          },
        },
        include: {
          customer: true,
          enquiry: true,
          items: { include: { product: true } },
        },
      });

      // Update enquiry status to QUOTED if currently NEW
      if (enquiry.status === 'NEW') {
        await tx.enquiry.update({
          where: { id: enquiry.id },
          data: { status: 'QUOTED' },
        });
      }

      return createdQuotation;
    });

    return res.status(201).json({ success: true, quotation: result });
  } catch (error) {
    console.error('Error creating quotation:', error);
    return res.status(500).json({ success: false, error: 'Failed to create quotation.' });
  }
};

// GET /api/quotations - List all quotations
const getQuotations = async (req, res) => {
  try {
    const quotations = await prisma.quotation.findMany({
      include: {
        customer: true,
        enquiry: true,
        items: { include: { product: true } },
        salesOrder: { select: { id: true, orderNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, quotations });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch quotations.' });
  }
};

// PATCH /api/quotations/:id/status - Change quotation status (DRAFT -> SENT -> ACCEPTED / REJECTED)
const updateQuotationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedQuotation = await tx.quotation.update({
        where: { id },
        data: { status },
        include: { customer: true, enquiry: true, items: { include: { product: true } } },
      });

      // Update associated enquiry status if ACCEPTED or REJECTED
      if (status === 'ACCEPTED') {
        await tx.enquiry.update({
          where: { id: quotation.enquiryId },
          data: { status: 'WON' },
        });
      } else if (status === 'REJECTED') {
        await tx.enquiry.update({
          where: { id: quotation.enquiryId },
          data: { status: 'LOST' },
        });
      }

      return updatedQuotation;
    });

    return res.json({ success: true, quotation: result });
  } catch (error) {
    console.error('Error updating quotation status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update quotation status.' });
  }
};

// POST /api/quotations/:id/convert - Convert ACCEPTED quotation to Sales Order
const convertQuotationToSalesOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        salesOrder: true,
      },
    });

    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found.' });
    }

    // Business Rule Check 1: DRAFT or REJECTED quotation cannot create an order!
    if (quotation.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: `Cannot convert quotation into a Sales Order because its status is '${quotation.status}'. Only ACCEPTED quotations can be converted.`,
      });
    }

    // Business Rule Check 2: One quotation cannot accidentally generate duplicate Sales Orders!
    if (quotation.salesOrder) {
      return res.status(400).json({
        success: false,
        error: `Sales Order (${quotation.salesOrder.orderNumber}) has already been generated for this quotation. Duplicate conversion is prevented.`,
      });
    }

    // Generate Order Number (e.g. SO-2026-001)
    const orderCount = await prisma.salesOrder.count();
    const year = new Date().getFullYear();
    const orderNumber = `SO-${year}-${String(orderCount + 1).padStart(3, '0')}`;

    // Create Sales Order in Transaction (ensures atomicity)
    const salesOrder = await prisma.$transaction(async (tx) => {
      return tx.salesOrder.create({
        data: {
          orderNumber,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          totalAmount: quotation.totalAmount,
          status: 'PENDING',
          items: {
            create: quotation.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineAmount: item.lineAmount,
            })),
          },
        },
        include: {
          customer: true,
          quotation: true,
          items: { include: { product: true } },
        },
      });
    });

    return res.status(201).json({ success: true, salesOrder });
  } catch (error) {
    console.error('Error converting quotation to sales order:', error);
    // Handle Prisma unique constraint error on quotationId just in case
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Sales Order already exists for this quotation.' });
    }
    return res.status(500).json({ success: false, error: 'Failed to convert quotation to Sales Order.' });
  }
};

module.exports = {
  createQuotation,
  getQuotations,
  updateQuotationStatus,
  convertQuotationToSalesOrder,
};
