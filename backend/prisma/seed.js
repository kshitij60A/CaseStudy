const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial ERP database records...');

  // 1. Seed Users (ADMIN & SALES_USER)
  const adminPassword = await bcrypt.hash('admin123', 10);
  const salesPassword = await bcrypt.hash('sales123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@erp.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@erp.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@erp.com' },
    update: {},
    create: {
      name: 'Sales Manager',
      email: 'sales@erp.com',
      password: salesPassword,
      role: 'SALES_USER',
    },
  });

  console.log(`Users Created: Admin (${admin.email}), Sales (${salesUser.email})`);

  // 2. Seed Initial Customers
  const customer1 = await prisma.customer.create({
    data: {
      companyName: 'ABC Engineering Pvt. Ltd.',
      contactPerson: 'Rajesh Kumar',
      mobile: '+91 98765 43210',
      email: 'rajesh@abcengineering.com',
      city: 'Mumbai',
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      companyName: 'Apex Machinery & Automation',
      contactPerson: 'Sunita Sharma',
      mobile: '+91 98123 67890',
      email: 'sunita@apexmachinery.com',
      city: 'Pune',
    },
  });

  console.log(`Customers Created: ${customer1.companyName}, ${customer2.companyName}`);

  // 3. Seed 6 Industrial Products & Inventory
  const sampleProducts = [
    {
      code: 'IND-001',
      name: 'Industrial Hydraulic Pump',
      category: 'Fluid Systems',
      unit: 'pcs',
      basePrice: 1200.0,
      physicalQuantity: 100,
      reservedQuantity: 30,
    },
    {
      code: 'IND-002',
      name: 'Heavy Duty Electric Motor',
      category: 'Motors & Drives',
      unit: 'pcs',
      basePrice: 850.0,
      physicalQuantity: 150,
      reservedQuantity: 50,
    },
    {
      code: 'IND-003',
      name: 'High Pressure Control Valve',
      category: 'Valves & Actuators',
      unit: 'pcs',
      basePrice: 450.0,
      physicalQuantity: 200,
      reservedQuantity: 40,
    },
    {
      code: 'IND-004',
      name: 'Industrial Bearing Assembly',
      category: 'Mechanical',
      unit: 'set',
      basePrice: 280.0,
      physicalQuantity: 300,
      reservedQuantity: 20,
    },
    {
      code: 'IND-005',
      name: 'Precision Planetary Gearbox',
      category: 'Mechanical',
      unit: 'pcs',
      basePrice: 1550.0,
      physicalQuantity: 80,
      reservedQuantity: 10,
    },
    {
      code: 'IND-006',
      name: 'Automated Digital Flow Sensor',
      category: 'Instrumentation',
      unit: 'pcs',
      basePrice: 620.0,
      physicalQuantity: 120,
      reservedQuantity: 15,
    },
  ];

  for (const prodData of sampleProducts) {
    const { physicalQuantity, reservedQuantity, ...prodInfo } = prodData;

    const prod = await prisma.product.upsert({
      where: { code: prodInfo.code },
      update: {},
      create: {
        ...prodInfo,
        inventory: {
          create: {
            physicalQuantity,
            reservedQuantity,
          },
        },
      },
    });
    console.log(`Seeded Product: ${prod.code} - ${prod.name}`);
  }

  // 4. Create an initial sample Enquiry, Quotation, and Sales Order for demo workflow
  const enquiry = await prisma.enquiry.create({
    data: {
      enquiryNumber: 'ENQ-2026-001',
      customerId: customer1.id,
      requiredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: 'Urgent procurement for Q3 plant expansion',
      status: 'QUOTED',
      items: {
        create: [
          {
            productId: (await prisma.product.findUnique({ where: { code: 'IND-001' } })).id,
            quantity: 10,
          },
          {
            productId: (await prisma.product.findUnique({ where: { code: 'IND-002' } })).id,
            quantity: 5,
          },
        ],
      },
    },
  });

  console.log(`Sample Enquiry Created: ${enquiry.enquiryNumber}`);

  console.log('Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
