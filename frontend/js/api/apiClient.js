const API_BASE_URL = "http://localhost:8000/api";

const apiClient = {
    getToken() {
        return localStorage.getItem("wf_token");
    },
    
    setToken(token) {
        localStorage.setItem("wf_token", token);
    },
    
    clearToken() {
        localStorage.removeItem("wf_token");
    },
    
    async request(endpoint, method = "GET", body = null) {
        const headers = {
            "Content-Type": "application/json"
        };
        
        const token = this.getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
        
        const config = {
            method,
            headers
        };
        
        if (body) {
            config.body = JSON.stringify(body);
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            
            if (response.status === 401) {
                // Handle unauthorized
                if (window.location.hash !== '') {
                    window.location.href = "index.html";
                }
                throw new Error("Unauthorized");
            }
            
            let data = {};
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data.detail = await response.text();
            }
            
            if (!response.ok) {
                let errorMsg = data.detail || data.message || `API Error (${response.status})`;
                if (Array.isArray(errorMsg)) {
                    errorMsg = errorMsg.map(e => e.msg || JSON.stringify(e)).join(", ");
                }
                throw new Error(errorMsg);
            }
            
            return data;
        } catch (error) {
            console.error("API Request failed:", error);
            if (error instanceof TypeError && error.message === "Failed to fetch") {
                throw new Error("Network error or CORS issue. Please check your connection and ensure the server is running.");
            }
            throw error;
        }
    },
    
    auth: {
        login: (email, password) => apiClient.request("/auth/login", "POST", { email, password }),
        register: (email, password, company_name, industry) => apiClient.request("/auth/register", "POST", { email, password, company_name, industry, role: "MANAGER" }),
        me: () => apiClient.request("/auth/me")
    },
    
    users: {
        updateSetup: (payload) => apiClient.request("/auth/me/setup", "PUT", payload)
    },
    
    dashboard: {
        overview: () => apiClient.request("/dashboard/overview")
    },
    
    products: {
        getAll: () => apiClient.request("/products"),
        getOne: (id) => apiClient.request(`/products/${id}`),
        create: (payload) => apiClient.request("/products", "POST", payload),
        update: (id, payload) => apiClient.request(`/products/${id}`, "PUT", payload),
        delete: (id) => apiClient.request(`/products/${id}`, "DELETE"),
        importCSV: (formData) => {
            const token = apiClient.getToken();
            return fetch(`${API_BASE_URL}/products/import`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            }).then(async r => {
                if(!r.ok) throw new Error((await r.json()).detail || "Import failed");
                return r.json();
            });
        }
    },
    
    inventory: {
        getAll: () => apiClient.request("/inventory"),
        update: (id, payload) => apiClient.request(`/inventory/${id}`, "PUT", payload),
        manageStockDirect: (payload) => apiClient.request("/inventory/direct", "POST", payload),
        allocate: (payload) => apiClient.request("/inventory/allocate", "POST", payload),
        receive: (payload) => apiClient.request("/inventory/receive", "POST", payload),
        move: (payload) => apiClient.request("/inventory/movement", "POST", payload),
        importCSV: (formData) => {
            const token = apiClient.getToken();
            return fetch(`${API_BASE_URL}/inventory/import`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            }).then(async r => {
                if(!r.ok) throw new Error((await r.json()).detail || "Import failed");
                return r.json();
            });
        }
    },
    
    warehouses: {
        getAll: () => apiClient.request("/warehouses"),
        getMap: (id) => apiClient.request(`/warehouses/${id}/map`),
        createPosition: (payload) => apiClient.request("/warehouses/positions", "POST", payload),
        updatePosition: (id, payload) => apiClient.request(`/warehouses/positions/${id}`, "PUT", payload),
        importCSV: (formData, preview = false) => {
            const token = apiClient.getToken();
            const url = `${API_BASE_URL}/warehouses/import${preview ? '?preview=true' : ''}`;
            return fetch(url, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            }).then(async r => {
                if(!r.ok) throw new Error((await r.json()).detail || "Import failed");
                return r.json();
            });
        }
    },
    
    orders: {
        getAll: () => apiClient.request("/orders"),
        create: (payload) => apiClient.request("/orders", "POST", payload),
        cancel: (id) => apiClient.request(`/orders/${id}`, "DELETE"),
        createJob: (payload) => apiClient.request("/jobs", "POST", payload),
        importCSV: (formData) => {
            const token = apiClient.getToken();
            return fetch(`${API_BASE_URL}/orders/import`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            }).then(async r => {
                const data = await r.json();
                if(!r.ok) throw new Error(data.detail || "Import failed");
                return data;
            });
        }
    },
    
    jobs: {
        getAll: () => apiClient.request("/jobs"),
        assign: (id, employeeId) => apiClient.request(`/jobs/${id}/assign?employee_id=${employeeId}`, "PUT"),
        accept: (id) => apiClient.request(`/jobs/${id}/accept`, "PUT"),
        reject: (id, reason) => apiClient.request(`/jobs/${id}/reject?reason=${encodeURIComponent(reason)}`, "PUT"),
        complete: (id) => apiClient.request(`/jobs/${id}/complete`, "PUT")
    },
    
    employees: {
        getAll: () => apiClient.request("/employees"),
        create: (payload) => apiClient.request("/employees", "POST", payload),
        update: (id, payload) => apiClient.request(`/employees/${id}`, "PUT", payload),
        getShifts: (id) => apiClient.request(`/employees/${id}/shifts`),
        createShift: (id, payload) => apiClient.request(`/employees/${id}/shifts`, "POST", payload),
        setAvailability: (id, payload) => apiClient.request(`/employees/${id}/availability`, "POST", payload),
        calculateWorkload: (id) => apiClient.request(`/employees/${id}/calculate_workload`, "POST"),
        calculateSalary: (id, period) => apiClient.request(`/employees/${id}/calculate-salary?period=${encodeURIComponent(period)}`, "POST"),
        createSalaryRule: (payload) => apiClient.request("/employees/salary-rules", "POST", payload),
        importCSV: (formData) => {
            const token = apiClient.getToken();
            return fetch(`${API_BASE_URL}/employees/import`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            }).then(async r => {
                if(!r.ok) throw new Error((await r.json()).detail || "Import failed");
                return r.json();
            });
        }
    },
    
    ai: {
        getDecisions: () => apiClient.request("/ai/recommendations"),
        submitFeedback: (payload) => apiClient.request("/ai/feedback", "POST", payload),
        getDemand: (productId) => apiClient.request(`/ai/demand/product/${productId}`),
        recommendEmployee: (jobId) => apiClient.request(`/ai/assignment/recommend?job_id=${jobId}`, "POST"),
        recommendStorage: (payload) => apiClient.request("/ai/storage/recommend", "POST", payload),
        recommendRoute: (orderId) => apiClient.request("/ai/picking/route", "POST", { order_id: orderId }),
        importHistorical: (formData) => {
            const token = apiClient.getToken();
            return fetch(`${API_BASE_URL}/ai/import-historical`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            }).then(async r => {
                if(!r.ok) throw new Error((await r.json()).detail || "Import failed");
                return r.json();
            });
        },
        trainModel: () => apiClient.request("/ai/train", "POST"),
        getModels: () => apiClient.request("/ai/models"),
        retrain: () => apiClient.request("/ai/retrain", "POST")
    },
    
    notifications: {
        getAll: () => apiClient.request('/notifications'),
        getUnreadCount: () => apiClient.request('/notifications/unread-count'),
        markAsRead: (id) => apiClient.request(`/notifications/${id}/read`, "POST"),
        markAllAsRead: () => apiClient.request('/notifications/read-all', "POST")
    }
};

window.apiClient = apiClient;
