/**
 * WareFlow Customer Commerce Platform — Header & Footer Component
 */
(function() {
  function renderHeader() {
    const headerEl = document.getElementById("site-header");
    if (!headerEl) return;

    const isAuth = window.WF_AUTH && window.WF_AUTH.isAuthenticated();
    const user = isAuth ? window.WF_AUTH.getUser() : null;
    const userName = user ? (user.name || user.email.split("@")[0]) : "Account";

    headerEl.innerHTML = `
      <div class="portal-demo-banner" style="background:#0c1f15; color:#e2e8f0; border-bottom:1px solid rgba(255,255,255,0.12); padding:7px 0; font-size:12px; line-height:1.4;">
        <div class="container" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:rgba(52,211,153,0.18); color:#6ee7b7; border:1px solid rgba(52,211,153,0.35); padding:2px 7px; border-radius:12px; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">Offline Demo Preview</span>
            <span style="color:#cbd5e1;">Displaying sample products. Live stock allocation, checkout, customer auth &amp; ML ranking require the FastAPI backend.</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px; font-size:11px;">
            <span id="portal-backend-status-pill" style="display:inline-flex; align-items:center; gap:6px; color:#94a3b8;" title="Checks connectivity to FastAPI backend">
              <span id="portal-backend-dot" style="width:7px; height:7px; border-radius:50%; background:#f59e0b; display:inline-block;"></span>
              <span id="portal-backend-status-text">Checking backend...</span>
            </span>
            <a href="../index.html" style="color:#6ee7b7; text-decoration:underline; font-weight:600;">Staff Portal &rarr;</a>
          </div>
        </div>
      </div>
      <div class="top-bar">
        <div class="container top-bar-inner">
          <div class="top-bar-notice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span>Direct Warehouse Fulfilment • ISO 9001 Certified Quality</span>
          </div>
          <div class="top-bar-links">
            <a href="bulk-order.html">Bulk Orders (CSV)</a>
            <a href="account.html">Customer Support</a>
            ${isAuth ? `<a href="#" id="top-logout-btn">Sign Out</a>` : `<a href="login.html">Sign In</a>`}
          </div>
        </div>
      </div>
      <div class="container">
        <div class="navbar-main">
          <a href="index.html" class="brand-logo">
            <div class="brand-icon">W</div>
            <div class="brand-text">
              <span class="brand-name">WareFlow</span>
              <span class="brand-tag">Commerce Direct</span>
            </div>
          </a>

          <div class="header-search">
            <div class="search-input-wrap">
              <div class="search-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <input type="text" id="header-search-input" class="search-input" placeholder="Search by product name, SKU, or specification..." autocomplete="off">
            </div>
            <div id="header-search-dropdown" class="search-dropdown"></div>
          </div>

          <div class="header-actions">
            <a href="products.html" class="nav-link desktop-only">Catalogue</a>
            <a href="bulk-order.html" class="nav-link desktop-only">Bulk Order</a>
            
            ${isAuth ? `
              <a href="orders.html" class="nav-link desktop-only">My Orders</a>
              <a href="account.html" class="nav-link desktop-only">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${userName}
              </a>
            ` : `
              <a href="login.html" class="nav-link desktop-only">Sign In</a>
            `}

            <a href="cart.html" class="cart-button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
              <span>Cart</span>
              <span id="nav-cart-badge" class="cart-badge">0</span>
            </a>

            <button type="button" id="mobile-menu-btn" class="mobile-nav-toggle" aria-label="Toggle navigation menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <div id="drawer-backdrop" class="drawer-backdrop"></div>
      <div id="mobile-drawer" class="mobile-drawer">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-weight:700; font-size:18px;">Navigation</span>
          <button id="drawer-close-btn" style="background:none; border:none; cursor:pointer;">✕</button>
        </div>
        <a href="index.html" class="nav-link">Home Storefront</a>
        <a href="products.html" class="nav-link">Full Catalogue</a>
        <a href="bulk-order.html" class="nav-link">Bulk Order / CSV</a>
        <a href="cart.html" class="nav-link">Cart & Checkout</a>
        ${isAuth ? `
          <a href="orders.html" class="nav-link">My Orders</a>
          <a href="account.html" class="nav-link">Account Profile</a>
          <a href="#" id="mobile-logout-btn" class="nav-link" style="color:#c92a2a;">Sign Out</a>
        ` : `
          <a href="login.html" class="btn btn-primary btn-block">Sign In</a>
          <a href="register.html" class="btn btn-outline btn-block">Register Business</a>
        `}
      </div>
    `;

    bindHeaderEvents();
    updateCartBadge();
  }

  function bindHeaderEvents() {
    const searchInput = document.getElementById("header-search-input");
    const dropdown = document.getElementById("header-search-dropdown");

    let debounceTimer = null;
    if (searchInput && dropdown) {
      searchInput.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        clearTimeout(debounceTimer);
        if (val.length < 2) {
          dropdown.classList.remove("active");
          dropdown.innerHTML = "";
          return;
        }

        debounceTimer = setTimeout(async () => {
          let items = [];
          try {
            const res = await window.CustomerAPI.catalog.getProducts({ search: val, limit: 5 });
            if (res && res.items && res.items.length > 0) {
              items = res.items;
            } else if (window.WF_DEMO_DATA) {
              const demoRes = window.WF_DEMO_DATA.getFilteredProducts({ search: val, limit: 5 });
              items = demoRes.items;
            }
          } catch (err) {
            if (window.WF_DEMO_DATA) {
              const demoRes = window.WF_DEMO_DATA.getFilteredProducts({ search: val, limit: 5 });
              items = demoRes.items;
            }
          }

          if (items && items.length > 0) {
            dropdown.innerHTML = items.map(it => {
              const priceDisplay = it.price_display || (it.price ? '₹' + Number(it.price).toLocaleString('en-IN', {minimumFractionDigits: 2}) : 'Price on Request');
              const demoLabel = it.is_demo_sample ? ' • Demo Item' : '';
              return `
                <div class="search-suggestion-item" data-id="${it.id}">
                  <div>
                    <div class="search-suggestion-title">${it.name}</div>
                    <div class="search-suggestion-meta">SKU: ${it.sku} • ${it.category || 'General'}${demoLabel}</div>
                  </div>
                  <div style="font-weight:600; font-size:13px; color:var(--color-brand-primary);">
                    ${priceDisplay}
                  </div>
                </div>
              `;
            }).join("");
            dropdown.classList.add("active");

            dropdown.querySelectorAll(".search-suggestion-item").forEach(el => {
              el.addEventListener("click", () => {
                const pid = el.getAttribute("data-id");
                if (window.WF_TRACKER) {
                  window.WF_TRACKER.trackSearchClick(pid, val);
                }
                window.location.href = `product-detail.html?id=${pid}`;
              });
            });
          } else {
            dropdown.innerHTML = `<div style="padding:12px 16px; font-size:13px; color:#6b7280;">No products matching "${val}"</div>`;
            dropdown.classList.add("active");
          }
        }, 250);
      });

      // Close dropdown on outside click
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".header-search")) {
          dropdown.classList.remove("active");
        }
      });
    }

    // Top logout
    const logoutBtn = document.getElementById("top-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.WF_AUTH.logout();
      });
    }

    const mobileLogout = document.getElementById("mobile-logout-btn");
    if (mobileLogout) {
      mobileLogout.addEventListener("click", (e) => {
        e.preventDefault();
        window.WF_AUTH.logout();
      });
    }

    // Mobile drawer toggle
    const menuBtn = document.getElementById("mobile-menu-btn");
    const drawer = document.getElementById("mobile-drawer");
    const backdrop = document.getElementById("drawer-backdrop");
    const closeBtn = document.getElementById("drawer-close-btn");

    if (menuBtn && drawer && backdrop) {
      menuBtn.addEventListener("click", () => {
        drawer.classList.add("active");
        backdrop.classList.add("active");
      });
      const close = () => {
        drawer.classList.remove("active");
        backdrop.classList.remove("active");
      };
      backdrop.addEventListener("click", close);
      if (closeBtn) closeBtn.addEventListener("click", close);
    }

    checkBackendConnectivity();
  }

  async function checkBackendConnectivity() {
    const dot = document.getElementById("portal-backend-dot");
    const text = document.getElementById("portal-backend-status-text");
    if (!dot || !text) return;

    try {
      const baseUrl = window.WF_CONFIG ? window.WF_CONFIG.getApiBaseUrl() : "http://localhost:8000/api";
      const healthUrl = baseUrl.replace(/\/api\/?$/, "/api/health");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(healthUrl, { method: "GET", signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        dot.style.background = "#10b981";
        text.textContent = "Backend: Connected";
        text.style.color = "#a7f3d0";
      } else {
        dot.style.background = "#f59e0b";
        text.textContent = "Backend: Offline (Demo Mode)";
      }
    } catch {
      dot.style.background = "#f59e0b";
      text.textContent = "Backend: Offline (Demo Mode)";
    }
  }

  async function updateCartBadge() {
    const badge = document.getElementById("nav-cart-badge");
    if (!badge || !window.WF_CART) return;
    try {
      const count = await window.WF_CART.getBadgeCount();
      badge.textContent = count || "0";
    } catch {
      badge.textContent = "0";
    }
  }

  function renderFooter() {
    const footerEl = document.getElementById("site-footer");
    if (!footerEl) return;

    footerEl.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand-title">WareFlow Commerce</div>
            <p style="margin-bottom:16px; line-height:1.6; max-width:320px;">
              Enterprise procurement platform connected directly to WareFlow warehouse distribution infrastructure. Real-time inventory transparency, automated fulfillment, and AI personalization.
            </p>
            <div style="font-size:12px; color:#9ca3af;">
              Facility: Apex Distribution Center Hub 1<br>
              Direct Order Desk: dispatch@wareflow.demo
            </div>
          </div>
          <div>
            <div class="footer-col-title">Catalogue</div>
            <ul class="footer-links">
              <li><a href="products.html">All Products</a></li>
              <li><a href="products.html?in_stock_only=true">In-Stock Stockpile</a></li>
              <li><a href="bulk-order.html">Multi-SKU Bulk Order</a></li>
              <li><a href="products.html?category_id=1">Beverages & Cold Storage</a></li>
              <li><a href="products.html?category_id=2">Dry Pack & Snacks</a></li>
            </ul>
          </div>
          <div>
            <div class="footer-col-title">Account</div>
            <ul class="footer-links">
              <li><a href="orders.html">Order Tracking</a></li>
              <li><a href="cart.html">View Cart</a></li>
              <li><a href="account.html">Company Profile</a></li>
              <li><a href="login.html">Sign In</a></li>
              <li><a href="register.html">Register Account</a></li>
            </ul>
          </div>
          <div>
            <div class="footer-col-title">Fulfilment Assurance</div>
            <p style="font-size:13px; line-height:1.6; margin-bottom:12px;">
              All orders are picked directly from active warehouse positions with real-time stock reservations and automated warehouse job dispatch.
            </p>
            <div style="font-size:12px; color:#34d399; font-weight:600;">
              ✓ Authoritative stock reservation guaranteed at checkout
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <div>© ${new Date().getFullYear()} WareFlow Logistics & Distribution. All rights reserved.</div>
          <div style="display:flex; gap:16px;">
            <a href="#" style="color:#9ca3af;">Terms of Sale</a>
            <a href="#" style="color:#9ca3af;">Privacy Policy</a>
            <a href="#" style="color:#9ca3af;">Warehouse SLA</a>
          </div>
        </div>
      </div>
    `;
  }

  // Listen for cart and auth update events
  window.addEventListener("cart-updated", updateCartBadge);
  window.addEventListener("customer-auth-changed", () => {
    renderHeader();
  });

  document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderFooter();
  });
})();
