import './style.css';
import { authAPI, getToken, saveToken, saveUser, clearToken, clearUser, getUser } from './api.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderProducts } from './pages/products.js';
import { renderEnquiries } from './pages/enquiries.js';
import { renderQuotations } from './pages/quotations.js';
import { renderSalesOrders } from './pages/salesOrders.js';
import { renderDispatches } from './pages/dispatches.js';
import { renderCustomers } from './pages/customers.js';

// ============ STATE ============
let currentPage = 'dashboard';

// ============ AUTH: RENDER LOGIN ============
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="logo-icon">⚙️</div>
          <h1>IndustrialERP</h1>
          <p>Industrial Operations Management System</p>
        </div>
        <form class="login-form" id="login-form">
          <div id="login-error" style="display:none" class="login-error"></div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="you@company.com" value="admin@erp.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" value="admin123" required>
          </div>
          <button type="submit" class="login-submit" id="login-btn">Sign In</button>
        </form>
        <div class="login-hint">
          <strong>Demo Credentials:</strong><br>
          Admin: <strong>admin@erp.com</strong> / <strong>admin123</strong><br>
          Sales: <strong>sales@erp.com</strong> / <strong>sales123</strong>
        </div>
      </div>
    </div>
    <div id="toast-container"></div>
  `;

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errEl.style.display = 'none';

    try {
      const data = await authAPI.login(email, password);
      saveToken(data.token);
      saveUser(data.user);
      renderApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  };
}

// ============ MAIN APP SHELL ============
function renderApp() {
  const user = getUser();
  const isAdmin = user && user.role === 'ADMIN';
  const initials = user ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U';

  document.getElementById('app').innerHTML = `
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">⚙️</div>
        <div>
          <div class="logo-text">IndustrialERP</div>
          <div class="logo-sub">Operations Suite</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section-title">Main</div>
        <button class="nav-item active" data-page="dashboard" id="nav-dashboard">
          <span class="nav-icon">📊</span>
          <span class="nav-label">Dashboard</span>
        </button>

        <div class="nav-section-title">Sales</div>
        <button class="nav-item" data-page="customers" id="nav-customers">
          <span class="nav-icon">👥</span>
          <span class="nav-label">Customers</span>
        </button>
        <button class="nav-item" data-page="enquiries" id="nav-enquiries">
          <span class="nav-icon">📋</span>
          <span class="nav-label">Enquiries</span>
        </button>
        <button class="nav-item" data-page="quotations" id="nav-quotations">
          <span class="nav-icon">📄</span>
          <span class="nav-label">Quotations</span>
        </button>
        <button class="nav-item" data-page="sales-orders" id="nav-sales-orders">
          <span class="nav-icon">🛒</span>
          <span class="nav-label">Sales Orders</span>
        </button>
        <button class="nav-item" data-page="dispatches" id="nav-dispatches">
          <span class="nav-icon">🚚</span>
          <span class="nav-label">Dispatches</span>
        </button>

        <div class="nav-section-title">Inventory</div>
        <button class="nav-item" data-page="products" id="nav-products">
          <span class="nav-icon">📦</span>
          <span class="nav-label">Products</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">${initials}</div>
          <div>
            <div class="user-name">${user ? user.name : 'User'}</div>
            <div class="user-role">${user ? user.role : ''}</div>
          </div>
        </div>
        <button class="btn-logout" id="btn-logout">Sign Out</button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content" id="main-content">
    </main>

    <!-- Toast notifications -->
    <div id="toast-container"></div>
  `;

  // Nav click handlers
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.onclick = () => navigateTo(btn.dataset.page);
  });

  // Logout
  document.getElementById('btn-logout').onclick = () => {
    clearToken();
    clearUser();
    renderLogin();
  };

  // Load initial page
  navigateTo('dashboard');
}

// ============ NAVIGATION ============
async function navigateTo(page) {
  currentPage = page;
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  // Update active nav
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Render page
  switch (page) {
    case 'dashboard':     await renderDashboard(mainContent); break;
    case 'products':      await renderProducts(mainContent); break;
    case 'enquiries':     await renderEnquiries(mainContent); break;
    case 'quotations':    await renderQuotations(mainContent); break;
    case 'sales-orders':  await renderSalesOrders(mainContent); break;
    case 'dispatches':    await renderDispatches(mainContent); break;
    case 'customers':     await renderCustomers(mainContent); break;
    default:              await renderDashboard(mainContent);
  }
}

// ============ INIT ============
const token = getToken();
if (token) {
  renderApp();
} else {
  renderLogin();
}
