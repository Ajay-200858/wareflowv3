/**
 * WareFlow Customer Commerce Platform — Orders History Page Logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.WF_AUTH.requireAuth("login.html")) {
    return;
  }

  const tableBody = document.getElementById("orders-table-body");
  const emptyState = document.getElementById("orders-empty-state");
  const tableCard = document.getElementById("orders-table-card");

  function getStatusBadge(status) {
    switch (status) {
      case "COMPLETED":
        return `<span class="badge badge-success">Delivered</span>`;
      case "DELIVERY":
      case "PACKING":
      case "PICKING":
        return `<span class="badge badge-info">In Fulfilment (${status})</span>`;
      case "RESERVED":
        return `<span class="badge badge-success">Stock Confirmed</span>`;
      case "CANCELLED":
        return `<span class="badge badge-error">Cancelled</span>`;
      default:
        return `<span class="badge badge-warning">${status}</span>`;
    }
  }

  try {
    const orders = await window.CustomerAPI.orders.getOrders();

    if (!orders || orders.length === 0) {
      if (emptyState) emptyState.style.display = "block";
      if (tableCard) tableCard.style.display = "none";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    if (tableCard) tableCard.style.display = "block";

    if (tableBody) {
      tableBody.innerHTML = orders.map(o => {
        const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, {
          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        }) : "N/A";
        const itemCount = o.items ? o.items.reduce((acc, i) => acc + i.quantity, 0) : 0;

        return `
          <tr>
            <td>
              <strong style="font-family:var(--font-family-mono); font-size:14px;">${o.order_reference}</strong>
            </td>
            <td style="color:#6b7280; font-size:13px;">${dateStr}</td>
            <td>${itemCount} units (${o.items ? o.items.length : 0} SKUs)</td>
            <td style="font-weight:700;">$${Number(o.total_amount).toFixed(2)}</td>
            <td>
              <span class="badge badge-neutral">${o.payment_method}</span>
            </td>
            <td>${getStatusBadge(o.status)}</td>
            <td>
              <a href="order-detail.html?id=${o.id}" class="btn btn-secondary btn-sm">Track & Details →</a>
            </td>
          </tr>
        `;
      }).join("");
    }

  } catch (err) {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#c92a2a; padding:20px;">Failed to load order history: ${err.message}</td></tr>`;
    }
  }
});
