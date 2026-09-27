const prisma = require('../config/prisma');

// Helper to generate dispatch number (e.g., DISP-2026-001)
async function generateDispatchNumber() {
  const count = await prisma.dispatch.count();
  const year = new Date().getFullYear();
  return `DISP-${year}-${String(count + 1).padStart(3, '0')}`;
}

// POST /api/dispatches - Create dispatch for a confirmed sales order
const createDispatch = async (req, res) => {
  try {
    const { salesOrderId, vehicleNumber, driverName, items } = req.body;

    if (!salesOrderId || !vehicleNumber || !driverName) {
      return res.status(400).json({
        success: false,
        error: 'salesOrderId, vehicleNumber, and driverName are required.',
      });
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        items: { include: { product: { include: { inventory: true } } } },
        dispatch: true,
      },
    });

    if (!salesOrder) {
      return res.status(404).json({ success: false, error: 'Sales order not found.' });
    }

    // Business Rule: Only CONFIRMED orders can be dispatched
    if (salesOrder.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        error: `Sales order must be in CONFIRMED status before dispatch. Current status: '${salesOrder.status}'.`,
      });
    }

    // Business Rule: Prevent duplicate dispatch for same order
    if (salesOrder.dispatch) {
      return res.status(400).json({
        success: false,
        error: `Dispatch (${salesOrder.dispatch.dispatchNumber}) has already been created for this sales order.`,
      });
    }

    // Determine dispatch items (use all sales order items if no override provided)
    const dispatchItems = items && items.length > 0 ? items : salesOrder.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }));

    // Validate inventory availability and collect deductions
    for (const dispatchItem of dispatchItems) {
      const orderItem = salesOrder.items.find((i) => i.productId === dispatchItem.productId);
      if (!orderItem) {
        return res.status(400).json({
          success: false,
          error: `Product ID ${dispatchItem.productId} is not part of this sales order.`,
        });
      }

      const inventory = orderItem.product.inventory;
      if (!inventory) {
        return res.status(400).json({
          success: false,
          error: `No inventory record found for product: ${orderItem.product.name}`,
        });
      }

      // Business Rule: Prevent dispatch beyond reserved (ordered) quantity
      if (dispatchItem.quantity > orderItem.quantity) {
        return res.status(400).json({
          success: false,
          error: `Cannot dispatch more than reserved for '${orderItem.product.name}'. Reserved/Ordered: ${orderItem.quantity}, Requested Dispatch: ${dispatchItem.quantity}.`,
        });
      }
    }

    // Run in transaction: generate dispatch number + create dispatch + update inventory + update order status
    const dispatch = await prisma.$transaction(async (tx) => {
      // Generate dispatch number inside transaction to prevent race conditions
      const count = await tx.dispatch.count();
      const year = new Date().getFullYear();
      const dispatchNumber = `DISP-${year}-${String(count + 1).padStart(3, '0')}`;

      const createdDispatch = await tx.dispatch.create({
        data: {
          dispatchNumber,
          salesOrderId,
          vehicleNumber,
          driverName,
          items: {
            create: dispatchItems.map((item) => ({
              productId: item.productId,
              quantity: Number(item.quantity),
            })),
          },
        },
        include: {
          salesOrder: { include: { customer: true } },
          items: { include: { product: true } },
        },
      });

      // Deduct from physical inventory for each dispatched item
      for (const dispatchItem of dispatchItems) {
        const orderItem = salesOrder.items.find((i) => i.productId === dispatchItem.productId);
        const inventory = orderItem.product.inventory;

        await tx.inventory.update({
          where: { productId: dispatchItem.productId },
          data: {
            physicalQuantity: {
              decrement: Number(dispatchItem.quantity),
            },
            // Also reduce reserved quantity as this reserved stock is now leaving the facility
            reservedQuantity: {
              decrement: Number(dispatchItem.quantity),
            },
          },
        });
      }

      // Mark the sales order as DISPATCHED
      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: 'DISPATCHED' },
      });

      return createdDispatch;
    });

    return res.status(201).json({ success: true, dispatch });
  } catch (error) {
    console.error('Error creating dispatch:', error);
    return res.status(500).json({ success: false, error: 'Failed to create dispatch.' });
  }
};

// GET /api/dispatches - List all dispatches
const getDispatches = async (req, res) => {
  try {
    const dispatches = await prisma.dispatch.findMany({
      include: {
        salesOrder: {
          include: { customer: true },
        },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, dispatches });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch dispatches.' });
  }
};

module.exports = {
  createDispatch,
  getDispatches,
};
