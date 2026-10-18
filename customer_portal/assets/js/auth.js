/**
 * WareFlow Customer Commerce Platform — Authentication State Handler
 */
(function() {
  const TOKEN_KEY = window.WF_CONFIG.TOKEN_KEY;
  const USER_KEY = window.WF_CONFIG.USER_KEY;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isAuthenticated() {
    return Boolean(getToken());
  }

  async function syncGuestCartOnLogin() {
    const guestCart = window.WF_CART ? window.WF_CART.getLocalCart() : [];
    if (guestCart && guestCart.length > 0) {
      const itemsToSync = guestCart.map(it => ({
        product_id: it.product_id,
        quantity: it.quantity
      }));
      try {
        await window.CustomerAPI.cart.syncCart(itemsToSync);
        localStorage.removeItem(window.WF_CONFIG.CART_KEY);
      } catch (err) {
        console.warn("Could not sync guest cart to server:", err);
      }
    }
  }

  async function login(email, password, remember = true) {
    const res = await window.CustomerAPI.auth.login({ email, password });
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, res.access_token);
    storage.setItem(USER_KEY, JSON.stringify(res.user));

    await syncGuestCartOnLogin();
    window.dispatchEvent(new CustomEvent("customer-auth-changed", { detail: { user: res.user } }));
    return res;
  }

  async function register(payload) {
    const res = await window.CustomerAPI.auth.register(payload);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));

    await syncGuestCartOnLogin();
    window.dispatchEvent(new CustomEvent("customer-auth-changed", { detail: { user: res.user } }));
    return res;
  }

  function logout(redirect = "index.html") {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent("customer-auth-changed", { detail: { user: null } }));
    if (redirect) {
      window.location.href = redirect;
    }
  }

  function requireAuth(redirectUrl = "login.html") {
    if (!isAuthenticated()) {
      const returnUrl = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
      window.location.href = `${redirectUrl}?return_to=${returnUrl}`;
      return false;
    }
    return true;
  }

  window.WF_AUTH = {
    getToken,
    getUser,
    isAuthenticated,
    login,
    register,
    logout,
    requireAuth
  };
})();
