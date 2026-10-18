/**
 * WareFlow Customer Commerce Platform — Bulk Order Matrix & CSV Upload
 */
document.addEventListener("DOMContentLoaded", async () => {
  const tabManualBtn = document.getElementById("tab-manual-btn");
  const tabCsvBtn = document.getElementById("tab-csv-btn");
  const tabManualContent = document.getElementById("tab-manual-content");
  const tabCsvContent = document.getElementById("tab-csv-content");

  const matrixBody = document.getElementById("matrix-rows-body");
  const addRowBtn = document.getElementById("matrix-add-row-btn");
  const validateMatrixBtn = document.getElementById("matrix-validate-btn");
  const matrixValidationResult = document.getElementById("matrix-validation-result");
  const matrixActionBox = document.getElementById("matrix-action-box");
  const matrixSubmitBtn = document.getElementById("matrix-submit-btn");

  const downloadTemplateBtn = document.getElementById("download-template-btn");
  const csvFileInput = document.getElementById("csv-file-input");
  const csvDropzone = document.getElementById("csv-dropzone");
  const csvValidationResult = document.getElementById("csv-validation-result");
  const csvActionBox = document.getElementById("csv-action-box");
  const csvSubmitBtn = document.getElementById("csv-submit-btn");

  // Tab switching
  tabManualBtn.addEventListener("click", () => {
    tabManualBtn.classList.add("active");
    tabCsvBtn.classList.remove("active");
    tabManualContent.style.display = "block";
    tabCsvContent.style.display = "none";
  });

  tabCsvBtn.addEventListener("click", () => {
    tabCsvBtn.classList.add("active");
    tabManualBtn.classList.remove("active");
    tabCsvContent.style.display = "block";
    tabManualContent.style.display = "none";
  });

  // Pre-load active catalog SKUs for auto-suggest
  let availableProducts = [];
  try {
    const res = await window.CustomerAPI.catalog.getProducts({ limit: 100 });
    availableProducts = res.items || [];
  } catch (err) {
    console.warn("Could not pre-load catalog for auto-suggest:", err);
  }

  // --- TAB 1: Manual Multi-Row Matrix ---
  let rowCounter = 0;

  function addMatrixRow(sku = "", qty = 10) {
    rowCounter++;
    const tr = document.createElement("tr");
    tr.id = `matrix-row-${rowCounter}`;
    tr.innerHTML = `
      <td>
        <input type="text" class="form-input row-sku-input" placeholder="e.g. P-001" value="${sku}" list="sku-datalist">
      </td>
      <td>
        <input type="number" class="form-input row-qty-input" value="${qty}" min="1" style="width:120px;">
      </td>
      <td class="row-status-cell" style="font-size:13px; color:#6b7280;">
        Pending validation
      </td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm row-remove-btn">✕</button>
      </td>
    `;
    matrixBody.appendChild(tr);

    tr.querySelector(".row-remove-btn").addEventListener("click", () => {
      tr.remove();
      if (matrixBody.children.length === 0) {
        addMatrixRow();
      }
    });
  }

  // Populate datalist for SKU suggestions
  const datalist = document.createElement("datalist");
  datalist.id = "sku-datalist";
  datalist.innerHTML = availableProducts.map(p => `<option value="${p.sku}">${p.name} (${p.category || 'General'})</option>`).join("");
  document.body.appendChild(datalist);

  // Initialize with 3 rows
  if (matrixBody) {
    addMatrixRow("P-001", 10);
    addMatrixRow("P-002", 20);
    addMatrixRow("", 10);
  }

  if (addRowBtn) {
    addRowBtn.addEventListener("click", () => addMatrixRow());
  }

  // Matrix Validation
  let validatedMatrixRows = [];

  if (validateMatrixBtn) {
    validateMatrixBtn.addEventListener("click", async () => {
      const rows = [];
      const trs = matrixBody.querySelectorAll("tr");

      trs.forEach((tr, idx) => {
        const sku = tr.querySelector(".row-sku-input").value.trim();
        const qty = parseInt(tr.querySelector(".row-qty-input").value) || 0;
        if (sku) {
          rows.push({ sku, quantity: qty, trElement: tr, rowIndex: idx + 1 });
        }
      });

      if (rows.length === 0) {
        if (window.CustomerAPI) window.CustomerAPI.showToast("Please enter at least one SKU to validate", "warning");
        return;
      }

      validateMatrixBtn.disabled = true;
      validateMatrixBtn.textContent = "Checking Warehouse Stock...";

      try {
        const checkPayload = rows.map(r => ({ sku: r.sku, quantity: r.quantity }));
        const res = await window.CustomerAPI.orders.validate(checkPayload);

        validatedMatrixRows = res.rows;

        // Apply row-level status
        rows.forEach((r, idx) => {
          const v = res.rows[idx];
          const cell = r.trElement.querySelector(".row-status-cell");
          if (v && v.valid) {
            cell.innerHTML = `
              <span style="color:var(--color-status-success); font-weight:600;">✓ Valid</span>: 
              ${v.name} • Price: ${v.unit_price ? `$${v.unit_price}` : 'RFQ'} • Available: ${v.available_quantity}
            `;
          } else if (v) {
            cell.innerHTML = `<span style="color:var(--color-status-error); font-weight:600;">✗ ${v.error}</span>`;
          }
        });

        // Summary box
        matrixValidationResult.style.display = "block";
        if (res.can_checkout) {
          matrixValidationResult.className = "badge badge-success";
          matrixValidationResult.innerHTML = `
            ✓ All ${res.total_valid_items} SKUs successfully validated against real inventory. Estimated Subtotal: $${res.estimated_total.toFixed(2)}.
          `;
          matrixActionBox.style.display = "block";
        } else {
          matrixValidationResult.className = "badge badge-error";
          matrixValidationResult.innerHTML = `
            ⚠ One or more SKUs are invalid, duplicate, or have insufficient stock. Please resolve row errors above.
          `;
          matrixActionBox.style.display = "none";
        }

      } catch (err) {
        if (window.CustomerAPI) window.CustomerAPI.showToast(err.message, "error");
      } finally {
        validateMatrixBtn.disabled = false;
        validateMatrixBtn.textContent = "Validate Rows against Warehouse Stock";
      }
    });
  }

  // Matrix Add to Cart / Checkout
  if (matrixSubmitBtn) {
    matrixSubmitBtn.addEventListener("click", async () => {
      const validItems = validatedMatrixRows.filter(r => r.valid);
      if (validItems.length === 0) return;

      matrixSubmitBtn.disabled = true;
      matrixSubmitBtn.textContent = "Adding Validated Rows to Cart...";

      try {
        for (const it of validItems) {
          await window.WF_CART.addItem({
            id: it.product_id,
            sku: it.sku,
            name: it.name,
            price: it.unit_price,
            available_stock: it.available_quantity
          }, it.requested_quantity);
        }
        window.location.href = "cart.html";
      } catch (err) {
        matrixSubmitBtn.disabled = false;
        matrixSubmitBtn.textContent = "Add Validated Rows to Cart & Proceed →";
        if (window.CustomerAPI) window.CustomerAPI.showToast(err.message, "error");
      }
    });
  }

  // --- TAB 2: CSV Upload & Validation Preview ---

  // Template download
  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener("click", () => {
      const csvContent = "sku,quantity\nP-001,10\nP-002,25\n";
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "wareflow_bulk_order_template.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  }

  // Dropzone drag-and-drop
  if (csvDropzone && csvFileInput) {
    csvDropzone.addEventListener("click", () => csvFileInput.click());

    ["dragenter", "dragover"].forEach(eventName => {
      csvDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        csvDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(eventName => {
      csvDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        csvDropzone.classList.remove("dragover");
      });
    });

    csvDropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleCsvFile(e.dataTransfer.files[0]);
      }
    });

    csvFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleCsvFile(e.target.files[0]);
      }
    });
  }

  let validatedCsvRows = [];

  async function handleCsvFile(file) {
    if (!file.name.endsWith(".csv")) {
      if (window.CustomerAPI) window.CustomerAPI.showToast("Only .csv files are supported", "error");
      return;
    }

    csvValidationResult.style.display = "block";
    csvValidationResult.innerHTML = `<div style="padding:20px; text-align:center; color:#6b7280;">Validating CSV against live warehouse database...</div>`;

    try {
      const res = await window.CustomerAPI.orders.previewBulkCsv(file);
      validatedCsvRows = res.rows;

      let html = `
        <div class="card" style="margin-top:20px;">
          <div class="card-header" style="background:${res.can_checkout ? 'var(--color-brand-light)' : 'var(--color-status-error-bg)'};">
            <span class="card-title">CSV Validation Summary (${file.name})</span>
            <span class="badge ${res.can_checkout ? 'badge-success' : 'badge-error'}">
              ${res.can_checkout ? 'Ready for Confirmation' : 'Action Required'}
            </span>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Qty Requested</th>
                  <th>Available Stock</th>
                  <th>Estimated Price</th>
                  <th>Validation Status</th>
                </tr>
              </thead>
              <tbody>
                ${res.rows.map(r => `
                  <tr style="${!r.valid ? 'background:#fff5f5;' : ''}">
                    <td>#${r.row_index}</td>
                    <td><strong style="font-family:var(--font-family-mono);">${r.sku}</strong></td>
                    <td>${r.name || 'Unknown Item'}</td>
                    <td>${r.requested_quantity}</td>
                    <td>${r.available_quantity}</td>
                    <td>${r.line_total ? `$${r.line_total.toFixed(2)}` : 'RFQ'}</td>
                    <td>
                      ${r.valid 
                        ? `<span class="badge badge-success">✓ Eligible</span>` 
                        : `<span class="badge badge-error">✗ ${r.error}</span>`
                      }
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;

      csvValidationResult.innerHTML = html;

      if (res.can_checkout) {
        csvActionBox.style.display = "block";
      } else {
        csvActionBox.style.display = "none";
      }

    } catch (err) {
      csvValidationResult.innerHTML = `
        <div class="badge badge-error" style="width:100%; padding:14px; margin-top:20px;">
          Failed to process CSV: ${err.message}
        </div>
      `;
      csvActionBox.style.display = "none";
    }
  }

  // CSV Submit to cart
  if (csvSubmitBtn) {
    csvSubmitBtn.addEventListener("click", async () => {
      const validItems = validatedCsvRows.filter(r => r.valid);
      if (validItems.length === 0) return;

      csvSubmitBtn.disabled = true;
      csvSubmitBtn.textContent = "Loading Items into Order Cart...";

      try {
        for (const it of validItems) {
          await window.WF_CART.addItem({
            id: it.product_id,
            sku: it.sku,
            name: it.name,
            price: it.unit_price,
            available_stock: it.available_quantity
          }, it.requested_quantity);
        }
        window.location.href = "cart.html";
      } catch (err) {
        csvSubmitBtn.disabled = false;
        csvSubmitBtn.textContent = "Confirm & Add All Valid Items to Cart →";
        if (window.CustomerAPI) window.CustomerAPI.showToast(err.message, "error");
      }
    });
  }
});
