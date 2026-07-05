# HIMS Frontend — Local / Standalone Computer Installation & Testing Guide

This guide runs the React/Vite frontend on a standalone test computer,
talking to the local backend from `backendLocalHost.zip`. HTTPS is still
required end-to-end — there is no http:// fallback in this build (locked
decision, see Context Memory Section 5).

---

## 0. Prerequisites

- Node.js >= 18.0.0, npm >= 9.0.0 (`node -v`, `npm -v`)
- The backend from `backendLocalHost.zip` running and reachable at
  `https://localhost:8000` (see that zip's `LOCAL_DEPLOYMENT_GUIDE.md`)
- A local HTTPS certificate (Step 2 below)

---

## 1. Install dependencies

```bash
cd frontend
npm ci
```

`npm ci` (not `npm install`) is used to match `package-lock.json` exactly —
same reproducibility guarantee as the CI pipeline.

---

## 2. Get a local HTTPS certificate

If you already generated `localhost.pem` / `localhost-key.pem` for the
backend, copy those two files into this project's `certs/` folder — best to
reuse the same cert for both sides.

Otherwise generate fresh (see `certs/README.md` for mkcert/OpenSSL
commands).

---

## 3. Configure the API URL

```bash
cp .env.local.example .env.local
```

Defaults to `VITE_API_URL=https://localhost:8000`, matching the backend
guide. Edit if your backend is on a different host/port on the same
machine or LAN (still must be `https://`).

---

## 4. Run the dev server

```bash
npm run dev
```

Open **https://localhost:5173** in the browser. If you used mkcert, the
browser will trust it automatically. If you used the OpenSSL self-signed
cert, you'll see a one-time browser warning — click through it
("Advanced" → "Proceed", wording varies by browser). This warning is
expected for local self-signed testing and is not a product defect.

---

## 5. (Optional) Test the production build through nginx

For a closer-to-real-deployment test:

```bash
npm run build
```

Then serve `dist/` with nginx using `nginx.local.conf` (adapted from the
production `nginx.conf` — same 7-header security set on every location
block, server_name changed to `localhost`, cert paths point at
`../certs/`). Copy `nginx.local.conf` to your nginx sites folder and point
its `root` at the `dist/` folder's absolute path.

This step is optional — `npm run dev` is sufficient for functional UAT-style
testing of the wizard, login, BTG, and password reset flows.

---

## 6. Test accounts

Use the accounts seeded by the backend (`backendLocalHost.zip` →
`scripts/seed_local_data.py`). Password for all: `LocalTest#2026`.

| Username | Role | What to test |
|---|---|---|
| reception1 | RECEPTIONIST | Full 10-step intake wizard, OPD + ADMISSION paths |
| nurse1 | NURSE | Patient record updates |
| doctor1 | DOCTOR | Doctor-scoped patient list, BTG activation on another doctor's patient |
| admin1 | ADMIN | BTG audit log, admin password reset |
| superadmin1 | SUPER_ADMIN | Full access |

---

## 7. Testing checklist (functional)

- [ ] Login screen accepts valid credentials, rejects invalid ones with
      generic "invalid credentials" messaging
- [ ] 5 failed logins locks the account (`is_locked` enforced server-side)
- [ ] 10-step wizard: OPD path skips admission-only steps
- [ ] 10-step wizard: non-corporate path skips insurance step
- [ ] BMI auto-calculates live as height/weight are entered
- [ ] Vital signs reject out-of-range values (matches backend CHECK constraint)
- [ ] Step 10 Registration Summary matches everything entered
- [ ] Submit returns a real `MR-YYYY-NNNNNN` number from the backend, shown
      on the copy-ready Success screen
- [ ] Refresh mid-form restores the draft from sessionStorage (and warns
      before refresh via `beforeunload`)
- [ ] Idle 13 minutes → warning banner; 15 minutes → hard logout
- [ ] Forgot Password → OTP read from backend console (see backend guide
      Step 8) → Reset Password screen accepts it and updates the password
- [ ] DevTools → Application tab: confirm zero `localStorage` writes
      (sessionStorage only) — this matches `storage.test.js`
- [ ] `npm run test` — all 46 Vitest tests pass locally

---

## 8. Known limitations of this local build

- Self-signed/mkcert certificate — not a CA-trusted production certificate
- No load testing performed
- Admin user-management UI, receipt PDF generation, Urdu i18n, audit log
  viewer remain open items (Context Memory Section 4) — out of scope for
  this local-testing delivery
