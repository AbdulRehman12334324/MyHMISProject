# HIMS Patient Intake Frontend — CHANGELOG

## v2.3 — June 2026

### 🔴 Critical: PII Migration Support
- `scripts/migrate_encrypt_pii.py` — standalone Python script to encrypt existing plaintext CNIC/mobile values in the PostgreSQL database before go-live. Run `--dry-run` first to preview. Detects already-encrypted values (base64 AES-GCM heuristic) and skips them safely.

### 🟠 High: Password Reset Flow (NEW)
- `src/components/ForgotPasswordScreen.jsx` — "Forgot password?" screen. Staff enters username; backend sends 6-digit OTP to registered email. Anti-enumeration: always shows "code sent" regardless of whether username exists.
- `src/components/ResetPasswordScreen.jsx` — OTP entry + new password form. Real-time password strength checklist (10 chars, upper, lower, digit, special). OTP expiry messaging (15 min). Show/hide password toggle. Success state returns to login.
- `src/api/himsApi.js` — added `requestPasswordReset()`, `confirmPasswordReset()`, `adminResetPassword()` methods.
- `src/components/LoginScreen.jsx` — "Forgot password?" link added below password field. Improved account lockout error messaging (distinguishes locked/inactive/invalid).

### Tests
- `src/test/validation.test.js` — expanded from 27 to 46 tests. New coverage: OTP validation (5), password strength (10), PII encryption detection (4).

### Backend open items status (for handoff)
- 🔴 Backend E2E test suite (pytest) — NOT YET BUILT. Status: pending Step 2.
- 🔴 Staging deployment — pending.
- 🟠 Admin user management UI — pending.
- 🟠 Receipt PDF generation — pending.
- 🟠 Search/list pagination — pending.
- 🟠 Urdu i18n — pending.

---

## v2.2 — June 2025

### UAT Remediation (all findings resolved)
- **CRITICAL**: Removed `api.placeholder.com` from `ci.yml` — was causing `TLSV1_UNRECOGNIZED_NAME` error in UAT scanner. CI now uses `secrets.VITE_API_URL || 'http://localhost:8000'`.
- **HIGH × 2**: NGINX `add_header` does NOT inherit from `server {}` into `location {}` blocks. Full 7-header security set re-declared in every `location` block in `nginx.conf`.
- **LOW × 3**: Same NGINX inheritance fix covered `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` on static asset responses.
- Added `UAT_SECURITY_REMEDIATION.md` with root-cause analysis.
- Version bumped `2.1 → 2.2`.

---

## v2.1 — June 2025

- Frontend complete with 10-step wizard, JWT auth, BTG modal, RBAC, idle timeout.
- PyJWT replaces python-jose (CVE remediation).
- AES-256-GCM PII encryption for CNIC + mobile.
- AWS KMS envelope encryption for production.
- sessionStorage form draft persistence (never localStorage).
- Self-hosted Inter fonts (no Google Fonts CDN).
- 27 Vitest tests. GitHub Actions CI with npm ci, npm audit, sourcemap check.

---

## v2.0 — June 2025

- Initial 10-step intake wizard. JWT auth gate. BTG modal. RBAC 6 roles. Idle timeout 15 min.
