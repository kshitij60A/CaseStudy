import { formatCurrency, formatDate, getStatusBadgeClass, showToast } from '../utils.js';
import { salesOrderAPI, dispatchAPI } from '../api.js';

export async function renderSalesOrders(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Sales Orders</h1>
        <p>Track and manage customer sales orders</p>
      </div>
    </div>
    <div class="page-content">
      <div id="sales-orders-area">
        <div class="loading-state"><div class="spinner"></div><p>Loading sales orders...</p></div>
      </div>
    </div>
    <div id="dispatch-modal-container" style="display:none"></div>
  `;

  await loadSalesOrders();
}

async function loadSalesOrders() {
  const area = document.getElementById('sales-orders-area');
  if (!area) return;
  area.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;

  try {
    const data = await salesOrderAPI.list();
    const orders = data.salesOrders;

    area.innerHTML = `
      <div class="card">
        <div class="card-title">
          All Sales Orders
          <span style="font-size:13px; font-weight:400; color:var(--text-muted)">${orders.length} total</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items & Stock</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Dispatch</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${orders.length === 0 
                ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted)">No sales orders yet. Convert accepted quotations to create orders.</td></tr>`
                : orders.map(o => `
                  <tr>
                    <td><span class="primary">${o.orderNumber}</span><br><span class="muted">${formatDate(o.orderDate)}</span></td>
                    <td>
                      <span class="primary">${o.customer.companyName}</span><br>
                      <span class="muted">${o.customer.contactPerson}</span>
                    </td>
                    <td>
                      <div style="font-size:12px; display:flex; flex-direction:column; gap:4px;">
                        ${o.items.map(i => {
                          const inv = i.product.inventory;
                          const avail = inv ? (inv.physicalQuantity - inv.reservedQuantity) : 0;
                          return `<div>• ${i.product.name} (Qty: ${i.quantity}) 
                                   <span style="color: ${avail >= i.quantity ? 'var(--success)' : 'var(--danger)'}">
                                     [Available: ${avail}]
                                   </span>
                                  </div>`;
                        }).join('')}
                      </div>
                    </td>
                    <td><strong>${formatCurrency(o.totalAmount)}</strong></td>
                    <td><span class="badge ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
                    <td>${o.dispatch 
                      ? `<span class="badge badge-green">${o.dispatch.dispatchNumber}</span>`
                      : '<span style="color:var(--text-muted)">Not dispatched</span>'
                    }</td>
                    <td>
                      ${o.status === 'PENDING' ? `
                        <button class="btn btn-sm btn-primary" onclick="window._confirmOrder('${o.id}')">Confirm/Reserve</button>
                      ` : ''}
                      ${o.status === 'CONFIRMED' ? `
                        <button class="btn btn-sm btn-success" onclick="window._showDispatchModal('${o.id}', '${o.orderNumber}')">Process Dispatch</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    window._showDispatchModal = (id, orderNum) => {
      const container = document.getElementById('dispatch-modal-container');
      container.style.display = 'block';
      container.innerHTML = `
        <div class="modal-overlay">
          <div class="modal">
            <div class="modal-header">
              <span class="modal-title">Dispatch Order: ${orderNum}</span>
              <button class="modal-close" onclick="document.getElementById('dispatch-modal-container').style.display='none'">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Vehicle Number *</label>
                <input type="text" id="disp-vehicle" class="form-control" placeholder="e.g. MH-12-AB-1234">
              </div>
              <div class="form-group">
                <label class="form-label">Driver Name *</label>
                <input type="text" id="disp-driver" class="form-control" placeholder="e.g. Ramesh">
              </div>
              <p id="disp-error" style="color:var(--danger); margin-top:10px; font-size:13px;"></p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('dispatch-modal-container').style.display='none'">Cancel</button>
              <button class="btn btn-success" id="btn-submit-dispatch">Confirm Dispatch</button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-submit-dispatch').onclick = async () => {
        const vehicleNumber = document.getElementById('disp-vehicle').value.trim();
        const driverName = document.getElementById('disp-driver').value.trim();
        const errEl = document.getElementById('disp-error');

        if (!vehicleNumber || !driverName) {
          errEl.textContent = 'Vehicle Number and Driver Name are required.';
          return;
        }

        try {
          document.getElementById('btn-submit-dispatch').disabled = true;
          await dispatchAPI.create({ salesOrderId: id, vehicleNumber, driverName });
          container.style.display = 'none';
          showToast('Order successfully dispatched!', 'success');
          await loadSalesOrders();
        } catch (err) {
          errEl.textContent = err.message;
          document.getElementById('btn-submit-dispatch').disabled = false;
        }
      };
    };

    window._confirmOrder = async (id) => {
      if (!confirm('Confirm this sales order?')) return;
      try {
        await salesOrderAPI.updateStatus(id, 'CONFIRMED');
        showToast('Sales order confirmed!', 'success');
        await loadSalesOrders();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

  } catch (err) {
    area.innerHTML = `<div class="error-state"><p>⚠️ ${err.message}</p></div>`;
  }
}
