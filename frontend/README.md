# WareFlow frontend v3

Plain HTML, CSS and JavaScript. No build step.

## Run it
    npx serve . -l 3000
    (or: python -m http.server 3000)
Then open http://localhost:3000

## Files
- index.html        log in / create account
- onboarding.html   company setup (4 sections)
- dashboard.html    overview of what was submitted
- css/style.css     the whole design system (colours, type and spacing are at the top)
- js/ui.js          shared: icons, toasts, sidebar, parallax scene, scroll animations
- js/auth.js        storage, sessions, login / sign-up
- js/onboarding.js  setup form logic
- js/dashboard.js   overview logic

## Notes
- Data is saved in the browser (localStorage keys start with wf2_). Old wf_ data is not read.
- Press [ to hide or show the sidebar.
- Only file names of compliance documents are stored, not the files.
