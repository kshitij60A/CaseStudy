# Industrial ERP System - PERN Stack

A full-stack Industrial ERP application covering the complete sales workflow:
**Enquiry → Quotation → Sales Order → Dispatch**

---

## 🚀 Quick Start

### Step 1: Start the Backend
```bash
cd backend
npm install           # Already done - skip if done
npm run dev           # Starts on http://localhost:5000
```

### Step 2: Start the Frontend
```bash
cd frontend
npm install           # Already done - skip if done
npm run dev           # Starts on http://localhost:3000
```

### Step 3: Open the App
Visit: **http://localhost:3000**

**Demo Login Credentials:**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@erp.com | admin123 |
| Sales | sales@erp.com | sales123 |

---

## 🏗 Project Structure

```
CaseStudy1/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema (SQLite)
│   │   ├── seed.js         # Sample data seeder
│   │   └── dev.db          # SQLite database file (auto-created)
│   ├── src/
│   │   ├── config/
│   │   │   └── prisma.js           # Prisma Client instance
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js   # JWT verification
│   │   │   └── roleMiddleware.js   # RBAC (Admin/Sales roles)
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── customerController.js
│   │   │   ├── productController.js
│   │   │   ├── enquiryController.js
│   │   │   ├── quotationController.js
│   │   │   ├── salesOrderController.js
│   │   │   ├── dispatchController.js
│   │   │   └── dashboardController.js
│   │   ├── routes/           # Express route files
│   │   ├── utils/
│   │   │   └── pricingCalculator.js  # Server-side pricing logic
│   │   └── server.js         # Express entry point
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── dashboard.js
    │   │   ├── customers.js
    │   │   ├── products.js
    │   │   ├── enquiries.js
    │   │   ├── quotations.js
    │   │   ├── salesOrders.js
    │   │   └── dispatches.js
    │   ├── api.js          # Centralized API service layer
    │   ├── utils.js        # Helper functions
    │   ├── main.js         # App entry point + routing
    │   └── style.css       # Complete dark-theme CSS
    ├── index.html
    └── package.json
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Login and get JWT | None |
| GET | `/api/auth/me` | Current user profile | JWT |
| GET | `/api/dashboard` | Dashboard stats | JWT |
| GET | `/api/customers` | List customers | JWT |
| POST | `/api/customers` | Create customer | JWT |
| GET | `/api/products` | List products + inventory | JWT |
| POST | `/api/products` | Add product | Admin |
| PUT | `/api/products/:id/inventory` | Update stock | Admin |
| GET | `/api/enquiries` | List enquiries | JWT |
| POST | `/api/enquiries` | Create enquiry | JWT |
| GET | `/api/quotations` | List quotations | JWT |
| POST | `/api/quotations` | Create quotation | JWT |
| PATCH | `/api/quotations/:id/status` | Update status | JWT |
| POST | `/api/quotations/:id/convert` | Convert to Sales Order | JWT |
| GET | `/api/sales-orders` | List orders | JWT |
| PATCH | `/api/sales-orders/:id/status` | Confirm/Cancel order | JWT |
| GET | `/api/dispatches` | List dispatches | JWT |
| POST | `/api/dispatches` | Create dispatch | JWT |

---

## 🔑 Business Rules Enforced

1. **Quotation Pricing** - All totals (subtotal, GST, Grand Total) are **calculated exclusively by the backend** using `pricingCalculator.js` — frontend values are not trusted.
2. **1-to-1 Quotation → Sales Order** - A quotation can only be converted to a Sales Order **once** (enforced by `@unique` constraint on `quotationId`).
3. **Only ACCEPTED quotations** can be converted to sales orders.
4. **Only CONFIRMED sales orders** can be dispatched.
5. **Inventory is automatically deducted** from physical stock when a dispatch is created.
6. **Dispatch prevents duplicates** - One dispatch per sales order (enforced by `@unique` on `salesOrderId`).
7. **Role-Based Access Control** - Only ADMIN can create products or update inventory.

---

## 🗄 Database

Uses **SQLite** (via Prisma ORM) for zero-setup local development.

To switch to **PostgreSQL** (production):
1. Update `prisma/schema.prisma`: change `provider = "sqlite"` to `provider = "postgresql"`
2. Update `backend/.env`: `DATABASE_URL="postgresql://user:pass@localhost:5432/erp_db"`
3. Run: `npx prisma db push`
