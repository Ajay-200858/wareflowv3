(function () {
  'use strict';
  
  document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('wf_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    // UI Elements
    const sections = Array.from(document.querySelectorAll('.step-section'));
    const dots = Array.from(document.querySelectorAll('.step-dot'));
    const btnNext = document.getElementById('btnNext');
    const btnBack = document.getElementById('btnBack');
    const btnSkip = document.getElementById('btnSkip');
    const btnSaveProgress = document.getElementById('btnSaveProgress');
    
    // State
    let currentStep = 1;
    const totalSteps = 5;
    
    const state = JSON.parse(localStorage.getItem('wf_setup_draft')) || {
        companyName: '',
        companyAddress: '',
        warehouseManual: '',
        warehouseCsv: null,
        employeeCsv: null,
        inventoryCsv: null,
        historicalCsv: null
    };
    
    // Populate form from state
    if (state.companyName) document.getElementById('coName').value = state.companyName;
    if (state.companyAddress) document.getElementById('coAddress').value = state.companyAddress;
    if (state.warehouseManual) document.getElementById('manualWhName').value = state.warehouseManual;
    
    function updateUI() {
        // Sections
        sections.forEach((sec, idx) => {
            sec.classList.toggle('active', idx + 1 === currentStep);
        });
        
        // Dots
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx + 1 <= currentStep);
        });
        
        // Buttons
        btnBack.style.visibility = currentStep > 1 ? 'visible' : 'hidden';
        btnSkip.style.display = currentStep === 5 ? 'block' : 'none';
        btnNext.textContent = currentStep === totalSteps ? 'Finish Setup' : 'Continue';
    }
    
    function validateStep(step) {
        let isValid = true;
        
        if (step === 1) {
            const name = document.getElementById('coName').value.trim();
            if (!name) {
                document.getElementById('coNameErr').textContent = 'Company Name is required.';
                isValid = false;
            } else {
                document.getElementById('coNameErr').textContent = '';
                state.companyName = name;
                state.companyAddress = document.getElementById('coAddress').value.trim();
            }
        } else if (step === 2) {
            const whCsv = document.getElementById('whCsvInput').files[0];
            const manualWh = document.getElementById('manualWhName').value.trim();
            
            if (!whCsv && !manualWh) {
                alert("Please either upload a Warehouse CSV or enter a manual warehouse name.");
                isValid = false;
            } else {
                state.warehouseManual = manualWh;
                if (whCsv) state.warehouseCsv = whCsv;
            }
        } else if (step === 3) {
            const empCsv = document.getElementById('empCsvInput').files[0];
            if (!empCsv) {
                alert("Please upload the Employees CSV.");
                isValid = false;
            } else {
                state.employeeCsv = empCsv;
            }
        } else if (step === 4) {
            const invCsv = document.getElementById('invCsvInput').files[0];
            if (!invCsv) {
                alert("Please upload the Initial Inventory CSV.");
                isValid = false;
            } else {
                state.inventoryCsv = invCsv;
            }
        }
        
        return isValid;
    }
    
    btnNext.addEventListener('click', async () => {
        if (!validateStep(currentStep)) return;
        
        if (currentStep < totalSteps) {
            currentStep++;
            updateUI();
        } else {
            // Step 5 Submit (Historical CSV is optional)
            const histCsv = document.getElementById('histCsvInput').files[0];
            if (histCsv) {
                state.historicalCsv = histCsv;
            } else {
                state.historicalCsv = null;
            }
            
            await submitSetup();
        }
    });
    
    btnSkip.addEventListener('click', async () => {
        if (currentStep === 5) {
            await submitSetup();
        }
    });
    
    btnBack.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateUI();
        }
    });
    
    btnSaveProgress.addEventListener('click', () => {
        // Just save text fields
        state.companyName = document.getElementById('coName').value.trim();
        state.companyAddress = document.getElementById('coAddress').value.trim();
        state.warehouseManual = document.getElementById('manualWhName').value.trim();
        localStorage.setItem('wf_setup_draft', JSON.stringify(state));
        
        // Show toast
        const toasts = document.getElementById('toasts');
        if (toasts) {
            toasts.innerHTML = '<div style="background: #333; color: white; padding: 10px; border-radius: 4px; margin-bottom: 10px;">Progress saved!</div>';
            setTimeout(() => toasts.innerHTML = '', 3000);
        }
    });
    
    // File inputs
    const fileInputs = [
        { id: 'whCsvInput', statusId: 'whCsvStatus' },
        { id: 'empCsvInput', statusId: 'empCsvStatus' },
        { id: 'invCsvInput', statusId: 'invCsvStatus' },
        { id: 'histCsvInput', statusId: 'histCsvStatus' }
    ];
    
    fileInputs.forEach(fi => {
        const input = document.getElementById(fi.id);
        const status = document.getElementById(fi.statusId);
        if (input && status) {
            input.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    status.innerHTML = `Selected: <b>${e.target.files[0].name}</b> (${(e.target.files[0].size/1024).toFixed(1)} KB)`;
                } else {
                    status.innerHTML = `No file selected.`;
                }
            });
        }
    });
    
    // CSV Templates
    const downloadCsv = (filename, content) => {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };
    
    document.getElementById('whCsvTemplate')?.addEventListener('click', (e) => {
        e.preventDefault();
        downloadCsv('warehouse_template.csv', 'warehouse,zone,rack,row,position,capacity\nMain Warehouse,Zone A,Rack 1,Row 1,POS-001,100\n');
    });
    document.getElementById('empCsvTemplate')?.addEventListener('click', (e) => {
        e.preventDefault();
        downloadCsv('employees_template.csv', 'first_name,last_name,email,role,skills\nJohn,Doe,john@example.com,EMPLOYEE,Packing\nJane,Smith,jane@example.com,MANAGER,Management\n');
    });
    document.getElementById('invCsvTemplate')?.addEventListener('click', (e) => {
        e.preventDefault();
        downloadCsv('inventory_template.csv', 'sku,position_id,quantity\nPROD-001,1,50\nPROD-002,2,100\n');
    });
    document.getElementById('histCsvTemplate')?.addEventListener('click', (e) => {
        e.preventDefault();
        downloadCsv('historical_sales_template.csv', 'product_id,date,quantity_sold\n1,2026-01-01,15\n1,2026-01-02,20\n');
    });
    
    async function submitSetup() {
        btnNext.disabled = true;
        btnNext.textContent = 'Submitting...';
        btnSkip.disabled = true;
        
        try {
            // 1. Submit Company Setup via apiClient
            await window.apiClient.users.updateSetup({
                company_name: state.companyName,
                company_address: state.companyAddress,
                company_contact: "",
                warehouse_name: state.warehouseManual
            });
            
            // Upload helper
            const uploadFile = async (fileObj, importMethod) => {
                if (fileObj) {
                    const fd = new FormData();
                    fd.append("file", fileObj);
                    await importMethod(fd);
                }
            };
            
            // 2. Upload CSVs in order
            await uploadFile(state.warehouseCsv, window.apiClient.warehouses.importCSV);
            await uploadFile(state.employeeCsv, window.apiClient.employees.importCSV);
            await uploadFile(state.inventoryCsv, window.apiClient.inventory.importCSV);
            await uploadFile(state.historicalCsv, window.apiClient.ai.importHistorical);
            
            // 3. Train ML Model if historical data was provided
            if (state.historicalCsv) {
                try {
                    await window.apiClient.ai.trainModel();
                } catch (e) {
                    console.warn("Failed to train model, continuing setup...", e);
                }
            }
            
            localStorage.removeItem('wf_setup_draft');
            
            // Update local session data so next page load doesn't bounce us back
            const session = window.WF.store.session();
            if (session && session.user) {
                session.user.setup_completed = true;
                window.WF.store.setSession(session);
            }
            
            // Show Success
            window.location.href = 'app.html';
        } catch (error) {
            console.error(error);
            alert("Failed to submit setup: " + error.message);
            btnNext.disabled = false;
            btnNext.textContent = 'Finish Setup';
            btnSkip.disabled = false;
        }
    }
    
    updateUI();
  });
})();
