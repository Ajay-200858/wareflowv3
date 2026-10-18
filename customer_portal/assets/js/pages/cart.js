/**
 * WareFlow Customer Commerce Platform — Cart Page Logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("cart-table-body");
  const subtotalEl = document.getElementById("cart-subtotal");
  const totalDisplayEl = document.getElementById("cart-total-display");
  const totalCountEl = document.getElementById("cart-total-count");
  const rfqNoticeEl = document.getElementById("cart-rfq-notice");
  const checkoutBtn = document.getElementById("cart-checkout-btn");
  const clearBtn = document.getElementById("cart-clear-btn");
  const emptyState = document.getElementById("cart-empty-state");
  const cartContent = document.getElementById("cart-content-grid");

  async function renderCart() {
    const cart = await window.WF_CART.getCart();

    if (!cart || !cart.items || cart.items.length === 0) {
      if (cartContent) cartContent.style.display = "none";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (cartContent) cartContent.style.display = "grid";
    if (emptyState) emptyState.style.display = "none";

    const formattedSubtotal = `₹${Number(cart.subtotal).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (totalCountEl) totalCountEl.textContent = cart.total_items;
    if (subtotalEl) subtotalEl.textContent = formattedSubtotal;
    if (totalDisplayEl) totalDisplayEl.textContent = formattedSubtotal;

    if (rfqNoticeEl) {
      rfqNoticeEl.style.display = cart.has_rfq_items ? "block" : "none";
    }

    if (tableBody) {
      tableBody.innerHTML = cart.items.map(it => {
        const hasPrice = it.price && it.price > 0;
        const priceStr = hasPrice ? `₹${Number(it.price).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "Price on Request";
        const lineTotalStr = hasPrice ? `₹${Number(it.line_total).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "RFQ";

        return `
          <tr data-id="${it.product_id}">
            <td>
              <div style="font-weight:600; font-size:15px;"><a href="product-detail.html?id=${it.product_id}">${it.name}</a></div>
              <div style="font-size:12px; font-family:var(--font-family-mono); color:#6b7280;">SKU: ${it.sku}</div>
            </td>
            <td>${priceStr}</td>
            <td>
              <div class="quantity-stepper">
                <button type="button" class="stepper-btn qty-minus-btn" data-id="${it.product_id}" data-qty="${it.quantity}">-</button>
                <input type="number" class="stepper-input qty-input" data-id="${it.product_id}" value="${it.quantity}" min="1">
                <button type="button" class="stepper-btn qty-plus-btn" data-id="${it.product_id}" data-qty="${it.quantity}">+</button>
              </div>
            </td>
            <td style="font-weight:700;">${lineTotalStr}</td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm remove-item-btn" data-id="${it.product_id}" title="Remove item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </td>
          </tr>
        `;
      }).join("");

      // Bind steppers
      tableBody.querySelectorAll(".qty-minus-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const pid = parseInt(btn.getAttribute("data-id"));
          const currentQty = parseInt(btn.getAttribute("data-qty"));
          if (currentQty > 1) {
            await window.WF_CART.updateQuantity(pid, currentQty - 1);
            renderCart();
          } else {
            if (confirm("Remove this item from your cart?")) {
              await window.WF_CART.removeItem(pid);
              renderCart();
            }
          }
        });
      });

      tableBody.querySelectorAll(".qty-plus-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const pid = parseInt(btn.getAttribute("data-id"));
          const currentQty = parseInt(btn.getAttribute("data-qty"));
          await window.WF_CART.updateQuantity(pid, currentQty + 1);
          renderCart();
        });
      });

      tableBody.querySelectorAll(".qty-input").forEach(input => {
        input.addEventListener("change", async () => {
          const pid = parseInt(input.getAttribute("data-id"));
          const val = Math.max(1, parseInt(input.value) || 1);
          await window.WF_CART.updateQuantity(pid, val);
          renderCart();
        });
      });

      tableBody.querySelectorAll(".remove-item-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const pid = parseInt(btn.getAttribute("data-id"));
          await window.WF_CART.removeItem(pid);
          renderCart();
        });
      });
    }
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (confirm("Clear all items from your order cart?")) {
        await window.WF_CART.clearCart();
        renderCart();
      }
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      window.location.href = "checkout.html";
    });
  }

  window.addEventListener("cart-updated", renderCart);
  renderCart();
});
