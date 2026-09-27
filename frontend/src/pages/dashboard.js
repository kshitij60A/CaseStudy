import { formatCurrency, formatDate, getStatusBadgeClass } from '../utils.js';
import { dashboardAPI } from '../api.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p>Overview of your industrial ERP operations</p>
      </div>
    </div>
    <div class="page-content">
      <div id="dashboard-stats">
        <div class="loading-state"><div class="spinner"></div><p>Loading dashboard...</p></div>
      </div>
    </div>
  `;

  try {
    const data = await dashboardAPI.getStats();
    const { stats, recentEnquiries, recentOrders, lowStockProducts } = data;

    document.getElementById('dashboard-stats').innerHTML = `
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-label">Customers</div>
          <div class="stat-value">${stats.totalCustomers}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-label">Products</div>
          <div class="stat-value">${stats.totalProducts}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-label">Open Enquiries</div>
          <div class="stat-value">${stats.openEnquiries}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📄</div>
          <div class="stat-label">Pending Quotations</div>
          <div class="stat-value">${stats.pendingQuotations}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🛒</div>
          <div class="stat-label">Active Orders</div>
          <div class="stat-value">${stats.activeSalesOrders}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🚚</div>
          <div class="stat-label">Dispatches</div>
          <div class="stat-value">${stats.totalDispatches}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-label">Revenue (Dispatched)</div>
          <div class="stat-value currency">${formatCurrency(stats.totalRevenue)}</div>
        </div>
      </div>

      <!-- Row: Recent Enquiries + Low Stock -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        
        <div class="card">
          <div class="card-title">Recent Enquiries</div>
          ${recentEnquiries.length === 0 ? '<p style="color: var(--text-muted)">No enquiries yet.</p>' : `
          <div class="table-wrapper">
            <table>
              <thead><tr>
                <th>Enquiry #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                ${recentEnquiries.map(e => `
                  <tr>
                    <td><span class="primary">${e.enquiryNumber}</span></td>
                    <td>${e.customer.companyName}</td>
                    <td>${e.items.length} items</td>
                    <td><span class="badge ${getStatusBadgeClass(e.status)}">${e.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          `}
        </div>

        <div class="card">
          <div class="card-title">⚠️ Low Stock Alerts</div>
          ${lowStockProducts.length === 0 
            ? '<p style="color: var(--success); font-size:13px">✓ All products have adequate stock levels.</p>'
            : `
            <div class="table-wrapper">
              <table>
                <thead><tr>
                  <th>Product</th>
                  <th>Physical</th>
                  <th>Reserved</th>
                  <th>Available</th>
                </tr></thead>
                <tbody>
                  ${lowStockProducts.map(p => `
                    <tr>
                      <td>
                        <span class="primary">${p.code}</span><br>
                        <span class="muted">${p.name}</span>
                      </td>
                      <td>${p.physicalQuantity}</td>
                      <td>${p.reservedQuantity}</td>
                      <td style="color: ${p.availableQuantity < 10 ? 'var(--danger)' : 'var(--warning)'}; font-weight:600;">${p.availableQuantity}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
          }
        </div>

      </div>

      <!-- Recent Sales Orders -->
      <div class="card" style="margin-top: 20px;">
        <div class="card-title">Recent Sales Orders</div>
        ${recentOrders.length === 0 ? '<p style="color: var(--text-muted)">No sales orders yet.</p>' : `
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Order Date</th>
              <th>Total Amount</th>
              <th>Status</th>
            </tr></thead>
            <tbody>
              ${recentOrders.map(o => `
                <tr>
                  <td><span class="primary">${o.orderNumber}</span></td>
                  <td>${o.customer.companyName}</td>
                  <td>${formatDate(o.orderDate)}</td>
                  <td>${formatCurrency(o.totalAmount)}</td>
                  <td><span class="badge ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
    `;
  } catch (err) {
    document.getElementById('dashboard-stats').innerHTML = `
      <div class="error-state"><p>⚠️ Failed to load dashboard: ${err.message}</p></div>
    `;
  }
}
