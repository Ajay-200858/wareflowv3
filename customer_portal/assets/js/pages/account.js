/**
 * WareFlow Customer Commerce Platform — Customer Account & Profile
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.WF_AUTH.requireAuth("login.html")) {
    return;
  }

  const nameInput = document.getElementById("profile-name");
  const companyInput = document.getElementById("profile-company");
  const emailInput = document.getElementById("profile-email");
  const phoneInput = document.getElementById("profile-phone");
  const addressInput = document.getElementById("profile-address");
  const saveBtn = document.getElementById("save-profile-btn");
  const logoutBtn = document.getElementById("account-logout-btn");

  const accountEmailHeader = document.getElementById("account-header-email");
  const accountNameHeader = document.getElementById("account-header-name");

  try {
    const profile = await window.CustomerAPI.auth.getProfile();
    if (accountNameHeader) accountNameHeader.textContent = profile.name || "Customer Account";
    if (accountEmailHeader) accountEmailHeader.textContent = profile.email;

    if (nameInput) nameInput.value = profile.name || "";
    if (companyInput) companyInput.value = profile.company_name || "";
    if (emailInput) emailInput.value = profile.email || "";
    if (phoneInput) phoneInput.value = profile.phone || "";
    if (addressInput) addressInput.value = profile.address || "";
  } catch (err) {
    if (window.CustomerAPI) window.CustomerAPI.showToast("Failed to load customer profile: " + err.message, "error");
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        const payload = {
          name: nameInput.value.trim(),
          company_name: companyInput.value.trim(),
          phone: phoneInput.value.trim(),
          address: addressInput.value.trim()
        };

        const updated = await window.CustomerAPI.auth.updateProfile(payload);
        if (accountNameHeader) accountNameHeader.textContent = updated.name;
        if (window.CustomerAPI) window.CustomerAPI.showToast("Profile details updated successfully", "success");
      } catch (err) {
        if (window.CustomerAPI) window.CustomerAPI.showToast("Update failed: " + err.message, "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      window.WF_AUTH.logout();
    });
  }
});
