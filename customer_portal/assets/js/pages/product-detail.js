/**
 * WareFlow Customer Commerce Platform — Product Detail Page Logic
 */
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = parseInt(urlParams.get("id"));

  if (!productId) {
    window.location.href = "products.html";
    return;
  }

  // Track product view for ML
  if (window.WF_TRACKER) {
    window.WF_TRACKER.trackView(productId);
  }

  const container = document.getElementById("product-detail-container");
  const similarContainer = document.getElementById("similar-products-grid");

  try {
    let res = null;
    let p = null;
    let isDemoFallback = false;

    try {
      res = await window.CustomerAPI.catalog.getProductDetail(productId);
      p = res.product;
    } catch (fetchErr) {
      console.warn("Backend unavailable, checking demo catalogue for product detail:", fetchErr);
      if (window.WF_DEMO_DATA) {
        p = window.WF_DEMO_DATA.getProductById(productId);
        if (p) {
          isDemoFallback = true;
          res = {
            product: p,
            similar_products: window.WF_DEMO_DATA.products
              .filter(item => item.id !== p.id && item.category_id === p.category_id)
              .slice(0, 3)
              .map(item => ({
                id: item.id,
                name: item.name,
                sku: item.sku,
                price: item.price,
                price_display: item.price_display,
                reason: "Category Match (Demo Showcase)",
                image_url: item.image_url
              }))
          };
        }
      }
      if (!p) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#c92a2a;">Failed to load product specifications: ${fetchErr.message}</div>`;
        return;
      }
    }

  const inStock = p.is_in_stock || (p.available_stock > 0);
  const minQty = p.min_order_qty || 1;

  document.title = `${p.name} — WareFlow Commerce`;

  const stockPill = (p.is_demo_sample || isDemoFallback)
    ? `<span class="badge" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; font-size:13px; padding:4px 10px; font-weight:600;">⚠ Demonstration Showcase SKU — No Live Stock Allocation</span>`
    : (inStock
      ? `<span class="badge badge-success" style="font-size:13px; padding:4px 10px;">✓ In Stock — ${p.available_stock} Units Ready for Dispatch</span>`
      : `<span class="badge badge-warning" style="font-size:13px; padding:4px 10px;">⚠ Out of Stock / Request Quote</span>`);

  let priceHtml;
  if (p.price_display) {
    priceHtml = `<span class="detail-price-num">${p.price_display}</span> <span style="color:#6b7280; font-size:14px;">per ${p.unit || 'unit'} (excl. tax)</span>`;
  } else if (p.price && p.price > 0) {
    const formatted = Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    priceHtml = `<span class="detail-price-num">₹${formatted}</span> <span style="color:#6b7280; font-size:14px;">per ${p.unit || 'unit'} (excl. tax)</span>`;
  } else {
    priceHtml = `<span class="detail-price-num" style="color:#6b21a8; font-size:24px;">Price on Request</span> <span class="badge badge-rfq">B2B Quote</span>`;
  }

    container.innerHTML = `
      <div class="product-detail-media">
        <div class="detail-main-image">
          ${p.image_url 
            ? `<img src="${p.image_url}" alt="${p.name}">` 
            : `<div style="text-align:center; color:#9ca3af;">
                <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                <div style="font-size:13px; margin-top:8px;">Standard Logistics Pack</div>
               </div>`
          }
        </div>
      </div>

      <div class="product-detail-info">
        <div class="detail-category-badge">${p.category || 'General Cargo'}</div>
        <h1 class="detail-title">${p.name}</h1>
        <div class="detail-sku">SKU Identifier: <strong>${p.sku}</strong></div>
        <div style="margin-bottom:16px;">${stockPill}</div>

        <div class="detail-price-box">
          ${priceHtml}
        </div>

        <div style="font-size:14px; line-height:1.6; color:var(--color-text-secondary); margin-bottom:20px;">
          ${p.description || 'Warehouse verified industrial SKU. Sourced, verified, and allocated according to active WareFlow facility handling procedures.'}
        </div>

        <!-- Specifications Table -->
        <table class="detail-specs-table">
          <tbody>
            <tr>
              <td>Packaging Unit</td>
              <td>${p.unit || 'Pieces (pcs)'}</td>
            </tr>
            <tr>
              <td>Minimum Order Qty</td>
              <td>${minQty} ${p.unit || 'pcs'}</td>
            </tr>
            <tr>
              <td>Storage Requirements</td>
              <td>${p.storage_requirements || 'Standard Dry Ambient'}</td>
            </tr>
            ${p.weight ? `<tr><td>Unit Weight</td><td>${p.weight} kg</td></tr>` : ''}
            ${p.dimensions ? `<tr><td>Package Dimensions</td><td>${p.dimensions}</td></tr>` : ''}
          </tbody>
        </table>

        <!-- Action / Quantity Controls -->
        <div class="detail-action-bar">
          <div class="quantity-stepper">
            <button type="button" class="stepper-btn" id="qty-minus">-</button>
            <input type="number" id="detail-qty-input" class="stepper-input" value="${minQty}" min="${minQty}" max="${inStock ? p.available_stock : 9999}">
            <button type="button" class="stepper-btn" id="qty-plus">+</button>
          </div>

          <button id="detail-add-cart-btn" class="btn btn-primary btn-lg" style="flex:1;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            Add to Order Cart
          </button>
        </div>
      </div>
    `;

    // Quantity stepper
    const qtyInput = document.getElementById("detail-qty-input");
    const minusBtn = document.getElementById("qty-minus");
    const plusBtn = document.getElementById("qty-plus");
    const addBtn = document.getElementById("detail-add-cart-btn");

    minusBtn.addEventListener("click", () => {
      let val = parseInt(qtyInput.value) || minQty;
      if (val > minQty) qtyInput.value = val - 1;
    });

    plusBtn.addEventListener("click", () => {
      let val = parseInt(qtyInput.value) || minQty;
      const maxLimit = inStock ? p.available_stock : 9999;
      if (val < maxLimit) qtyInput.value = val + 1;
    });

    addBtn.addEventListener("click", async () => {
      const qty = parseInt(qtyInput.value) || minQty;
      addBtn.disabled = true;
      addBtn.textContent = "Reserving...";
      try {
        await window.WF_CART.addItem(p, qty);
        addBtn.textContent = "Added to Cart ✓";
        setTimeout(() => {
          addBtn.disabled = false;
          addBtn.textContent = "Add to Order Cart";
        }, 1500);
      } catch (err) {
        addBtn.disabled = false;
        addBtn.textContent = "Add to Order Cart";
        if (window.CustomerAPI) window.CustomerAPI.showToast(err.message || "Failed to add", "error");
      }
    });

    // Similar products
    if (similarContainer && res.similar_products && res.similar_products.length > 0) {
      similarContainer.innerHTML = res.similar_products.map(sim => `
        <div class="product-card" data-id="${sim.id}">
          <div class="product-image-wrap">
            <span class="product-sku-tag">${sim.sku}</span>
            ${sim.image_url 
              ? `<img src="${sim.image_url}" alt="${sim.name}">` 
              : `<div class="product-fallback-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg></div>`
            }
          </div>
          <div class="product-content">
            <div class="rec-explain-tag">${sim.reason}</div>
            <h3 class="product-title" style="font-size:14px;"><a href="product-detail.html?id=${sim.id}">${sim.name}</a></h3>
            <div class="product-footer">
              <span style="font-weight:700;">${sim.price_display}</span>
              <a href="product-detail.html?id=${sim.id}" class="btn btn-outline btn-sm">View</a>
            </div>
          </div>
        </div>
      `).join("");
    } else if (similarContainer) {
      similarContainer.innerHTML = `<div style="grid-column:1/-1; color:#9ca3af; font-size:13px;">No complementary items found.</div>`;
    }

  } catch (err) {
    container.innerHTML = `<div style="padding:40px; text-align:center; color:#c92a2a;">Failed to load product specifications: ${err.message}</div>`;
  }
});
