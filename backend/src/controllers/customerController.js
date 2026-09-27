const prisma = require('../config/prisma');

// GET /api/customers - List all customers
const getCustomers = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { companyName: 'asc' },
    });
    return res.json({ success: true, customers });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch customers.' });
  }
};

// POST /api/customers - Create a new customer
const createCustomer = async (req, res) => {
  try {
    const { companyName, contactPerson, mobile, email, city } = req.body;

    if (!companyName || !contactPerson || !mobile || !email || !city) {
      return res.status(400).json({ success: false, error: 'All customer fields (companyName, contactPerson, mobile, email, city) are required.' });
    }

    const customer = await prisma.customer.create({
      data: {
        companyName,
        contactPerson,
        mobile,
        email,
        city,
      },
    });

    return res.status(201).json({ success: true, customer });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create customer.' });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
};
