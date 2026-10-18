/**
 * WareFlow Customer Commerce Platform — Checkout Logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  // Check auth requirement
  if (!window.WF_AUTH.requireAuth("login.html")) {
    return;
  }

  const user = window.WF_AUTH.getUser();
  const addressInput = document.getElementById("checkout-address");
  const notesInput = document.getElementById("checkout-notes");
  const companyInput = document.getElementById("checkout-company");
  const phoneInput = document.getElementById("checkout-phone");
  const itemsContainer = document.getElementById("checkout-items-list");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const totalEl = document.getElementById("checkout-total");
  const placeOrderBtn = document.getElementById("place-order-btn");
  const formError = document.getElementById("checkout-error-box");

  // Load existing profile details
  try {
    const profile = await window.CustomerAPI.auth.getProfile();
    if (addressInput && profile.address) addressInput.value = profile.address;
    if (companyInput && profile.company_name) companyInput.value = profile.company_name;
    if (phoneInput && profile.phone) phoneInput.value = profile.phone;
  } catch (err) {
    console.warn("Could not prefill profile details:", err);
  }

  // Load cart items for review
  let cart = null;
  try {
    cart = await window.WF_CART.getCart();
    if (!cart || !cart.items || cart.items.length === 0) {
      window.location.href = "cart.html";
      return;
    }

    if (subtotalEl) subtotalEl.textContent = `₹${Number(cart.subtotal).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (totalEl) totalEl.textContent = `₹${Number(cart.subtotal).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    if (itemsContainer) {
      itemsContainer.innerHTML = cart.items.map(it => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--color-border-subtle); font-size:14px;">
          <div>
            <div style="font-weight:600;">${it.name}</div>
            <div style="font-size:12px; color:#6b7280;">SKU: ${it.sku} • Qty: ${it.quantity}</div>
          </div>
          <div style="font-weight:600;">
            ${it.price ? `₹${Number(it.line_total).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'RFQ'}
          </div>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Error loading checkout cart:", err);
  }

  // Order submission
  let isSubmitting = false;
  // Generate idempotency key for this checkout session
  const idempotencyKey = `WF-IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", async () => {
      if (isSubmitting) return;

      const address = addressInput ? addressInput.value.trim() : "";
      const notes = notesInput ? notesInput.value.trim() : "";
      const paymentMethod = document.querySelector("input[name='payment-method']:checked")?.value || "INVOICE";

      if (!address) {
        if (formError) {
          formError.textContent = "Please provide a valid delivery address or facility dock.";
          formError.style.display = "block";
        }
        addressInput?.focus();
        return;
      }

      if (formError) formError.style.display = "none";

      isSubmitting = true;
      placeOrderBtn.disabled = true;
      placeOrderBtn.innerHTML = `
        <span class="spinner" style="display:inline-block; width:14px; height:14px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:8px;"></span>
        Reserving Stock & Generating Order...
      `;

      try {
        const payload = {
          items: cart.items.map(it => ({
            product_id: it.product_id,
            sku: it.sku,
            quantity: it.quantity
          })),
          delivery_address: address,
          notes: notes,
          payment_method: paymentMethod,
          idempotency_key: idempotencyKey
        };

        const orderRes = await window.CustomerAPI.orders.createOrder(payload);

        // Clear client cart
        await window.WF_CART.clearCart();

        if (window.CustomerAPI) {
          window.CustomerAPI.showToast("Order confirmed! Stock successfully reserved.", "success");
        }

        // Redirect to order details
        window.location.href = `order-detail.html?id=${orderRes.id}&placed=true`;

      } catch (err) {
        isSubmitting = false;
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = "Confirm & Place Order";

        if (formError) {
          formError.textContent = err.message || "Failed to process order reservation. Please verify stock availability.";
          formError.style.display = "block";
        }
      }
    });
  }
});
