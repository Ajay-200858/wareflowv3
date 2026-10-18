/**
 * WareFlow Customer Commerce Platform — Interaction Tracker for ML Recommender
 */
(function() {
  function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
  }

  function getSessionId() {
    const key = window.WF_CONFIG ? window.WF_CONFIG.SESSION_KEY : "wf_customer_session_id";
    let sess = sessionStorage.getItem(key);
    if (!sess) {
      sess = generateSessionId();
      sessionStorage.setItem(key, sess);
    }
    return sess;
  }

  // In-memory 30s cache to avoid rapid duplicate event emissions from client side
  const recentEvents = new Map();

  function trackEvent(eventType, productId, eventValue = 1.0, metadata = null) {
    if (!productId) return;
    const cacheKey = `${eventType}_${productId}`;
    const now = Date.now();
    const lastTime = recentEvents.get(cacheKey) || 0;

    if (now - lastTime < 30000) {
      // Deduplicated within 30 seconds
      return;
    }

    recentEvents.set(cacheKey, now);

    if (window.CustomerAPI && window.CustomerAPI.events) {
      window.CustomerAPI.events.track(eventType, productId, eventValue, metadata);
    }
  }

  window.WF_TRACKER = {
    getSessionId,
    trackEvent,
    trackView: (pid) => trackEvent("view", pid),
    trackSearchClick: (pid, query) => trackEvent("search_click", pid, 2.0, { query }),
    trackAddToCart: (pid, qty = 1) => trackEvent("add_to_cart", pid, 3.0, { qty }),
    trackPurchase: (pid, qty = 1) => trackEvent("purchase", pid, 5.0, { qty })
  };
})();
