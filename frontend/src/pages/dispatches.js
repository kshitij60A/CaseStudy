import { formatDate, getStatusBadgeClass, showToast } from '../utils.js';
import { dispatchAPI, salesOrderAPI } from '../api.js';

export async function renderDispatches(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Dispatch Management</h1>
        <p>Create dispatch records and track shipments</p>
      </div>
      <button class="btn btn-primary" id="btn-new-dispatch">＋ Create Dispatch</button>
    </div>
    <div class="page-content">
      <div id="dispatches-area">
        <div class="loading-state"><div class="spinner"></div><p>Loading dispatches...</p></div>
      </div>
    </div>
    <div id="dispatch-modal-container" style="display:none"></div>
  `;

  document.getElementById('btn-new-dispatch').onclick = () => showCreateDispatchModal();
  await loadDispatches();
}

async function loadDispatches() {
  const area = document.getElementById('dispatches-area');
  if (!area) return;
  area.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;

  try {
    const data = await dispatchAPI.list();
    const dispatches = data.dispatches;

    area.innerHTML = `
      <div class="card">
        <div class="card-title">
          Dispatch Records
          <span style="font-size:13px; font-weight:400; color:var(--text-muted)">${dispatches.length} total</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dispatch #</th>
                <th>Sales Order</th>
                <th>Customer</th>
                <th>Dispatch Date</th>
                <th>Vehicle #</th>
                <th>Driver</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              ${dispatches.length === 0
                ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted)">No dispatches yet.</td></tr>`
                : dispatches.map(d => `
                  <tr>
                    <td><span class="primary">${d.dispatchNumber}</span></td>
                    <td>${d.salesOrder ? d.salesOrder.orderNumber : '-'}</td>
                    <td>${d.salesOrder ? d.salesOrder.customer.companyName : '-'}</td>
                    <td>${formatDate(d.dispatchDate)}</td>
                    <td><span class="badge badge-blue">${d.vehicleNumber}</span></td>
                    <td>${d.driverName}</td>
                    <td>${d.items.length} items (${d.items.reduce((s, i) => s + i.quantity, 0)} units)</td>
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

async function showCreateDispatchModal() {
  const container = document.getElementById('dispatch-modal-container');
  container.style.display = 'block';
  container.innerHTML = `<div class="modal-overlay"><div class="modal"><div class="modal-body"><div class="loading-state"><div class="spinner"></div><p>Loading confirmed orders...</p></div></div></div></div>`;

  let confirmedOrders = [];
  try {
    const data = await salesOrderAPI.list();
    confirmedOrders = data.salesOrders.filter(o => o.status === 'CONFIRMED');
  } catch (err) {
    showToast('Failed to load sales orders.', 'error');
    container.style.display = 'none';
    return;
  }

  container.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title">Create Dispatch</span>
          <button class="modal-close" onclick="document.getElementById('dispatch-modal-container').style.display='none'">×</button>
        </div>
        <div class="modal-body">
          ${confirmedOrders.length === 0 ? `
            <div class="empty-state">
              <p style="font-size:24px">📦</p>
              <p>No confirmed sales orders available for dispatch.</p>
              <p style="font-size:12px; color:var(--text-muted)">Go to Sales Orders and confirm a pending order first.</p>
            </div>
          ` : `
            <div class="form-grid cols-1">
              <div class="form-group">
                <label class="form-label">Select Confirmed Sales Order *</label>
                <select id="disp-order-id" class="form-control">
                  <option value="">-- Select Order --</option>
                  ${confirmedOrders.map(o => `<option value="${o.id}">${o.orderNumber} - ${o.customer.companyName} (${o.items.length} items)</option>`).join('')}
                </select>
              </div>
            </div>

            <div id="disp-order-preview" style="display:none; margin:16px 0;">
              <div class="card" style="margin-bottom:0">
                <div class="card-title" style="font-size:13px">Order Items to Dispatch</div>
                <div id="disp-items-preview"></div>
              </div>
            </div>

            <div class="form-grid" style="margin-top:16px">
              <div class="form-group">
                <label class="form-label">Vehicle Number *</label>
                <input type="text" id="disp-vehicle" class="form-control" placeholder="e.g. MH12-AB-1234">
              </div>
              <div class="form-group">
                <label class="form-label">Driver Name *</label>
                <input type="text" id="disp-driver" class="form-control" placeholder="Driver's full name">
              </div>
            </div>

            <p id="disp-error" style="color:var(--danger); margin-top:10px; font-size:13px;"></p>
          `}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('dispatch-modal-container').style.display='none'">Cancel</button>
          ${confirmedOrders.length > 0 ? `<button class="btn btn-primary" id="btn-save-dispatch">Create Dispatch</button>` : ''}
        </div>
      </div>
    </div>
  `;

  if (confirmedOrders.length === 0) return;

  // Show items preview when order selected
  document.getElementById('disp-order-id').onchange = function() {
    const order = confirmedOrders.find(o => o.id === this.value);
    if (!order) {
      document.getElementById('disp-order-preview').style.display = 'none';
      return;
    }
    document.getElementById('disp-order-preview').style.display = 'block';
    document.getElementById('disp-items-preview').innerHTML = `
      <table class="line-items-table">
        <thead><tr><th>Product Code</th><th>Product Name</th><th>Quantity</th></tr></thead>
        <tbody>
          ${order.items.map(i => `
            <tr>
              <td>${i.product.code}</td>
              <td>${i.product.name}</td>
              <td>${i.quantity} ${i.product.unit}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  document.getElementById('btn-save-dispatch').onclick = async () => {
    const salesOrderId = document.getElementById('disp-order-id').value;
    const vehicleNumber = document.getElementById('disp-vehicle').value.trim();
    const driverName = document.getElementById('disp-driver').value.trim();
    const errEl = document.getElementById('disp-error');

    if (!salesOrderId) { errEl.textContent = 'Please select a sales order.'; return; }
    if (!vehicleNumber) { errEl.textContent = 'Vehicle number is required.'; return; }
    if (!driverName) { errEl.textContent = 'Driver name is required.'; return; }

    try {
      document.getElementById('btn-save-dispatch').disabled = true;
      const result = await dispatchAPI.create({ salesOrderId, vehicleNumber, driverName });
      container.style.display = 'none';
      showToast(`Dispatch ${result.dispatch.dispatchNumber} created! Inventory updated.`, 'success');
      await loadDispatches();
    } catch (err) {
      errEl.textContent = err.message;
      document.getElementById('btn-save-dispatch').disabled = false;
    }
  };
}
