require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ---- Middleware ----
app.use(cors());
app.use(express.json());

// ---- Routes ----
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/enquiries', require('./routes/enquiryRoutes'));
app.use('/api/quotations', require('./routes/quotationRoutes'));
app.use('/api/sales-orders', require('./routes/salesOrderRoutes'));
app.use('/api/dispatches', require('./routes/dispatchRoutes'));

// ---- Health Check ----
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Industrial ERP API is running', timestamp: new Date().toISOString() });
});

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found.` });
});

// ---- Global error handler ----
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
});

// ---- Start Server ----
// ---- Start Server ----
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Industrial ERP Backend Server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health Check: http://localhost:${PORT}/health\n`);
  });
}

module.exports = app;
