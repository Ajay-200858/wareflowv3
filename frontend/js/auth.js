(function () {
  'use strict';
  const WF = window.WF;

  WF.store = {
    session: () => {
        const token = window.apiClient.getToken();
        if (!token) return null;
        try {
            const raw = sessionStorage.getItem('wf_session_data');
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    },
    setSession: (s) => {
        if (!s) sessionStorage.removeItem('wf_session_data');
        else sessionStorage.setItem('wf_session_data', JSON.stringify(s));
    },
    clearSession: () => {
        window.apiClient.clearToken();
        sessionStorage.removeItem('wf_session_data');
    },
    saveCompany: (c) => {
        sessionStorage.setItem('wf_company_setup', JSON.stringify(c));
        return true;
    }
  };

  WF.requireAuth = (requireSetup = true) => {
    const s = WF.store.session();
    if (!s) { WF.store.clearSession(); location.replace('index.html'); return null; }
    const isEmployee = s.user && s.user.role && s.user.role.toUpperCase() === 'EMPLOYEE';
    if (!isEmployee && requireSetup && s.user && s.user.setup_completed === false) {
      location.replace('onboarding.html');
      return null;
    }
    return { user: s.user, company: s.company };
  };

  WF.logout = () => { WF.store.clearSession(); location.replace('index.html'); };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', WF.logout));
    if (document.getElementById('loginForm')) initAuthPage();
  });

  function initAuthPage() {
    const s = WF.store.session();
    if (s && s.user) {
      if (s.user.role && s.user.role.toUpperCase() === 'EMPLOYEE') {
        location.replace('app.html#employee-overview');
      } else if (s.user.setup_completed === false) {
        location.replace('onboarding.html');
      } else {
        location.replace('app.html#overview');
      }
      return;
    }

    const forms = { 
      login: document.getElementById('loginForm'),
      signup: document.getElementById('signupForm'),
      employee: document.getElementById('employeeRegisterForm')
    };

    const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

    document.querySelectorAll('.pw .toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = WF.ic(show ? 'eyeoff' : 'eye');
      });
    });

    document.querySelectorAll('.auth-form input').forEach((i) => i.addEventListener('input', () => WF.clearError(i)));

    const authHead = document.getElementById('authHead');
    const segButtons = document.querySelectorAll('#seg [role="tab"]');
    const switchButtons = document.querySelectorAll('[data-switch]');

    function setMode(mode) {
      const seg = document.getElementById('seg');
      if (seg) seg.dataset.mode = mode;

      // Hide all forms first
      if (forms.login) forms.login.hidden = true;
      if (forms.signup) forms.signup.hidden = true;
      if (forms.employee) forms.employee.hidden = true;

      // Update segment tab buttons
      segButtons.forEach(btn => {
        const match = btn.dataset.mode === mode;
        btn.classList.toggle('on', match);
        btn.setAttribute('aria-selected', match ? 'true' : 'false');
      });

      if (mode === 'login') {
        if (forms.login) forms.login.hidden = false;
        if (authHead) authHead.innerHTML = '<h1>Welcome back to WareFlow</h1><p>Log in to access your operations dashboard.</p>';
      } else if (mode === 'employee') {
        if (forms.employee) forms.employee.hidden = false;
        if (authHead) authHead.innerHTML = '<h1>Join your team on WareFlow</h1><p>Enter your company invitation code to connect your employee workspace.</p>';
      } else {
        if (forms.signup) forms.signup.hidden = false;
        if (authHead) authHead.innerHTML = '<h1>Set up your warehouse workspace</h1><p>Create a company account to start organizing sites, team, and inventory.</p>';
      }
    }

    segButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
    switchButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.switch)));

    // Verify invitation code helper
    const btnVerifyCode = document.getElementById('btnVerifyCode');
    const empInvCode = document.getElementById('empInvCode');
    const invCodeStatus = document.getElementById('invCodeStatus');

    if (btnVerifyCode && empInvCode && invCodeStatus) {
      btnVerifyCode.addEventListener('click', async () => {
        const code = empInvCode.value.trim().toUpperCase();
        if (!code) {
          invCodeStatus.style.display = 'block';
          invCodeStatus.style.color = 'var(--bad)';
          invCodeStatus.textContent = 'Please enter an invitation code.';
          return;
        }

        btnVerifyCode.classList.add('loading');
        try {
          const info = await window.apiClient.auth.getInvitationInfo(code);
          invCodeStatus.style.display = 'block';
          invCodeStatus.style.color = 'var(--good)';
          invCodeStatus.innerHTML = `&#10003; <strong>${info.company_name}</strong> &bull; Role: <strong>${info.role_type}</strong>`;
          if (info.target_email && forms.employee && forms.employee.empEmail) {
            forms.employee.empEmail.value = info.target_email;
          }
        } catch(err) {
          invCodeStatus.style.display = 'block';
          invCodeStatus.style.color = 'var(--bad)';
          invCodeStatus.textContent = err.message || 'Invalid or expired invitation code.';
        } finally {
          btnVerifyCode.classList.remove('loading');
        }
      });
    }

    // 1. Employee Registration Form
    if (forms.employee) forms.employee.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = forms.employee;
      WF.clearErrors(f);

      const code = f.empInvCode.value.trim().toUpperCase();
      const name = f.empFullName.value.trim();
      const email = f.empEmail.value.trim();
      const pass = f.empPass.value;
      const pass2 = f.empPass2.value;

      if (!code) { WF.setError(f.empInvCode, 'Company invitation code is required.'); return; }
      if (!name) { WF.setError(f.empFullName, 'Full name is required.'); return; }
      if (!emailOk(email)) { WF.setError(f.empEmail, 'Enter a valid email.'); return; }
      if (pass.length < 8) { WF.setError(f.empPass, 'Password must be at least 8 characters.'); return; }
      if (pass !== pass2) { WF.setError(f.empPass2, 'Passwords do not match.'); return; }

      const btn = f.querySelector('button[type="submit"]');
      btn.classList.add('loading');

      try {
        const result = await window.apiClient.auth.employeeRegister({
          full_name: name,
          email: email,
          password: pass,
          invitation_code: code
        });

        window.apiClient.setToken(result.access_token);
        WF.store.setSession({
          companyId: result.company.id,
          email: result.user.email,
          user: result.user,
          company: result.company
        });

        WF.toast('Welcome to WareFlow! Account registered.', 'ok');
        setTimeout(() => location.replace('app.html#employee-overview'), 600);
      } catch (err) {
        btn.classList.remove('loading');
        WF.setError(f.empPass2, err.message || 'Registration failed');
      }
    });

    // 2. Manager Login Form
    if (forms.login) forms.login.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = forms.login;
      WF.clearErrors(f);
      const email = f.liEmail.value.trim();
      const pass = f.liPass.value;
      if (!emailOk(email)) { WF.setError(f.liEmail, 'Enter a valid email.'); return; }
      if (!pass) { WF.setError(f.liPass, 'Enter your password.'); return; }

      const btn = f.querySelector('button[type="submit"]');
      btn.classList.add('loading');
      
      try {
          const result = await window.apiClient.auth.login(email, pass);
          window.apiClient.setToken(result.access_token);
          WF.store.setSession({ 
              companyId: result.company.id, 
              email: result.user.email,
              user: result.user,
              company: result.company
          });
          WF.toast('Welcome back.', 'ok');
          setTimeout(() => {
              if (result.user.role && result.user.role.toUpperCase() === 'EMPLOYEE') {
                location.replace('app.html#employee-overview');
              } else if (result.user.setup_completed === false) {
                location.replace('onboarding.html');
              } else {
                location.replace('app.html#overview');
              }
          }, 600);
      } catch (err) {
          btn.classList.remove('loading');
          WF.setError(f.liPass, err.message || 'Login failed');
      }
    });

    // 3. Manager/Company Signup Form
    if (forms.signup) forms.signup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = forms.signup;
      WF.clearErrors(f);
      
      const companyName = f.suName.value.trim();
      const email = f.suEmail.value.trim();
      const pass = f.suPass.value;
      const pass2 = f.suPass2.value;
      
      let industry = "Other";
      const industryRadio = f.querySelector('input[name="type"]:checked');
      if (industryRadio) industry = industryRadio.value;
      
      if (!companyName) { WF.setError(f.suName, 'Company name is required.'); return; }
      if (!emailOk(email)) { WF.setError(f.suEmail, 'Enter a valid email.'); return; }
      if (pass.length < 8) { WF.setError(f.suPass, 'Password must be at least 8 characters.'); return; }
      if (pass !== pass2) { WF.setError(f.suPass2, 'Passwords do not match.'); return; }

      const btn = f.querySelector('button[type="submit"]');
      btn.classList.add('loading');
      
      try {
          const result = await window.apiClient.auth.register(email, pass, companyName, industry);
          window.apiClient.setToken(result.access_token);
          WF.store.setSession({ 
              companyId: result.company.id, 
              email: result.user.email,
              user: result.user,
              company: result.company
          });
          WF.toast('Account created. Welcome!', 'ok');
          setTimeout(() => location.replace('onboarding.html'), 600);
      } catch (err) {
          btn.classList.remove('loading');
          WF.setError(f.suPass2, err.message || 'Registration failed');
      }
    });
  }
})();
