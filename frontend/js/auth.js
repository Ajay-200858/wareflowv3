(function () {
  'use strict';
  const WF = window.WF;

  WF.store = {
    session: () => {
        const token = window.apiClient.getToken();
        if (!token) return null;
        try {
            const raw = localStorage.getItem('wf_session_data');
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    },
    setSession: (s) => {
        if (!s) localStorage.removeItem('wf_session_data');
        else localStorage.setItem('wf_session_data', JSON.stringify(s));
    },
    clearSession: () => {
        window.apiClient.clearToken();
        localStorage.removeItem('wf_session_data');
    },
    saveCompany: (c) => {
        localStorage.setItem('wf_company_setup', JSON.stringify(c));
        return true;
    }
  };

  WF.requireAuth = (requireSetup = true) => {
    const s = WF.store.session();
    if (!s) { WF.store.clearSession(); location.replace('index.html'); return null; }
    if (requireSetup && s.user && s.user.setup_completed === false) {
      location.replace('onboarding.html');
      return null;
    }
    return { user: s.user, company: s.company };
  };

  WF.logout = () => { WF.store.clearSession(); location.replace('index.html'); };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', WF.logout));
    if (document.getElementById('signupForm')) initAuthPage();
  });

  function initAuthPage() {
    const s = WF.store.session();
    if (s) {
      if (s.user && s.user.setup_completed === false) {
        location.replace('onboarding.html');
      } else {
        location.replace('app.html');
      }
      return;
    }

    const forms = { 
      login: document.getElementById('loginForm'),
      signup: document.getElementById('signupForm')
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
      document.getElementById('seg').dataset.mode = mode;
      if (mode === 'login') {
        forms.signup.hidden = true;
        forms.login.hidden = false;
        authHead.innerHTML = '<h1>Welcome back to WareFlow</h1><p>Log in to manage your workspace.</p>';
        segButtons[0].classList.remove('on');
        segButtons[0].setAttribute('aria-selected', 'false');
        segButtons[1].classList.add('on');
        segButtons[1].setAttribute('aria-selected', 'true');
      } else {
        forms.login.hidden = true;
        forms.signup.hidden = false;
        authHead.innerHTML = '<h1>Set up your warehouse workspace</h1><p>Create an account, then add your sites, team and paperwork.</p>';
        segButtons[1].classList.remove('on');
        segButtons[1].setAttribute('aria-selected', 'false');
        segButtons[0].classList.add('on');
        segButtons[0].setAttribute('aria-selected', 'true');
      }
    }

    segButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
    switchButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.switch)));

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
              if (result.user.setup_completed === false) location.replace('onboarding.html');
              else location.replace('app.html');
          }, 600);
      } catch (err) {
          btn.classList.remove('loading');
          WF.setError(f.liPass, err.message || 'Login failed');
      }
    });

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
