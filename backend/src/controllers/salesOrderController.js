const prisma = require('../config/prisma');

// GET /api/sales-orders - List all sales orders
const getSalesOrders = async (req, res) => {
  try {
    const orders = await prisma.salesOrder.findMany({
      include: {
        customer: true,
        quotation: { select: { quotationNumber: true } },
        items: { include: { product: true } },
        dispatch: { select: { id: true, dispatchNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, salesOrders: orders });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch sales orders.' });
  }
};

// GET /api/sales-orders/:id - Get single sales order
const getSalesOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        quotation: true,
        items: { include: { product: true } },
        dispatch: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Sales order not found.' });
    }

    return res.json({ success: true, salesOrder: order });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch sales order.' });
  }
};

// PATCH /api/sales-orders/:id/status - Update sales order status
const updateSalesOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const order = await prisma.salesOrder.findUnique({ 
      where: { id },
      include: { items: { include: { product: { include: { inventory: true } } } } }
    });
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Sales order not found.' });
    }

    if (order.status === status) {
      return res.json({ success: true, salesOrder: order });
    }

    // INVENTORY RESERVATION LOGIC FOR 'CONFIRMED' STATUS
    if (status === 'CONFIRMED' && order.status === 'PENDING') {
      try {
        // Execute atomic check-and-reserve inside a single transaction
        const updated = await prisma.$transaction(async (tx) => {
          for (const item of order.items) {
            // Re-fetch the absolute latest inventory strictly inside the transaction lock
            const inv = await tx.inventory.findUnique({
              where: { productId: item.productId }
            });
            
            if (!inv) throw new Error(`No inventory record for ${item.product.name}`);
            
            const available = inv.physicalQuantity - inv.reservedQuantity;
            
            // If two simultaneous requests reach here, the transaction lock ensures 
            // the second request will read the updated reservedQuantity from the first request.
            if (item.quantity > available) {
              throw new Error(`Insufficient stock for '${item.product.name}'. Required: ${item.quantity}, Available: ${available}`);
            }

            // Reserve the stock
            await tx.inventory.update({
              where: { productId: item.productId },
              data: { reservedQuantity: { increment: item.quantity } }
            });
          }

          // Update order status
          return tx.salesOrder.update({
            where: { id },
            data: { status },
            include: { customer: true, items: { include: { product: true } } }
          });
        });

        return res.json({ success: true, salesOrder: updated });
      } catch (txError) {
        // Catch the explicit insufficient stock errors thrown inside the transaction
        return res.status(400).json({ success: false, error: txError.message });
      }
    }

    // For other status changes (like cancelling), just update the status
    // Note: A full real-world app would also un-reserve inventory if transitioning CONFIRMED -> CANCELLED.
    if (status === 'CANCELLED' && order.status === 'CONFIRMED') {
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: { reservedQuantity: { decrement: item.quantity } }
          });
        }
        await tx.salesOrder.update({ where: { id }, data: { status } });
      });
      return res.json({ success: true, salesOrder: { ...order, status } });
    }

    // Default update
    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { status },
      include: { customer: true, items: { include: { product: true } } },
    });

    return res.json({ success: true, salesOrder: updated });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ success: false, error: 'Failed to update sales order status.' });
  }
};

module.exports = {
  getSalesOrders,
  getSalesOrderById,
  updateSalesOrderStatus,
};
