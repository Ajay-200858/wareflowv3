/**
 * WareFlow Customer Commerce Platform — Configuration
 */
const WF_CONFIG = {
  getApiBaseUrl() {
    if (typeof window !== "undefined") {
      if (window.WAREFLOW_API_URL) return window.WAREFLOW_API_URL;
      const stored = localStorage.getItem("wf_api_base_url");
      if (stored) return stored;
      if (window.location.port === "8000") return window.location.origin + "/api";
      if (window.location.hostname.includes("vercel.app") || window.location.protocol === "https:") {
        return window.location.origin + "/api";
      }
    }
    return "http://localhost:8000/api";
  },
  
  TOKEN_KEY: "wf_customer_token",
  USER_KEY: "wf_customer_user",
  CART_KEY: "wf_guest_cart",
  SESSION_KEY: "wf_customer_session_id"
};

window.WF_CONFIG = WF_CONFIG;
