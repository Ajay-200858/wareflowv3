/**
 * WareFlow Customer Commerce Platform — Demo Showcase Dataset
 * 
 * Provides static fallback products and categories with Indian Rupee (₹) pricing
 * for serverless/static showcase environments when the local FastAPI backend is offline.
 * 
 * IMPORTANT: All items are explicitly marked as demonstration samples with NO live inventory.
 */
(function() {
  const DEMO_CATEGORIES = [
    {
      id: 1,
      name: "Packaging & Shipping",
      description: "Corrugated cartons, heavy-duty tapes, stretch wrap films, and cushioning rolls",
      product_count: 3
    },
    {
      id: 2,
      name: "Material Handling & Storage",
      description: "Industrial pallets, modular plastic crates, shelf bins, and picking totes",
      product_count: 2
    },
    {
      id: 3,
      name: "Safety & Facility PPE",
      description: "Reflective safety wear, handling gloves, hard hats, and facility compliance gear",
      product_count: 2
    },
    {
      id: 4,
      name: "Industrial Fasteners & Hardware",
      description: "High-tensile PET strapping, steel banding, tensioners, and cargo ratchets",
      product_count: 1
    },
    {
      id: 5,
      name: "Barcoding & Logistics Labels",
      description: "Direct thermal dispatch labels, transfer ribbons, and barcode asset tags",
      product_count: 1
    }
  ];

  const DEMO_PRODUCTS = [
    {
      id: 101,
      sku: "DEMO-PKG-001",
      name: "Heavy-Duty 5-Ply Corrugated Shipping Boxes (Bundle of 25)",
      description: "Export-grade fluted kraft paperboard carton boxes engineered for heavy-duty warehouse stack integrity and regional freight shipping.",
      category: "Packaging & Shipping",
      category_id: 1,
      unit: "bundle",
      price: 1850.00,
      price_display: "₹1,850.00",
      has_fixed_price: true,
      min_order_qty: 2,
      weight: 12.5,
      storage_requirements: "Dry Ambient Racks",
      dimensions: "450 × 300 × 300 mm",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    },
    {
      id: 102,
      sku: "DEMO-PKG-002",
      name: "Industrial Clear Stretch Film Roll — 500mm × 300m (23 Micron)",
      description: "High-cling cast polyethylene stretch wrap film for secure pallet containment, dust protection, and moisture sealing during transit.",
      category: "Packaging & Shipping",
      category_id: 1,
      unit: "roll",
      price: 680.00,
      price_display: "₹680.00",
      has_fixed_price: true,
      min_order_qty: 4,
      weight: 2.8,
      storage_requirements: "Standard Ambient",
      dimensions: "500 mm × 300 m",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    },
    {
      id: 103,
      sku: "DEMO-MAT-101",
      name: "Reinforced HDPE Plastic Warehouse Pallet (1200 × 1000 mm)",
      description: "Heavy-duty 4-way entry rackable pallet molded from virgin high-density polyethylene for automated storage and retrieval systems.",
      category: "Material Handling & Storage",
      category_id: 2,
      unit: "unit",
      price: 3450.00,
      price_display: "₹3,450.00",
      has_fixed_price: true,
      min_order_qty: 5,
      weight: 14.0,
      storage_requirements: "Warehouse Floor / Bay A",
      dimensions: "1200 × 1000 × 150 mm",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    },
    {
      id: 104,
      sku: "DEMO-MAT-102",
      name: "Stackable Industrial Storage Crate (60L Heavy Duty PP)",
      description: "Reinforced polypropylene storage container with ergonomic handles and ribbed sidewalls, ideal for order picking and small parts staging.",
      category: "Material Handling & Storage",
      category_id: 2,
      unit: "unit",
      price: 920.00,
      price_display: "₹920.00",
      has_fixed_price: true,
      min_order_qty: 6,
      weight: 2.4,
      storage_requirements: "Shelf Bins / Zone B",
      dimensions: "600 × 400 × 320 mm",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    },
    {
      id: 105,
      sku: "DEMO-PPE-201",
      name: "High-Visibility ANSI Class 2 Reflective Safety Vests (Pack of 10)",
      description: "Fluorescent mesh safety vests featuring 360-degree high-luminescence silver reflective bands with heavy-duty zipper closure.",
      category: "Safety & Facility PPE",
      category_id: 3,
      unit: "pack",
      price: 1450.00,
      price_display: "₹1,450.00",
      has_fixed_price: true,
      min_order_qty: 1,
      weight: 1.2,
      storage_requirements: "Standard Ambient",
      dimensions: "Universal Size XL",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    },
    {
      id: 106,
      sku: "DEMO-PPE-202",
      name: "PU-Coated Precision Grip Warehouse Gloves (Pack of 12 Pairs)",
      description: "Seamless knitted nylon shell gloves with polyurethane palm coating for superior mechanical grip, tactile feel, and oil resistance.",
      category: "Safety & Facility PPE",
      category_id: 3,
      unit: "pack",
      price: 840.00,
      price_display: "₹840.00",
      has_fixed_price: true,
      min_order_qty: 2,
      weight: 0.6,
      storage_requirements: "Dry Ambient Shelf",
      dimensions: "Size L (Standard)",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    },
    {
      id: 107,
      sku: "DEMO-LBL-301",
      name: "Direct Thermal Barcode Dispatch Labels — 4\" × 6\" (Roll of 1000)",
      description: "Smudge-resistant direct thermal shipping labels with aggressive permanent adhesive for courier dispatch compliance and outer cartons.",
      category: "Barcoding & Logistics Labels",
      category_id: 5,
      unit: "roll",
      price: 720.00,
      price_display: "₹720.00",
      has_fixed_price: true,
      min_order_qty: 4,
      weight: 1.8,
      storage_requirements: "Cool Dry Storage",
      dimensions: "100 × 150 mm (4\" × 6\")",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    },
    {
      id: 108,
      sku: "DEMO-FAS-401",
      name: "High-Tensile Polyester (PET) Strapping Roll — 16mm × 1000m",
      description: "Heavy-duty shock-absorbing polyester strapping coil for pallet stabilization, crate bundling, and timber containment.",
      category: "Industrial Fasteners & Hardware",
      category_id: 4,
      unit: "roll",
      price: 2950.00,
      price_display: "₹2,950.00",
      has_fixed_price: true,
      min_order_qty: 1,
      weight: 18.0,
      storage_requirements: "Bay C Ground Racks",
      dimensions: "16 mm × 0.8 mm × 1000 m",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    },
    {
      id: 109,
      sku: "DEMO-PKG-003",
      name: "Reinforced Water-Activated Gummed Paper Tape — 72mm × 100m",
      description: "Fiberglass reinforced tamper-evident kraft packaging tape that forms an inseparable molecular bond with corrugated surfaces.",
      category: "Packaging & Shipping",
      category_id: 1,
      unit: "roll",
      price: 520.00,
      price_display: "₹520.00",
      has_fixed_price: true,
      min_order_qty: 6,
      weight: 1.1,
      storage_requirements: "Dry Ambient",
      dimensions: "72 mm × 100 m",
      available_stock: 0,
      is_in_stock: false,
      is_demo_sample: true,
      image_url: null
    }
  ];

  function formatInr(amount) {
    if (typeof amount !== "number" || isNaN(amount)) return "Price on Request";
    return "₹" + amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getFilteredProducts(params = {}) {
    let items = DEMO_PRODUCTS.slice();

    if (params.search) {
      const q = params.search.toLowerCase().trim();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (params.category_id) {
      const cid = parseInt(params.category_id);
      if (!isNaN(cid) && cid > 0) {
        items = items.filter(p => p.category_id === cid);
      }
    }

    if (params.sort_by === "price_asc") {
      items.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (params.sort_by === "price_desc") {
      items.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (params.sort_by === "name_asc") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }

    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 16;
    const total = items.length;
    const total_pages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paginated = items.slice(offset, offset + limit);

    return {
      items: paginated,
      total,
      page,
      limit,
      total_pages,
      is_demo_fallback: true
    };
  }

  function getProductById(id) {
    const numId = parseInt(id);
    return DEMO_PRODUCTS.find(p => p.id === numId) || null;
  }

  window.WF_DEMO_DATA = {
    categories: DEMO_CATEGORIES,
    products: DEMO_PRODUCTS,
    formatInr,
    getFilteredProducts,
    getProductById
  };
})();
