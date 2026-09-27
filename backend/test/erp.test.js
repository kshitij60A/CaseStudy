import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

describe('Industrial ERP - Mandatory Integration Tests', () => {
  let adminToken, salesToken;
  let testCustomer, testProduct, testEnquiry, testQuotation, testQuotationId;

  // Setup database fixtures before testing
  beforeAll(async () => {
    // 1. Authenticate to get tokens
    const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@erp.com', password: 'admin123' });
    adminToken = adminRes.body.token;
    const salesRes = await request(app).post('/api/auth/login').send({ email: 'sales@erp.com', password: 'sales123' });
    salesToken = salesRes.body.token;

    // 2. Fetch existing seeded records to work with
    const customers = await prisma.customer.findMany({ take: 1 });
    testCustomer = customers[0];

    // Get a product and ensure it has 100 physical, 0 reserved for tests
    const products = await prisma.product.findMany({ take: 1, include: { inventory: true } });
    testProduct = products[0];
    await prisma.inventory.update({
      where: { productId: testProduct.id },
      data: { physicalQuantity: 100, reservedQuantity: 0 }
    });

    // Create a fresh Enquiry to test against
    const enqRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerId: testCustomer.id,
        requiredDate: new Date(Date.now() + 86400000).toISOString(),
        items: [{ productId: testProduct.id, quantity: 10 }]
      });
    testEnquiry = enqRes.body.enquiry;
  });

  // ---------------------------------------------------------
  // TEST 1: Quotation total is calculated correctly (Backend overrides UI)
  // ---------------------------------------------------------
  it('Test 1: Quotation total is calculated correctly strictly by the backend', async () => {
    const maliciousPayload = {
      enquiryId: testEnquiry.id,
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      discountPercent: 10,
      gstPercent: 18,
      items: [
        {
          productId: testProduct.id,
          quantity: 10,
          unitPrice: 100, // True Base Amount = 1000
          discountPercent: 10, // After 10% disc = 900
          gstPercent: 18, // After 18% GST = 1062
          // Malicious attempt to forge total amount to 0
          lineAmount: 0 
        }
      ],
      totalAmount: 0 // Malicious attempt to fake total
    };

    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send(maliciousPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    // Validate backend calculated the correct strict total regardless of payload
    const q = res.body.quotation;
    expect(q.subtotal).toBe(1000); // 10 * 100
    expect(q.totalAmount).toBe(1062); // backend computed
    
    // Save for next test
    testQuotation = q;
    testQuotationId = q.id;
  });

  // ---------------------------------------------------------
  // TEST 2: Rejected/Draft quotation cannot create a Sales Order
  // ---------------------------------------------------------
  it('Test 2: Rejected/Draft quotation cannot create a Sales Order', async () => {
    // 1. Current status is DRAFT. Try to convert:
    let res = await request(app)
      .post(`/api/quotations/${testQuotationId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only ACCEPTED quotations can be converted');

    // 2. Change to REJECTED and try again
    await request(app).patch(`/api/quotations/${testQuotationId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'REJECTED' });
    
    res = await request(app)
      .post(`/api/quotations/${testQuotationId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
      
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only ACCEPTED quotations can be converted');
  });

  // ---------------------------------------------------------
  // TEST 3: Same quotation cannot generate duplicate Sales Orders
  // ---------------------------------------------------------
  it('Test 3: Same quotation cannot generate duplicate Sales Orders', async () => {
    // Change to ACCEPTED so it's valid
    await request(app).patch(`/api/quotations/${testQuotationId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'ACCEPTED' });

    // First conversion (Should succeed)
    const firstRes = await request(app)
      .post(`/api/quotations/${testQuotationId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
      
    expect(firstRes.status).toBe(201);
    expect(firstRes.body.salesOrder).toBeDefined();

    // Second conversion attempt (Should fail, duplicate blocked)
    const duplicateRes = await request(app)
      .post(`/api/quotations/${testQuotationId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
      
    expect(duplicateRes.status).toBe(400);
    expect(duplicateRes.body.error).toContain('already been generated');
  });

  // ---------------------------------------------------------
  // TEST 4: Cannot reserve more than available inventory
  // ---------------------------------------------------------
  it('Test 4: Cannot reserve more than available inventory', async () => {
    // We have 100 physical stock. Let's create an order for 200 items.
    
    // First, create valid parent records to satisfy foreign keys
    const testEnq = await prisma.enquiry.create({
      data: { enquiryNumber: 'TEST-ENQ-999', customerId: testCustomer.id, requiredDate: new Date(), status: 'WON' }
    });
    const testQuo = await prisma.quotation.create({
      data: { quotationNumber: 'TEST-QUO-999', enquiryId: testEnq.id, customerId: testCustomer.id, validUntil: new Date(), status: 'ACCEPTED' }
    });

    const impossibleOrder = await prisma.salesOrder.create({
      data: {
        orderNumber: 'TEST-O-999',
        quotationId: testQuo.id,
        customerId: testCustomer.id,
        totalAmount: 5000,
        status: 'PENDING',
        items: {
          create: [{ productId: testProduct.id, quantity: 200, unitPrice: 10, lineAmount: 2000 }]
        }
      }
    });

    // Try to confirm the order
    const res = await request(app)
      .patch(`/api/sales-orders/${impossibleOrder.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Insufficient stock');
    
    // Cleanup
    await prisma.salesOrder.delete({ where: { id: impossibleOrder.id }});
  });

  // ---------------------------------------------------------
  // TEST 5: Unauthorized user cannot perform a restricted operation
  // ---------------------------------------------------------
  it('Test 5: Unauthorized user cannot perform restricted operation (Product creation)', async () => {
    // Sales User tries to hit Admin-only endpoint
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        code: 'HACK-001',
        name: 'Hacked Product',
        category: 'Test',
        unit: 'pcs',
        basePrice: 100
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('is not authorized to perform this action');
  });

  // ---------------------------------------------------------
  // BONUS: Test simultaneous inventory reservations (Race Conditions)
  // ---------------------------------------------------------
  it('Bonus: Test simultaneous inventory reservations (TOCTOU prevention)', async () => {
    // We have 100 physical, 0 reserved (Available = 100).
    
    // Create valid parent records to satisfy strict foreign keys
    const enqRace = await prisma.enquiry.create({
      data: { enquiryNumber: 'RACE-ENQ', customerId: testCustomer.id, requiredDate: new Date(), status: 'WON' }
    });
    const quoRace1 = await prisma.quotation.create({
      data: { quotationNumber: 'RACE-QUO-1', enquiryId: enqRace.id, customerId: testCustomer.id, validUntil: new Date(), status: 'ACCEPTED' }
    });
    const quoRace2 = await prisma.quotation.create({
      data: { quotationNumber: 'RACE-QUO-2', enquiryId: enqRace.id, customerId: testCustomer.id, validUntil: new Date(), status: 'ACCEPTED' }
    });

    // Create two separate orders, both requesting 60 items each. Total 120 (exceeds 100).
    const order1 = await prisma.salesOrder.create({
      data: {
        orderNumber: 'RACE-1', quotationId: quoRace1.id, customerId: testCustomer.id, totalAmount: 1, status: 'PENDING',
        items: { create: [{ productId: testProduct.id, quantity: 60, unitPrice: 1, lineAmount: 1 }] }
      }
    });
    
    const order2 = await prisma.salesOrder.create({
      data: {
        orderNumber: 'RACE-2', quotationId: quoRace2.id, customerId: testCustomer.id, totalAmount: 1, status: 'PENDING',
        items: { create: [{ productId: testProduct.id, quantity: 60, unitPrice: 1, lineAmount: 1 }] }
      }
    });

    // Fire both CONFIRM requests perfectly simultaneously
    const promise1 = request(app).patch(`/api/sales-orders/${order1.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'CONFIRMED' });
    const promise2 = request(app).patch(`/api/sales-orders/${order2.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'CONFIRMED' });

    const [res1, res2] = await Promise.all([promise1, promise2]);

    // One must succeed, one must fail due to our strict transaction locks
    const successCount = [res1.status, res2.status].filter(s => s === 200).length;
    const failCount = [res1.status, res2.status].filter(s => s === 400).length;

    expect(successCount).toBe(1); // One succeeded
    expect(failCount).toBe(1);    // One failed with insufficient stock

    // Verify DB states: exactly 60 should be reserved, NOT 120.
    const inv = await prisma.inventory.findUnique({ where: { productId: testProduct.id }});
    expect(inv.reservedQuantity).toBe(60);

    // Cleanup
    await prisma.salesOrder.delete({ where: { id: order1.id }});
    await prisma.salesOrder.delete({ where: { id: order2.id }});
  });

});
