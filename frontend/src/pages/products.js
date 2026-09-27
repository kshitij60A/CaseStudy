import { formatCurrency, showToast } from '../utils.js';
import { productAPI, getUser } from '../api.js';

export async function renderProducts(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Products & Inventory</h1>
        <p>Manage your product catalogue and stock levels</p>
      </div>
      <div class="actions-row" id="product-header-actions"></div>
    </div>
    <div class="page-content">
      <div id="products-table-area">
        <div class="loading-state"><div class="spinner"></div><p>Loading products...</p></div>
      </div>
    </div>
    <!-- Modals -->
    <div id="add-product-modal" style="display:none"></div>
    <div id="update-inventory-modal" style="display:none"></div>
  `;

  const user = getUser();
  const isAdmin = user && user.role === 'ADMIN';

  // Show add product button for admins
  if (isAdmin) {
    document.getElementById('product-header-actions').innerHTML = `
      <button class="btn btn-primary" id="btn-add-product">＋ Add Product</button>
    `;
    document.getElementById('btn-add-product').onclick = () => showAddProductModal();
  }

  await loadProducts();
}

async function loadProducts() {
  const area = document.getElementById('products-table-area');
  if (!area) return;

  area.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;

  try {
    const data = await productAPI.list();
    const products = data.products;
    const user = getUser();
    const isAdmin = user && user.role === 'ADMIN';

    area.innerHTML = `
      <div class="card">
        <div class="card-title">
          Product Catalogue
          <span style="font-size:13px; font-weight:400; color:var(--text-muted)">${products.length} products</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Base Price</th>
                <th>Physical Qty</th>
                <th>Reserved Qty</th>
                <th>Available Qty</th>
                ${isAdmin ? '<th>Actions</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td><span class="primary">${p.code}</span></td>
                  <td>${p.name}</td>
                  <td><span class="badge badge-purple">${p.category}</span></td>
                  <td>${p.unit}</td>
                  <td>${formatCurrency(p.basePrice)}</td>
                  <td>${p.inventory ? p.inventory.physicalQuantity : '-'}</td>
                  <td>${p.inventory ? p.inventory.reservedQuantity : '-'}</td>
                  <td>
                    <span style="color: ${p.inventory && p.inventory.availableQuantity < 20 ? 'var(--danger)' : 'var(--success)'}; font-weight: 600;">
                      ${p.inventory ? p.inventory.availableQuantity : '-'}
                    </span>
                  </td>
                  ${isAdmin ? `
                    <td>
                      <button class="btn btn-sm btn-warning" onclick="window._updateInventory('${p.id}', '${p.name}', ${p.inventory ? p.inventory.physicalQuantity : 0})">
                        Update Stock
                      </button>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Attach global handler for inventory update button
    window._updateInventory = (id, name, currentQty) => showUpdateInventoryModal(id, name, currentQty);

  } catch (err) {
    area.innerHTML = `<div class="error-state"><p>⚠️ ${err.message}</p></div>`;
  }
}

function showAddProductModal() {
  const modalContainer = document.getElementById('add-product-modal');
  modalContainer.style.display = 'block';
  modalContainer.innerHTML = `
    <div class="modal-overlay" id="add-product-overlay">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Add New Product</span>
          <button class="modal-close" onclick="document.getElementById('add-product-modal').style.display='none'">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Product Code *</label>
              <input type="text" id="prod-code" class="form-control" placeholder="e.g. IND-007">
            </div>
            <div class="form-group">
              <label class="form-label">Product Name *</label>
              <input type="text" id="prod-name" class="form-control" placeholder="Product name">
            </div>
            <div class="form-group">
              <label class="form-label">Category *</label>
              <input type="text" id="prod-category" class="form-control" placeholder="e.g. Fluid Systems">
            </div>
            <div class="form-group">
              <label class="form-label">Unit *</label>
              <input type="text" id="prod-unit" class="form-control" placeholder="e.g. pcs, set, kg">
            </div>
            <div class="form-group">
              <label class="form-label">Base Price (₹) *</label>
              <input type="number" id="prod-price" class="form-control" placeholder="0.00" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Initial Stock Qty</label>
              <input type="number" id="prod-stock" class="form-control" placeholder="100" min="0" value="100">
            </div>
          </div>
          <p id="add-product-error" style="color:var(--danger); margin-top:12px; font-size:13px;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('add-product-modal').style.display='none'">Cancel</button>
          <button class="btn btn-primary" id="btn-save-product">Save Product</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save-product').onclick = async () => {
    const code = document.getElementById('prod-code').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value.trim();
    const unit = document.getElementById('prod-unit').value.trim();
    const basePrice = parseFloat(document.getElementById('prod-price').value);
    const initialPhysicalQuantity = parseInt(document.getElementById('prod-stock').value) || 0;
    const errorEl = document.getElementById('add-product-error');

    if (!code || !name || !category || !unit || isNaN(basePrice)) {
      errorEl.textContent = 'Please fill all required fields.';
      return;
    }

    try {
      document.getElementById('btn-save-product').disabled = true;
      document.getElementById('btn-save-product').textContent = 'Saving...';
      await productAPI.create({ code, name, category, unit, basePrice, initialPhysicalQuantity });
      modalContainer.style.display = 'none';
      showToast('Product created successfully!', 'success');
      await loadProducts();
    } catch (err) {
      errorEl.textContent = err.message;
      document.getElementById('btn-save-product').disabled = false;
      document.getElementById('btn-save-product').textContent = 'Save Product';
    }
  };
}

function showUpdateInventoryModal(productId, productName, currentQty) {
  const modalContainer = document.getElementById('update-inventory-modal');
  modalContainer.style.display = 'block';
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Update Inventory</span>
          <button class="modal-close" onclick="document.getElementById('update-inventory-modal').style.display='none'">×</button>
        </div>
        <div class="modal-body">
          <p style="color:var(--text-secondary); margin-bottom:16px;">Product: <strong style="color:var(--text-primary)">${productName}</strong></p>
          <div class="form-group">
            <label class="form-label">New Physical Quantity *</label>
            <input type="number" id="new-qty" class="form-control" value="${currentQty}" min="0">
          </div>
          <p id="inv-error" style="color:var(--danger); margin-top:10px; font-size:13px;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('update-inventory-modal').style.display='none'">Cancel</button>
          <button class="btn btn-primary" id="btn-save-inv">Update Stock</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save-inv').onclick = async () => {
    const qty = parseInt(document.getElementById('new-qty').value);
    const errEl = document.getElementById('inv-error');
    if (isNaN(qty) || qty < 0) {
      errEl.textContent = 'Please enter a valid non-negative quantity.';
      return;
    }
    try {
      document.getElementById('btn-save-inv').disabled = true;
      await productAPI.updateInventory(productId, qty);
      modalContainer.style.display = 'none';
      showToast('Inventory updated successfully!', 'success');
      await loadProducts();
    } catch (err) {
      errEl.textContent = err.message;
      document.getElementById('btn-save-inv').disabled = false;
    }
  };
}
