const prisma = require('../config/prisma');

// Helper to generate next unique enquiry number (e.g., ENQ-2026-002)
async function generateEnquiryNumber() {
  const count = await prisma.enquiry.count();
  const year = new Date().getFullYear();
  return `ENQ-${year}-${String(count + 1).padStart(3, '0')}`;
}

// POST /api/enquiries - Create an enquiry
const createEnquiry = async (req, res) => {
  try {
    const {
      customerId,
      customerDetails, // Optional inline customer details if creating new customer on the fly
      requiredDate,
      notes,
      items, // Array of { productId, quantity }
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one product line item is required.' });
    }

    if (!requiredDate) {
      return res.status(400).json({ success: false, error: 'Required date is mandatory.' });
    }

    let targetCustomerId = customerId;

    // Create customer if customerDetails is provided and no customerId
    if (!targetCustomerId && customerDetails) {
      const { companyName, contactPerson, mobile, email, city } = customerDetails;
      if (!companyName || !contactPerson || !mobile || !email || !city) {
        return res.status(400).json({ success: false, error: 'Incomplete customer details provided.' });
      }
      const newCustomer = await prisma.customer.create({
        data: { companyName, contactPerson, mobile, email, city },
      });
      targetCustomerId = newCustomer.id;
    }

    if (!targetCustomerId) {
      return res.status(400).json({ success: false, error: 'Please select an existing customer or provide customer details.' });
    }

    const enquiryNumber = await generateEnquiryNumber();

    const enquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber,
        customerId: targetCustomerId,
        requiredDate: new Date(requiredDate),
        notes: notes || '',
        status: 'NEW',
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
          })),
        },
      },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });

    return res.status(201).json({ success: true, enquiry });
  } catch (error) {
    console.error('Error creating enquiry:', error);
    return res.status(500).json({ success: false, error: 'Failed to create enquiry.' });
  }
};

// GET /api/enquiries - List all enquiries
const getEnquiries = async (req, res) => {
  try {
    const enquiries = await prisma.enquiry.findMany({
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { inventory: true },
            },
          },
        },
        quotations: {
          select: { id: true, quotationNumber: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, enquiries });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch enquiries.' });
  }
};

// GET /api/enquiries/:id - Get single enquiry detail
const getEnquiryById = async (req, res) => {
  try {
    const { id } = req.params;
    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { inventory: true },
            },
          },
        },
        quotations: true,
      },
    });

    if (!enquiry) {
      return res.status(404).json({ success: false, error: 'Enquiry not found.' });
    }

    return res.json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch enquiry.' });
  }
};

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
};
