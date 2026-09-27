import { formatDate, showToast } from '../utils.js';
import { customerAPI } from '../api.js';

export async function renderCustomers(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Customers</h1>
        <p>Manage your customer database</p>
      </div>
      <button class="btn btn-primary" id="btn-add-customer">＋ Add Customer</button>
    </div>
    <div class="page-content">
      <div id="customers-area">
        <div class="loading-state"><div class="spinner"></div><p>Loading customers...</p></div>
      </div>
    </div>
    <div id="customer-modal-container" style="display:none"></div>
  `;

  document.getElementById('btn-add-customer').onclick = () => showAddCustomerModal();
  await loadCustomers();
}

async function loadCustomers() {
  const area = document.getElementById('customers-area');
  if (!area) return;
  area.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;

  try {
    const data = await customerAPI.list();
    const customers = data.customers;

    area.innerHTML = `
      <div class="card">
        <div class="card-title">
          Customer Directory
          <span style="font-size:13px; font-weight:400; color:var(--text-muted)">${customers.length} customers</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Contact Person</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>City</th>
                <th>Added On</th>
              </tr>
            </thead>
            <tbody>
              ${customers.length === 0 
                ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">No customers added yet.</td></tr>`
                : customers.map(c => `
                  <tr>
                    <td><span class="primary">${c.companyName}</span></td>
                    <td>${c.contactPerson}</td>
                    <td>${c.mobile}</td>
                    <td><a href="mailto:${c.email}" style="color:var(--accent)">${c.email}</a></td>
                    <td>${c.city}</td>
                    <td>${formatDate(c.createdAt)}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    area.innerHTML = `<div class="error-state"><p>⚠️ ${err.message}</p></div>`;
  }
}

function showAddCustomerModal() {
  const container = document.getElementById('customer-modal-container');
  container.style.display = 'block';
  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Add New Customer</span>
          <button class="modal-close" onclick="document.getElementById('customer-modal-container').style.display='none'">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label">Company Name *</label>
              <input type="text" id="cust-company" class="form-control" placeholder="e.g. ABC Engineering Pvt. Ltd.">
            </div>
            <div class="form-group">
              <label class="form-label">Contact Person *</label>
              <input type="text" id="cust-contact" class="form-control" placeholder="Full name">
            </div>
            <div class="form-group">
              <label class="form-label">Mobile *</label>
              <input type="text" id="cust-mobile" class="form-control" placeholder="+91 98765 43210">
            </div>
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input type="email" id="cust-email" class="form-control" placeholder="contact@company.com">
            </div>
            <div class="form-group">
              <label class="form-label">City *</label>
              <input type="text" id="cust-city" class="form-control" placeholder="e.g. Mumbai">
            </div>
          </div>
          <p id="cust-error" style="color:var(--danger); margin-top:12px; font-size:13px;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('customer-modal-container').style.display='none'">Cancel</button>
          <button class="btn btn-primary" id="btn-save-customer">Save Customer</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save-customer').onclick = async () => {
    const companyName = document.getElementById('cust-company').value.trim();
    const contactPerson = document.getElementById('cust-contact').value.trim();
    const mobile = document.getElementById('cust-mobile').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const city = document.getElementById('cust-city').value.trim();
    const errEl = document.getElementById('cust-error');

    if (!companyName || !contactPerson || !mobile || !email || !city) {
      errEl.textContent = 'All fields are required.';
      return;
    }

    try {
      document.getElementById('btn-save-customer').disabled = true;
      await customerAPI.create({ companyName, contactPerson, mobile, email, city });
      container.style.display = 'none';
      showToast('Customer added successfully!', 'success');
      await loadCustomers();
    } catch (err) {
      errEl.textContent = err.message;
      document.getElementById('btn-save-customer').disabled = false;
    }
  };
}
