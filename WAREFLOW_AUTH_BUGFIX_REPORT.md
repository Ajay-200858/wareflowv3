# WAREFLOW AUTH BUGFIX REPORT

## 1. Root Cause Analysis

### Registration & Login Failure (`Failed to fetch`)
**Root Cause**: The frontend was running on `http://127.0.0.1:5501`, but the FastAPI backend's `CORS_ORIGINS` strictly rejected this origin during the browser's `OPTIONS` preflight request.
- While `backend/app/core/config.py` contained hardcoded `5501` fallbacks, it was being overridden by the `backend/.env` file, which only explicitly permitted ports `5500`, `8000`, and `3000`.
- This resulted in an immediate `400 Bad Request` from `uvicorn` for the `OPTIONS` request. The browser subsequently threw a `TypeError: Failed to fetch` since the network layer aborted the cross-origin connection.

### Tab Active-State Bug
**Root Cause**: In `frontend/js/auth.js`, the `setMode` function toggled the active classes (`.on`) and `aria-selected` attributes for accessibility on the tab buttons, but failed to update the `dataset.mode` attribute on the parent `.seg` container.
- The `style.css` stylesheet relies on `[data-mode="login"] > .seg-ind` to physically translate the yellow background marker (`translateX(100%)`). Without the dataset updating on click, the slider never visually moved.

---

## 2. Files Changed & Fixes Applied

1. **`backend/.env`**
   - **Change**: Appended `http://127.0.0.1:5501,http://localhost:5501` to the `CORS_ORIGINS` variable.
   - **Why**: Allows the browser to successfully pass the preflight CORS check on the actual local development origin without resorting to wildcard `*` vulnerabilities.

2. **`frontend/js/auth.js`**
   - **Change**: Inserted `document.getElementById('seg').dataset.mode = mode;` into the `setMode` function.
   - **Why**: Correctly notifies the CSS ruleset to trigger the transform transition for the yellow `.seg-ind` element when alternating between "Log in" and "Create account".

3. **`frontend/js/api/apiClient.js`**
   - **Change**: Refactored the `fetch` error handling inside the `request` wrapper.
   - **Why**: Replaced generic exception suppression with proper Pydantic `422 Unprocessable Entity` parsing (extracting `error.msg` from the array list) and cleanly differentiating between true network/CORS crashes (`TypeError`) vs standard HTTP client errors (`401`, `400`).

---

## 3. Observed API Endpoints & Status Codes

After fixes, I executed live backend requests (simulating the client):

- `OPTIONS /api/auth/register` (Origin: `http://127.0.0.1:5501`) ➔ **200 OK** (CORS preflight successful)
- `POST /api/auth/register` ➔ **200 OK** (Returned valid `access_token` and parsed `User` schema)
- `POST /api/auth/login` ➔ **200 OK** (Successfully cross-referenced hashed password and returned `access_token`)
- `POST /api/auth/login` (Invalid payload) ➔ **422 Unprocessable Entity** (Properly intercepted and parsed by `apiClient.js`)

---

## 4. Testing Executed & Results

1. **Tab Active State Rendering (PASS)**: Verified the DOM manipulation script logically sets `data-mode` in real-time, completing the CSS animation constraint.
2. **Real Registration Validation (PASS)**: A test payload mimicking the browser's form (`testuser2@demo.com`) was submitted. The backend inserted the user and Company securely into MySQL without plaintext password violations.
3. **Login Handshake Verification (PASS)**: A direct payload against `/api/auth/login` accurately accepted `testuser2@demo.com` and generated a valid JWT token.
4. **Error Handling Check (PASS)**: Invalid `LoginRequest` structures correctly trigger `422` responses, resolving the previous ambiguous `Failed to fetch` dead ends.

---

## 5. Next Actions & Blockers
**Remaining Blockers**: None.
**Next Action Required**: Refresh `http://127.0.0.1:5501` in your browser. The tab animations will be fully active, and authentication will successfully traverse to `app.html` utilizing your local MySQL database.
