/**
 * WareFlow Customer Commerce Platform — Home Page Logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  const categoriesContainer = document.getElementById("home-categories-grid");
  const recsContainer = document.getElementById("home-recommendations-grid");
  const recsBadge = document.getElementById("recs-explain-badge");
  const popularContainer = document.getElementById("home-popular-grid");

  // 1. Load Categories
  function renderCategories(cats) {
    if (!categoriesContainer || !cats || cats.length === 0) return;
    categoriesContainer.innerHTML = cats.slice(0, 6).map(c => `
      <a href="products.html?category_id=${c.id}" class="category-card">
        <span class="category-card-name">${c.name}</span>
        <span class="category-card-count">${c.product_count} items</span>
      </a>
    `).join("");
  }

  try {
    const cats = await window.CustomerAPI.catalog.getCategories();
    if (cats && cats.length > 0) {
      renderCategories(cats);
    } else if (window.WF_DEMO_DATA) {
      renderCategories(window.WF_DEMO_DATA.categories);
    }
  } catch (err) {
    console.warn("Error loading categories, using offline demo categories:", err);
    if (window.WF_DEMO_DATA) {
      renderCategories(window.WF_DEMO_DATA.categories);
    }
  }

  // Helper to render product card HTML
  function renderProductCard(p, reason = null) {
    const inStock = p.is_in_stock || (p.available_stock > 0);
    const stockBadge = p.is_demo_sample
      ? `<span class="badge product-stock-tag" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; font-weight:600;">Demo Item • No Live Stock</span>`
      : (inStock
        ? `<span class="badge badge-success product-stock-tag">In Stock (${p.available_stock})</span>`
        : `<span class="badge badge-warning product-stock-tag">Backorder / RFQ</span>`);

    let priceHtml;
    if (p.price_display) {
      priceHtml = `<div class="price-value">${p.price_display}</div><div class="price-unit">per ${p.unit || 'unit'}</div>`;
    } else if (p.price && p.price > 0) {
      const formatted = Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      priceHtml = `<div class="price-value">₹${formatted}</div><div class="price-unit">per ${p.unit || 'unit'}</div>`;
    } else {
      priceHtml = `<div class="price-rfq">Price on Request</div><div class="price-unit">Request Quote</div>`;
    }

    return `
      <div class="product-card" data-id="${p.id}">
        <div class="product-image-wrap">
          ${stockBadge}
          <span class="product-sku-tag">${p.sku}</span>
          ${p.image_url 
            ? `<img src="${p.image_url}" alt="${p.name}">` 
            : `<div class="product-fallback-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
               </div>`
          }
        </div>
        <div class="product-content">
          ${reason ? `<div class="rec-explain-tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg> ${reason}</div>` : ''}
          <div class="product-category-name">${p.category || 'General'}</div>
          <h3 class="product-title"><a href="product-detail.html?id=${p.id}">${p.name}</a></h3>
          <div class="product-specs">
            ${p.storage_requirements ? `Storage: ${p.storage_requirements} • ` : ''}Min order: ${p.min_order_qty || 1} ${p.unit || 'pcs'}
          </div>
          <div class="product-footer">
            <div class="product-price-block">
              ${priceHtml}
            </div>
            <div style="display:flex; gap:6px;">
              <a href="product-detail.html?id=${p.id}" class="btn btn-secondary btn-sm">Details</a>
              <button class="btn btn-primary btn-sm add-cart-btn" data-id="${p.id}" data-name="${p.name}" data-sku="${p.sku}" data-price="${p.price || 0}" data-stock="${p.available_stock || 0}">
                + Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindAddCartButtons(container) {
    if (!container) return;
    container.querySelectorAll(".add-cart-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const p = {
          id: parseInt(btn.getAttribute("data-id")),
          name: btn.getAttribute("data-name"),
          sku: btn.getAttribute("data-sku"),
          price: parseFloat(btn.getAttribute("data-price")),
          available_stock: parseInt(btn.getAttribute("data-stock"))
        };
        btn.disabled = true;
        btn.textContent = "Adding...";
        try {
          await window.WF_CART.addItem(p, 1);
          btn.textContent = "Added ✓";
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "+ Cart";
          }, 1500);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = "+ Cart";
          if (window.CustomerAPI) window.CustomerAPI.showToast(err.message || "Failed to add", "error");
        }
      });
    });
  }

  function useDemoRecommendations() {
    if (!recsContainer || !window.WF_DEMO_DATA) return;
    if (recsBadge) {
      recsBadge.textContent = "Offline Preview • Demo Catalog Showcase";
      recsBadge.className = "badge badge-neutral";
    }
    const sampleRecs = window.WF_DEMO_DATA.products.slice(0, 4);
    recsContainer.innerHTML = sampleRecs.map(p => renderProductCard(p, "Demonstration Showcase SKU")).join("");
    bindAddCartButtons(recsContainer);
  }

  function useDemoPopular() {
    if (!popularContainer || !window.WF_DEMO_DATA) return;
    const samplePopular = window.WF_DEMO_DATA.products.slice(0, 8);
    popularContainer.innerHTML = samplePopular.map(p => renderProductCard(p)).join("");
    bindAddCartButtons(popularContainer);
  }

  // 2. Load ML Recommendations
  try {
    const recs = await window.CustomerAPI.recommendations.getRecommendations(8);
    if (recsContainer && recs && recs.recommendations && recs.recommendations.length > 0) {
      if (recsBadge) {
        if (recs.source === "personalized_hybrid") {
          recsBadge.textContent = "Personalized • Tailored to your interaction history";
        } else if (recs.source === "cold_start_popular") {
          recsBadge.textContent = "Warehouse Selection • Most procured items";
        } else {
          recsBadge.textContent = "Suggested for you";
        }
      }
      recsContainer.innerHTML = recs.recommendations.map(r => renderProductCard(r, r.reason)).join("");
      bindAddCartButtons(recsContainer);
    } else {
      useDemoRecommendations();
    }
  } catch (err) {
    console.warn("Could not load recommendations, using demo showcase:", err);
    useDemoRecommendations();
  }

  // 3. Load Popular / Ready-to-Ship Products
  try {
    const prods = await window.CustomerAPI.catalog.getProducts({ sort_by: "popular", in_stock_only: true, limit: 8 });
    if (popularContainer && prods && prods.items && prods.items.length > 0) {
      popularContainer.innerHTML = prods.items.map(p => renderProductCard(p)).join("");
      bindAddCartButtons(popularContainer);
    } else {
      useDemoPopular();
    }
  } catch (err) {
    console.warn("Could not load catalogue products, using demo showcase:", err);
    useDemoPopular();
  }
});
