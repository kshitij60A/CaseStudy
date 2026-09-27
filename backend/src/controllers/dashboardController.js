const prisma = require('../config/prisma');

// GET /api/dashboard - Summary stats for the dashboard
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalCustomers,
      totalProducts,
      openEnquiries,
      pendingQuotations,
      activeSalesOrders,
      totalDispatches,
      recentEnquiries,
      recentOrders,
      lowStockProducts,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.product.count(),
      prisma.enquiry.count({ where: { status: { in: ['NEW', 'QUOTED'] } } }),
      prisma.quotation.count({ where: { status: { in: ['DRAFT', 'SENT'] } } }),
      prisma.salesOrder.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } }),
      prisma.dispatch.count(),
      // 5 most recent enquiries
      prisma.enquiry.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, items: true },
      }),
      // 5 most recent sales orders
      prisma.salesOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: true },
      }),
      // Products with low available stock (available < 20)
      prisma.inventory.findMany({
        where: {
          physicalQuantity: { lte: 50 },
        },
        include: { product: true },
        orderBy: { physicalQuantity: 'asc' },
        take: 5,
      }),
    ]);

    // Calculate revenue from completed/dispatched orders
    const revenueResult = await prisma.salesOrder.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'DISPATCHED' },
    });

    return res.json({
      success: true,
      stats: {
        totalCustomers,
        totalProducts,
        openEnquiries,
        pendingQuotations,
        activeSalesOrders,
        totalDispatches,
        totalRevenue: revenueResult._sum.totalAmount || 0,
      },
      recentEnquiries,
      recentOrders,
      lowStockProducts: lowStockProducts.map((inv) => ({
        productId: inv.productId,
        code: inv.product.code,
        name: inv.product.name,
        physicalQuantity: inv.physicalQuantity,
        reservedQuantity: inv.reservedQuantity,
        availableQuantity: inv.physicalQuantity - inv.reservedQuantity,
      })),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats.' });
  }
};

module.exports = { getDashboardStats };
