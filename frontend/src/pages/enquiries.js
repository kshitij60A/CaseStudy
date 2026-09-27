import { formatDate, getStatusBadgeClass, showToast } from '../utils.js';
import { enquiryAPI, customerAPI, productAPI } from '../api.js';

export async function renderEnquiries(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Enquiries</h1>
        <p>Manage customer enquiries and product requests</p>
      </div>
      <button class="btn btn-primary" id="btn-new-enquiry">＋ New Enquiry</button>
    </div>
    <div class="page-content">
      <div id="enquiries-table-area">
        <div class="loading-state"><div class="spinner"></div><p>Loading enquiries...</p></div>
      </div>
    </div>
    <div id="enquiry-modal-container" style="display:none"></div>
  `;

  document.getElementById('btn-new-enquiry').onclick = async () => {
    await showCreateEnquiryModal();
  };

  await loadEnquiries();
}

async function loadEnquiries() {
  const area = document.getElementById('enquiries-table-area');
  if (!area) return;
  area.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;
  
  try {
    const data = await enquiryAPI.list();
    const enquiries = data.enquiries;
    area.innerHTML = `
      <div class="card">
        <div class="card-title">
          All Enquiries
          <span style="font-size:13px; font-weight:400; color:var(--text-muted)">${enquiries.length} total</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Enquiry #</th>
                <th>Customer</th>
                <th>City</th>
                <th>Required Date</th>
                <th>Items</th>
                <th>Status</th>
                <th>Quotations</th>
              </tr>
            </thead>
            <tbody>
              ${enquiries.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted)">No enquiries found. Create your first one!</td></tr>` :
                enquiries.map(e => `
                  <tr>
                    <td><span class="primary">${e.enquiryNumber}</span><br><span class="muted">${formatDate(e.createdAt)}</span></td>
                    <td>
                      <span class="primary">${e.customer.companyName}</span><br>
                      <span class="muted">${e.customer.contactPerson}</span>
                    </td>
                    <td>${e.customer.city}</td>
                    <td>${formatDate(e.requiredDate)}</td>
                    <td>${e.items.length} items</td>
                    <td><span class="badge ${getStatusBadgeClass(e.status)}">${e.status}</span></td>
                    <td>${e.quotations.length > 0 
                      ? e.quotations.map(q => `<span class="badge badge-purple">${q.quotationNumber}</span>`).join(' ')
                      : '<span style="color:var(--text-muted)">None</span>'
                    }</td>
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

async function showCreateEnquiryModal() {
  const container = document.getElementById('enquiry-modal-container');
  container.style.display = 'block';

  // Load customers and products
  let customers = [], products = [];
  try {
    const [custData, prodData] = await Promise.all([customerAPI.list(), productAPI.list()]);
    customers = custData.customers;
    products = prodData.products;
  } catch (err) {
    showToast('Failed to load customers/products.', 'error');
    container.style.display = 'none';
    return;
  }

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title">New Customer Enquiry</span>
          <button class="modal-close" onclick="document.getElementById('enquiry-modal-container').style.display='none'">×</button>
        </div>
        <div class="modal-body">

          <!-- Customer Selection -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title" style="font-size:13px; margin-bottom:12px">Customer Details</div>
            <div class="form-grid">
              <div class="form-group full-width">
                <label class="form-label">Select Existing Customer *</label>
                <select id="enq-customer-id" class="form-control">
                  <option value="">-- Select Customer --</option>
                  ${customers.map(c => `<option value="${c.id}">${c.companyName} - ${c.city}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Required By Date *</label>
                <input type="date" id="enq-required-date" class="form-control" min="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <label class="form-label">Notes</label>
                <input type="text" id="enq-notes" class="form-control" placeholder="Any special requirements...">
              </div>
            </div>
          </div>

          <!-- Product Line Items -->
          <div class="card">
            <div class="card-title" style="font-size:13px; margin-bottom:12px">
              Product Items
              <button class="btn btn-sm btn-secondary" id="btn-add-enq-item" type="button">＋ Add Product</button>
            </div>
            <table class="line-items-table" id="enq-items-table">
              <thead>
                <tr>
                  <th style="width:50%">Product</th>
                  <th style="width:25%">Quantity</th>
                  <th style="width:25%">Action</th>
                </tr>
              </thead>
              <tbody id="enq-items-body">
              </tbody>
            </table>
          </div>

          <p id="enq-error" style="color:var(--danger); margin-top:10px; font-size:13px;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('enquiry-modal-container').style.display='none'">Cancel</button>
          <button class="btn btn-primary" id="btn-save-enquiry">Submit Enquiry</button>
        </div>
      </div>
    </div>
  `;

  // Add initial row
  addEnquiryItemRow(products);
  document.getElementById('btn-add-enq-item').onclick = () => addEnquiryItemRow(products);

  document.getElementById('btn-save-enquiry').onclick = async () => {
    const customerId = document.getElementById('enq-customer-id').value;
    const requiredDate = document.getElementById('enq-required-date').value;
    const notes = document.getElementById('enq-notes').value;
    const errEl = document.getElementById('enq-error');

    if (!customerId) { errEl.textContent = 'Please select a customer.'; return; }
    if (!requiredDate) { errEl.textContent = 'Please select a required date.'; return; }

    const rows = document.querySelectorAll('.enq-item-row');
    const items = [];
    for (const row of rows) {
      const productId = row.querySelector('.enq-product-sel').value;
      const quantity = parseInt(row.querySelector('.enq-qty').value);
      if (!productId || !quantity || quantity <= 0) {
        errEl.textContent = 'All product rows must have a product and valid quantity.';
        return;
      }
      items.push({ productId, quantity });
    }

    if (items.length === 0) { errEl.textContent = 'Please add at least one product.'; return; }

    try {
      document.getElementById('btn-save-enquiry').disabled = true;
      await enquiryAPI.create({ customerId, requiredDate, notes, items });
      container.style.display = 'none';
      showToast('Enquiry submitted successfully!', 'success');
      await loadEnquiries();
    } catch (err) {
      errEl.textContent = err.message;
      document.getElementById('btn-save-enquiry').disabled = false;
    }
  };
}

let enqRowCount = 0;
function addEnquiryItemRow(products) {
  const rowId = `enq-row-${enqRowCount++}`;
  const tbody = document.getElementById('enq-items-body');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'enq-item-row';
  tr.id = rowId;
  tr.innerHTML = `
    <td>
      <select class="enq-product-sel form-control" style="font-size:13px">
        <option value="">-- Select Product --</option>
        ${products.map(p => `<option value="${p.id}">${p.code} - ${p.name} (Available: ${p.inventory ? p.inventory.availableQuantity : 0})</option>`).join('')}
      </select>
    </td>
    <td>
      <input type="number" class="enq-qty form-control" placeholder="Qty" min="1" value="1" style="font-size:13px">
    </td>
    <td>
      <button class="remove-row" onclick="document.getElementById('${rowId}').remove()">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
}
