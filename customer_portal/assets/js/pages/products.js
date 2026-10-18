/**
 * WareFlow Customer Commerce Platform — Products Catalogue Page Logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  let currentPage = parseInt(urlParams.get("page") || "1");
  let currentCategory = urlParams.get("category_id") || "";
  let currentSearch = urlParams.get("search") || "";
  let inStockOnly = urlParams.get("in_stock_only") === "true";
  let sortBy = urlParams.get("sort_by") || "popular";

  const searchInput = document.getElementById("catalog-search-input");
  const sortSelect = document.getElementById("catalog-sort-select");
  const inStockCheckbox = document.getElementById("catalog-instock-toggle");
  const categoryFiltersContainer = document.getElementById("category-filters-list");
  const productsGrid = document.getElementById("catalog-products-grid");
  const totalCountEl = document.getElementById("catalog-total-count");
  const paginationContainer = document.getElementById("catalog-pagination");

  if (searchInput && currentSearch) searchInput.value = currentSearch;
  if (sortSelect) sortSelect.value = sortBy;
  if (inStockCheckbox) inStockCheckbox.checked = inStockOnly;

  // Load category sidebar
  function renderCategories(cats) {
    if (!categoryFiltersContainer || !cats) return;
    categoryFiltersContainer.innerHTML = `
      <label class="filter-checkbox-label">
        <input type="radio" name="cat-filter" value="" ${!currentCategory ? 'checked' : ''}>
        <span>All Categories</span>
      </label>
      ${cats.map(c => `
        <label class="filter-checkbox-label">
          <input type="radio" name="cat-filter" value="${c.id}" ${currentCategory == c.id ? 'checked' : ''}>
          <span>${c.name} (${c.product_count})</span>
        </label>
      `).join("")}
    `;

    categoryFiltersContainer.querySelectorAll("input[name='cat-filter']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        currentCategory = e.target.value;
        currentPage = 1;
        updateUrlAndLoad();
      });
    });
  }

  try {
    const cats = await window.CustomerAPI.catalog.getCategories();
    if (cats && cats.length > 0) {
      renderCategories(cats);
    } else if (window.WF_DEMO_DATA) {
      renderCategories(window.WF_DEMO_DATA.categories);
    }
  } catch (err) {
    console.warn("Error loading categories from backend, using demo categories:", err);
    if (window.WF_DEMO_DATA) {
      renderCategories(window.WF_DEMO_DATA.categories);
    }
  }

  function updateUrlAndLoad() {
    const p = new URLSearchParams();
    if (currentSearch) p.set("search", currentSearch);
    if (currentCategory) p.set("category_id", currentCategory);
    if (inStockOnly) p.set("in_stock_only", "true");
    if (sortBy) p.set("sort_by", sortBy);
    if (currentPage > 1) p.set("page", currentPage);

    window.history.pushState({}, "", `${window.location.pathname}?${p.toString()}`);
    loadProducts();
  }

  async function loadProducts() {
    if (!productsGrid) return;
    productsGrid.innerHTML = `<div style="grid-column:1/-1; padding:40px; text-align:center; color:#6b7280;">Loading products from warehouse...</div>`;

    let res = null;
    let isDemoFallback = false;

    try {
      res = await window.CustomerAPI.catalog.getProducts({
        search: currentSearch,
        category_id: currentCategory,
        in_stock_only: inStockOnly,
        sort_by: sortBy,
        page: currentPage,
        limit: 16
      });
    } catch (err) {
      console.warn("Backend unavailable, falling back to demo catalog:", err);
      if (window.WF_DEMO_DATA) {
        res = window.WF_DEMO_DATA.getFilteredProducts({
          search: currentSearch,
          category_id: currentCategory,
          in_stock_only: inStockOnly,
          sort_by: sortBy,
          page: currentPage,
          limit: 16
        });
        isDemoFallback = true;
      } else {
        productsGrid.innerHTML = `<div style="grid-column:1/-1; padding:40px; text-align:center; color:#c92a2a;">Error loading products: ${err.message}</div>`;
        return;
      }
    }

    if (totalCountEl) {
      if (isDemoFallback) {
        totalCountEl.innerHTML = `<span style="color:#c2410c; background:#fff7ed; padding:3px 8px; border-radius:12px; font-size:12px; border:1px solid #fed7aa; margin-right:6px;">Offline Demo</span> ${res.total} sample items`;
      } else {
        totalCountEl.textContent = `${res.total} products available`;
      }
    }

    if (!res.items || res.items.length === 0) {
      productsGrid.innerHTML = `
        <div style="grid-column:1/-1; padding:60px 20px; text-align:center; background:#ffffff; border-radius:var(--radius-lg); border:1px solid var(--color-border-subtle);">
          <div style="font-size:18px; font-weight:700; margin-bottom:8px;">No matching products found</div>
          <p style="color:#6b7280; font-size:14px; margin-bottom:16px;">Try adjusting your keyword search, category filter, or inventory availability toggle.</p>
          <button id="reset-filters-btn" class="btn btn-outline btn-sm">Reset All Filters</button>
        </div>
      `;
      const resetBtn = document.getElementById("reset-filters-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          currentSearch = "";
          currentCategory = "";
          inStockOnly = false;
          sortBy = "popular";
          currentPage = 1;
          if (searchInput) searchInput.value = "";
          if (inStockCheckbox) inStockCheckbox.checked = false;
          if (sortSelect) sortSelect.value = "popular";
          updateUrlAndLoad();
        });
      }
      if (paginationContainer) paginationContainer.innerHTML = "";
      return;
    }

    productsGrid.innerHTML = res.items.map(p => {
      const isDemo = p.is_demo_sample || isDemoFallback;
      const inStock = p.is_in_stock || (p.available_stock > 0);
      const stockBadge = isDemo
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
                <a href="product-detail.html?id=${p.id}" class="btn btn-secondary btn-sm">Specs</a>
                <button class="btn btn-primary btn-sm add-cart-btn" data-id="${p.id}" data-name="${p.name}" data-sku="${p.sku}" data-price="${p.price || 0}" data-stock="${p.available_stock || 0}">
                  + Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Bind add to cart
    productsGrid.querySelectorAll(".add-cart-btn").forEach(btn => {
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

    renderPagination(res.page, res.total_pages);
  }

  function renderPagination(current, total) {
    if (!paginationContainer) return;
    if (total <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    let html = `<div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:32px;">`;
    if (current > 1) {
      html += `<button class="btn btn-secondary btn-sm page-btn" data-page="${current - 1}">← Previous</button>`;
    }

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - 2 && i <= current + 2)) {
        html += `<button class="btn ${i === current ? 'btn-primary' : 'btn-secondary'} btn-sm page-btn" data-page="${i}">${i}</button>`;
      } else if (i === current - 3 || i === current + 3) {
        html += `<span style="padding:0 4px; color:#9ca3af;">...</span>`;
      }
    }

    if (current < total) {
      html += `<button class="btn btn-secondary btn-sm page-btn" data-page="${current + 1}">Next →</button>`;
    }
    html += `</div>`;

    paginationContainer.innerHTML = html;
    paginationContainer.querySelectorAll(".page-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentPage = parseInt(btn.getAttribute("data-page"));
        updateUrlAndLoad();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  // Filter bindings
  let searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentSearch = e.target.value.trim();
        currentPage = 1;
        updateUrlAndLoad();
      }, 300);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      sortBy = e.target.value;
      currentPage = 1;
      updateUrlAndLoad();
    });
  }

  if (inStockCheckbox) {
    inStockCheckbox.addEventListener("change", (e) => {
      inStockOnly = e.target.checked;
      currentPage = 1;
      updateUrlAndLoad();
    });
  }

  // Initial load
  loadProducts();
});
