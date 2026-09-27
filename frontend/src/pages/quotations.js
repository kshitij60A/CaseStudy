import { formatCurrency, formatDate, getStatusBadgeClass, showToast } from '../utils.js';
import { quotationAPI, enquiryAPI, productAPI } from '../api.js';

export async function renderQuotations(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Quotations</h1>
        <p>Create and manage customer quotations from enquiries</p>
      </div>
      <button class="btn btn-primary" id="btn-new-quotation">＋ Create Quotation</button>
    </div>
    <div class="page-content">
      <div id="quotations-table-area">
        <div class="loading-state"><div class="spinner"></div><p>Loading quotations...</p></div>
      </div>
    </div>
    <div id="quotation-modal-container" style="display:none"></div>
  `;

  document.getElementById('btn-new-quotation').onclick = () => showCreateQuotationModal();

  await loadQuotations();
}

async function loadQuotations() {
  const area = document.getElementById('quotations-table-area');
  if (!area) return;
  area.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;

  try {
    const data = await quotationAPI.list();
    const quotations = data.quotations;

    area.innerHTML = `
      <div class="card">
        <div class="card-title">
          All Quotations
          <span style="font-size:13px; font-weight:400; color:var(--text-muted)">${quotations.length} total</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Quotation #</th>
                <th>Customer</th>
                <th>Enquiry #</th>
                <th>Valid Until</th>
                <th>Subtotal</th>
                <th>Total (with GST)</th>
                <th>Status</th>
                <th>Sales Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${quotations.length === 0 ? `<tr><td colspan="9" style="text-align:center; color:var(--text-muted)">No quotations yet.</td></tr>` :
                quotations.map(q => `
                  <tr>
                    <td><span class="primary">${q.quotationNumber}</span><br><span class="muted">${formatDate(q.createdAt)}</span></td>
                    <td><span class="primary">${q.customer.companyName}</span></td>
                    <td>${q.enquiry ? q.enquiry.enquiryNumber : '-'}</td>
                    <td>${formatDate(q.validUntil)}</td>
                    <td>${formatCurrency(q.subtotal)}</td>
                    <td><strong>${formatCurrency(q.totalAmount)}</strong></td>
                    <td><span class="badge ${getStatusBadgeClass(q.status)}">${q.status}</span></td>
                    <td>${q.salesOrder 
                      ? `<span class="badge badge-green">${q.salesOrder.orderNumber}</span>` 
                      : '<span style="color:var(--text-muted)">-</span>'
                    }</td>
                    <td>
                      <div class="actions-row">
                        ${q.status === 'DRAFT' ? `<button class="btn btn-sm btn-secondary" onclick="window._changeQStatus('${q.id}', 'SENT')">Mark Sent</button>` : ''}
                        ${q.status === 'SENT' ? `
                          <button class="btn btn-sm btn-success" onclick="window._changeQStatus('${q.id}', 'ACCEPTED')">Accept</button>
                          <button class="btn btn-sm btn-danger" onclick="window._changeQStatus('${q.id}', 'REJECTED')">Reject</button>
                        ` : ''}
                        ${q.status === 'ACCEPTED' && !q.salesOrder ? `
                          <button class="btn btn-sm btn-primary" onclick="window._convertToOrder('${q.id}')">Convert to Order</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    window._changeQStatus = async (id, status) => {
      try {
        await quotationAPI.updateStatus(id, status);
        showToast(`Quotation marked as ${status}`, 'success');
        await loadQuotations();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    window._convertToOrder = async (id) => {
      if (!confirm('Convert this accepted quotation into a Sales Order?')) return;
      try {
        const data = await quotationAPI.convertToOrder(id);
        showToast(`Sales Order ${data.salesOrder.orderNumber} created!`, 'success');
        await loadQuotations();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

  } catch (err) {
    area.innerHTML = `<div class="error-state"><p>⚠️ ${err.message}</p></div>`;
  }
}

async function showCreateQuotationModal() {
  const container = document.getElementById('quotation-modal-container');
  container.style.display = 'block';
  container.innerHTML = `<div class="modal-overlay"><div class="modal"><div class="modal-body"><div class="loading-state"><div class="spinner"></div><p>Loading enquiries...</p></div></div></div></div>`;

  let enquiries = [], products = [];
  try {
    const [enqData, prodData] = await Promise.all([enquiryAPI.list(), productAPI.list()]);
    // Only show enquiries that haven't been fully won/lost
    enquiries = enqData.enquiries.filter(e => ['NEW', 'QUOTED'].includes(e.status));
    products = prodData.products;
  } catch (err) {
    showToast('Failed to load data.', 'error');
    container.style.display = 'none';
    return;
  }

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title">Create New Quotation</span>
          <button class="modal-close" onclick="document.getElementById('quotation-modal-container').style.display='none'">×</button>
        </div>
        <div class="modal-body">
          <div class="card" style="margin-bottom:16px">
            <div class="card-title" style="font-size:13px; margin-bottom:12px">Quotation Details</div>
            <div class="form-grid">
              <div class="form-group full-width">
                <label class="form-label">Select Enquiry *</label>
                <select id="quo-enquiry-id" class="form-control">
                  <option value="">-- Select an Enquiry --</option>
                  ${enquiries.map(e => `<option value="${e.id}">${e.enquiryNumber} - ${e.customer.companyName} (${e.status})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Valid Until *</label>
                <input type="date" id="quo-valid-until" class="form-control" min="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <label class="form-label">Header Discount %</label>
                <input type="number" id="quo-discount" class="form-control" value="0" min="0" max="100">
              </div>
              <div class="form-group">
                <label class="form-label">GST %</label>
                <input type="number" id="quo-gst" class="form-control" value="18" min="0" max="28">
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title" style="font-size:13px; margin-bottom:12px">
              Product Line Items
              <button class="btn btn-sm btn-secondary" id="btn-add-quo-item" type="button">＋ Add Row</button>
            </div>
            <table class="line-items-table">
              <thead>
                <tr>
                  <th style="width:30%">Product</th>
                  <th>Qty</th>
                  <th>Unit Price (₹)</th>
                  <th>Disc %</th>
                  <th>GST %</th>
                  <th>Line Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="quo-items-body"></tbody>
            </table>
            <div style="margin-top:12px; text-align:right; font-size:14px; color:var(--text-secondary)">
              Grand Total (calculated by server): <span id="quo-preview-total" style="color:var(--accent); font-weight:700; font-size:16px">-</span>
            </div>
          </div>

          <p id="quo-error" style="color:var(--danger); margin-top:10px; font-size:13px;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('quotation-modal-container').style.display='none'">Cancel</button>
          <button class="btn btn-primary" id="btn-save-quotation">Create Quotation</button>
        </div>
      </div>
    </div>
  `;

  // When enquiry selected, populate items from it
  document.getElementById('quo-enquiry-id').onchange = function() {
    const enq = enquiries.find(e => e.id === this.value);
    if (!enq) return;
    document.getElementById('quo-items-body').innerHTML = '';
    quoRowCount = 0;
    enq.items.forEach(item => {
      addQuotationRow(products, item.product, item.quantity);
    });
  };

  addQuotationRow(products);
  document.getElementById('btn-add-quo-item').onclick = () => addQuotationRow(products);

  document.getElementById('btn-save-quotation').onclick = async () => {
    const enquiryId = document.getElementById('quo-enquiry-id').value;
    const validUntil = document.getElementById('quo-valid-until').value;
    const discountPercent = parseFloat(document.getElementById('quo-discount').value) || 0;
    const gstPercent = parseFloat(document.getElementById('quo-gst').value) || 18;
    const errEl = document.getElementById('quo-error');

    if (!enquiryId) { errEl.textContent = 'Please select an enquiry.'; return; }
    if (!validUntil) { errEl.textContent = 'Please enter valid until date.'; return; }

    const rows = document.querySelectorAll('.quo-item-row');
    const items = [];
    for (const row of rows) {
      const productId = row.querySelector('.quo-prod').value;
      const quantity = parseInt(row.querySelector('.quo-qty').value);
      const unitPrice = parseFloat(row.querySelector('.quo-price').value);
      const itemDiscount = parseFloat(row.querySelector('.quo-disc').value) || 0;
      const itemGst = parseFloat(row.querySelector('.quo-gst').value) || gstPercent;

      if (!productId || !quantity || isNaN(unitPrice)) {
        errEl.textContent = 'All rows need a product, quantity and unit price.';
        return;
      }
      items.push({ productId, quantity, unitPrice, discountPercent: itemDiscount, gstPercent: itemGst });
    }

    if (items.length === 0) { errEl.textContent = 'Please add at least one product.'; return; }

    try {
      document.getElementById('btn-save-quotation').disabled = true;
      const result = await quotationAPI.create({ enquiryId, validUntil, discountPercent, gstPercent, items });
      container.style.display = 'none';
      showToast(`Quotation ${result.quotation.quotationNumber} created! Total: ₹${result.quotation.totalAmount.toFixed(2)}`, 'success');
      await loadQuotations();
    } catch (err) {
      errEl.textContent = err.message;
      document.getElementById('btn-save-quotation').disabled = false;
    }
  };
}

let quoRowCount = 0;
function addQuotationRow(products, preProduct = null, preQty = 1) {
  const rowId = `quo-row-${quoRowCount++}`;
  const tbody = document.getElementById('quo-items-body');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'quo-item-row';
  tr.id = rowId;

  const price = preProduct ? preProduct.basePrice : 0;

  tr.innerHTML = `
    <td>
      <select class="quo-prod" style="width:100%; background:var(--bg-secondary); border:1px solid var(--border-light); color:var(--text-primary); padding:5px; border-radius:4px; font-size:12px;">
        <option value="">-- Product --</option>
        ${products.map(p => `<option value="${p.id}" ${preProduct && preProduct.id === p.id ? 'selected' : ''} data-price="${p.basePrice}">${p.code} - ${p.name}</option>`).join('')}
      </select>
    </td>
    <td><input type="number" class="quo-qty" value="${preQty}" min="1" style="width:60px; background:var(--bg-secondary); border:1px solid var(--border-light); color:var(--text-primary); padding:5px; border-radius:4px;"></td>
    <td><input type="number" class="quo-price" value="${price}" min="0" style="width:90px; background:var(--bg-secondary); border:1px solid var(--border-light); color:var(--text-primary); padding:5px; border-radius:4px;"></td>
    <td><input type="number" class="quo-disc" value="0" min="0" max="100" style="width:55px; background:var(--bg-secondary); border:1px solid var(--border-light); color:var(--text-primary); padding:5px; border-radius:4px;"></td>
    <td><input type="number" class="quo-gst" value="18" min="0" max="28" style="width:55px; background:var(--bg-secondary); border:1px solid var(--border-light); color:var(--text-primary); padding:5px; border-radius:4px;"></td>
    <td class="quo-line-total number-cell" style="color:var(--accent); font-weight:600;">-</td>
    <td><button class="remove-row" onclick="document.getElementById('${rowId}').remove(); recalcQuoTotal()">✕</button></td>
  `;
  tbody.appendChild(tr);

  // Auto-fill price when product changes
  tr.querySelector('.quo-prod').onchange = function () {
    const selected = this.options[this.selectedIndex];
    const price = selected.dataset.price || 0;
    tr.querySelector('.quo-price').value = price;
    recalcQuoLineTotal(tr);
  };

  // Recalc on any change
  ['quo-qty', 'quo-price', 'quo-disc', 'quo-gst'].forEach(cls => {
    tr.querySelector(`.${cls}`).oninput = () => recalcQuoLineTotal(tr);
  });

  recalcQuoLineTotal(tr);
}

function recalcQuoLineTotal(row) {
  const qty = parseFloat(row.querySelector('.quo-qty').value) || 0;
  const price = parseFloat(row.querySelector('.quo-price').value) || 0;
  const disc = parseFloat(row.querySelector('.quo-disc').value) || 0;
  const gst = parseFloat(row.querySelector('.quo-gst').value) || 0;
  const base = qty * price;
  const afterDisc = base * (1 - disc / 100);
  const total = afterDisc * (1 + gst / 100);
  row.querySelector('.quo-line-total').textContent = `₹${total.toFixed(2)}`;
  recalcQuoTotal();
}

function recalcQuoTotal() {
  const totals = Array.from(document.querySelectorAll('.quo-line-total')).map(el => {
    const val = el.textContent.replace('₹', '');
    return parseFloat(val) || 0;
  });
  const grand = totals.reduce((a, b) => a + b, 0);
  const el = document.getElementById('quo-preview-total');
  if (el) el.textContent = `₹${grand.toFixed(2)} (preview)`;
}
