// =========================================
// Utility helper functions for the frontend
// =========================================

// Format currency in INR
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

// Format date to readable string
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Format datetime
export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Return CSS class for status badges
export function getStatusBadgeClass(status) {
  const map = {
    NEW: 'badge-blue',
    QUOTED: 'badge-yellow',
    WON: 'badge-green',
    LOST: 'badge-red',
    DRAFT: 'badge-gray',
    SENT: 'badge-blue',
    ACCEPTED: 'badge-green',
    REJECTED: 'badge-red',
    PENDING: 'badge-yellow',
    CONFIRMED: 'badge-blue',
    DISPATCHED: 'badge-green',
    CANCELLED: 'badge-red',
  };
  return map[status] || 'badge-gray';
}

// Show a toast notification
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  // Remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Show a loading spinner inside a container element
export function setLoading(containerId, isLoading) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (isLoading) {
    el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;
  }
}

// Show an error message inside a container element
export function setError(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="error-state"><p>⚠️ ${message}</p></div>`;
}
