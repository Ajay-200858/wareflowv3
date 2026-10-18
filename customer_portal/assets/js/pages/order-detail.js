/**
 * WareFlow Customer Commerce Platform — Order Tracking & Detail Page Logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.WF_AUTH.requireAuth("login.html")) {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("id");

  if (!orderId) {
    window.location.href = "orders.html";
    return;
  }

  const refEl = document.getElementById("order-reference");
  const dateEl = document.getElementById("order-date");
  const statusBadgeEl = document.getElementById("order-status-badge");
  const timelineEl = document.getElementById("order-timeline");
  const itemsTbody = document.getElementById("order-items-tbody");
  const subtotalEl = document.getElementById("order-subtotal");
  const totalEl = document.getElementById("order-total");
  const addressEl = document.getElementById("order-address");
  const paymentMethodEl = document.getElementById("order-payment-method");
  const paymentStatusEl = document.getElementById("order-payment-status");
  const notesEl = document.getElementById("order-notes");
  const cancelBtn = document.getElementById("cancel-order-btn");
  const reorderBtn = document.getElementById("reorder-btn");

  let currentOrder = null;

  function renderStatusBadge(status, statusDisplay) {
    switch (status) {
      case "COMPLETED":
        return `<span class="badge badge-success">${statusDisplay || 'Delivered'}</span>`;
      case "DELIVERY":
      case "PACKING":
      case "PICKING":
        return `<span class="badge badge-info">${statusDisplay || status}</span>`;
      case "RESERVED":
        return `<span class="badge badge-success">${statusDisplay || 'Stock Confirmed'}</span>`;
      case "CANCELLED":
        return `<span class="badge badge-error">Cancelled</span>`;
      default:
        return `<span class="badge badge-warning">${statusDisplay || status}</span>`;
    }
  }

  function renderTimeline(timeline) {
    if (!timeline || !timelineEl) return;

    timelineEl.innerHTML = timeline.map((step, idx) => {
      let stateClass = "timeline-pending";
      let icon = `<span style="font-size:11px;">${idx + 1}</span>`;
      if (step.completed) {
        stateClass = "timeline-completed";
        icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (step.current) {
        stateClass = "timeline-current";
        icon = `<span style="width:8px; height:8px; background:white; border-radius:50%; display:inline-block;"></span>`;
      }

      const dateStr = step.timestamp ? new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

      return `
        <div class="timeline-step ${stateClass}">
          <div class="timeline-marker">${icon}</div>
          <div class="timeline-content">
            <div class="timeline-title">${step.label}</div>
            ${dateStr ? `<div class="timeline-time">${dateStr}</div>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  async function loadOrderDetail() {
    try {
      const order = await window.CustomerAPI.orders.getOrderDetail(orderId);
      currentOrder = order;

      if (refEl) refEl.textContent = order.order_reference;
      if (dateEl) {
        const d = new Date(order.created_at);
        dateEl.textContent = d.toLocaleDateString(undefined, {
          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        });
      }

      if (statusBadgeEl) {
        statusBadgeEl.innerHTML = renderStatusBadge(order.status, order.status_display);
      }

      renderTimeline(order.timeline);

      if (addressEl) addressEl.textContent = order.delivery_address || "Standard dock delivery address on file";
      if (paymentMethodEl) paymentMethodEl.textContent = order.payment_method === "INVOICE" ? "Commercial Net 30 Invoice" : order.payment_method;
      if (paymentStatusEl) paymentStatusEl.textContent = order.payment_status;
      if (notesEl) notesEl.textContent = order.notes || "None provided";

      if (subtotalEl) subtotalEl.textContent = `$${Number(order.total_amount).toFixed(2)}`;
      if (totalEl) totalEl.textContent = `$${Number(order.total_amount).toFixed(2)}`;

      if (itemsTbody) {
        itemsTbody.innerHTML = order.items.map(item => {
          return `
            <tr>
              <td>
                <div style="font-weight:600; color:var(--color-text-primary);">${item.name}</div>
                <div style="font-size:12px; font-family:var(--font-family-mono); color:var(--color-text-muted);">${item.sku}</div>
              </td>
              <td style="font-weight:700;">${item.quantity}</td>
              <td>$${Number(item.unit_price).toFixed(2)}</td>
              <td style="font-weight:700;">$${Number(item.total_price).toFixed(2)}</td>
              <td>
                <span style="font-size:13px; color:${item.picked_quantity >= item.quantity ? '#2f9e44' : '#6b7280'};">
                  ${item.picked_quantity} / ${item.quantity} units
                </span>
              </td>
            </tr>
          `;
        }).join("");
      }

      // Check cancellation eligibility
      const canCancel = ["PENDING", "RESERVED", "APPROVED"].includes(order.status);
      if (cancelBtn) {
        cancelBtn.style.display = canCancel ? "inline-flex" : "none";
      }

    } catch (err) {
      alert("Error loading order tracking: " + err.message);
      window.location.href = "orders.html";
    }
  }

  // Cancel order handler
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to cancel this order? Any reserved inventory will be immediately released back to the warehouse.")) {
        return;
      }
      cancelBtn.disabled = true;
      cancelBtn.textContent = "Cancelling...";
      try {
        await window.CustomerAPI.orders.cancelOrder(orderId);
        alert("Order successfully cancelled and reserved stock returned.");
        await loadOrderDetail();
      } catch (err) {
        alert("Failed to cancel order: " + err.message);
        cancelBtn.disabled = false;
        cancelBtn.textContent = "Cancel Order";
      }
    });
  }

  // Reorder handler
  if (reorderBtn) {
    reorderBtn.addEventListener("click", async () => {
      reorderBtn.disabled = true;
      reorderBtn.textContent = "Processing...";
      try {
        const res = await window.CustomerAPI.orders.reorder(orderId);
        alert(`Items from order ${currentOrder ? currentOrder.order_reference : ''} added to your cart.`);
        window.location.href = "cart.html";
      } catch (err) {
        alert("Reorder error: " + err.message);
        reorderBtn.disabled = false;
        reorderBtn.textContent = "Reorder All Items";
      }
    });
  }

  await loadOrderDetail();
});
