# WareFlow Frontend Implementation Plan

## Phase 9 Objectives
The goal of this phase is to complete the missing pages in the frontend SPA, ensuring the UI maps perfectly to the fully functional Phase 1-6 backend APIs.

## Missing Pages to Implement
1. **Demand Forecasts (`#demand`)**: 
   - Uses `window.apiClient.ai.getDemand(productId)`.
   - Requires a drop-down or search to select a product.
   - Will render a time-series chart showing 7-day or 30-day forecasted demand.
2. **Deliveries (`#deliveries`)**:
   - Uses `window.apiClient.jobs.getAll()` filtered by type = `DELIVERY`.
   - Table showing order destination, status, and assigned driver.
3. **Packing (`#packing`)**:
   - Uses `window.apiClient.jobs.getAll()` filtered by type = `PACKING`.
   - Table showing packed items against ordered items.
4. **CSV Import (`#import`)**:
   - (If backend supports it, otherwise report missing). We need to verify if CSV import API exists in backend.
5. **AI Decisions / Recommend Employee**:
   - Enhance the job assignment modal to fetch AI recommendations and display them before the manager assigns.

## Component & Routing Updates
1. `app.js`: Ensure all these pages are registered in `window.router.register(...)`.
2. `router.js`: Validate routing logic.
3. Add HTML rendering logic for the new pages in their respective JS files (e.g. `js/pages/demand.js`).

## Authentication & Initial Setup
Verified as fully functional after fixing the `auth.js` syntax bug and backend CORS constraint. The redirect from `#overview` to `onboarding.html` if `setup_completed` is false is working natively.

## Next Steps
- Write `demand.js`, `packing.js`, `deliveries.js`.
- Integrate AI recommendations into the UI workflows.
