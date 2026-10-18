/**
 * WareFlow Customer Commerce Platform — Cart Manager
 */
(function() {
  const CART_KEY = window.WF_CONFIG.CART_KEY;

  function getLocalCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocalCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart-updated"));
  }

  async function getCart() {
    if (window.WF_AUTH && window.WF_AUTH.isAuthenticated()) {
      try {
        const serverCart = await window.CustomerAPI.cart.getCart();
        return serverCart;
      } catch (err) {
        console.warn("Error fetching server cart:", err);
      }
    }

    // Guest cart fallback
    const localItems = getLocalCart();
    let totalItems = 0;
    let subtotal = 0.0;
    let hasRfq = false;

    localItems.forEach(it => {
      totalItems += it.quantity;
      if (it.price && it.price > 0) {
        subtotal += it.price * it.quantity;
      } else {
        hasRfq = true;
      }
    });

    return {
      items: localItems,
      total_items: totalItems,
      subtotal: Math.round(subtotal * 100) / 100,
      has_rfq_items: hasRfq
    };
  }

  async function addItem(product, quantity = 1) {
    if (window.WF_TRACKER) {
      window.WF_TRACKER.trackAddToCart(product.id, quantity);
    }

    if (window.WF_AUTH && window.WF_AUTH.isAuthenticated()) {
      const updated = await window.CustomerAPI.cart.addItem(product.id, quantity);
      window.dispatchEvent(new CustomEvent("cart-updated"));
      if (window.CustomerAPI && window.CustomerAPI.showToast) {
        window.CustomerAPI.showToast(`Added ${quantity} × ${product.name} to cart`, "success");
      }
      return updated;
    }

    // Guest cart
    const items = getLocalCart();
    const existing = items.find(it => it.product_id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        id: Date.now(),
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit || "pcs",
        price: product.price,
        quantity: quantity,
        available_stock: product.available_stock || 0,
        is_available: true,
        line_total: product.price ? product.price * quantity : 0.0
      });
    }
    saveLocalCart(items);
    if (window.CustomerAPI && window.CustomerAPI.showToast) {
      window.CustomerAPI.showToast(`Added ${quantity} × ${product.name} to cart`, "success");
    }
    return getCart();
  }

  async function updateQuantity(productId, quantity) {
    if (window.WF_AUTH && window.WF_AUTH.isAuthenticated()) {
      const updated = await window.CustomerAPI.cart.addItem(productId, quantity);
      window.dispatchEvent(new CustomEvent("cart-updated"));
      return updated;
    }

    const items = getLocalCart();
    if (quantity <= 0) {
      const filtered = items.filter(it => it.product_id !== productId);
      saveLocalCart(filtered);
    } else {
      const target = items.find(it => it.product_id === productId);
      if (target) {
        target.quantity = quantity;
        target.line_total = target.price ? target.price * quantity : 0.0;
      }
      saveLocalCart(items);
    }
    return getCart();
  }

  async function removeItem(productId) {
    if (window.WF_AUTH && window.WF_AUTH.isAuthenticated()) {
      const updated = await window.CustomerAPI.cart.removeItem(productId);
      window.dispatchEvent(new CustomEvent("cart-updated"));
      return updated;
    }

    const items = getLocalCart();
    const filtered = items.filter(it => it.product_id !== productId);
    saveLocalCart(filtered);
    return getCart();
  }

  async function clearCart() {
    if (window.WF_AUTH && window.WF_AUTH.isAuthenticated()) {
      await window.CustomerAPI.cart.clearCart();
    }
    saveLocalCart([]);
  }

  async function getBadgeCount() {
    const cart = await getCart();
    return cart ? cart.total_items : 0;
  }

  window.WF_CART = {
    getLocalCart,
    getCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    getBadgeCount
  };
})();
