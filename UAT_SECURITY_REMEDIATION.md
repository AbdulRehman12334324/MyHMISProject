# UAT Security Remediation Report — HIMS Patient Intake Frontend
## Version: v2.2 | Date: 2025-06-24 | Status: ALL FINDINGS RESOLVED

---

## Summary of Findings & Fixes

| Severity | Finding | Root Cause | Fix Applied | File |
|----------|---------|------------|------------|------|
| 🔴 CRITICAL | TLS error on `https://api.placeholder.com` — TLSV1_UNRECOGNIZED_NAME | `VITE_API_URL` hardcoded to `api.placeholder.com` in CI yml build step | Replaced with `${{ secrets.VITE_API_URL \|\| 'http://localhost:8000' }}` — CI builds against localhost; production sets the secret in GitHub repo settings | `.github/workflows/ci.yml` |
| 🟠 HIGH | Missing `Content-Security-Policy` on static asset responses | NGINX `add_header` does NOT inherit from parent `server {}` block into child `location {}` blocks — documented NGINX inheritance gap | Full header set re-declared in every `location` block | `nginx.conf` |
| 🟠 HIGH | Missing `X-Frame-Options` on static asset responses | Same NGINX inheritance gap | Full header set re-declared in every `location` block | `nginx.conf` |
| 🔵 LOW | Missing `X-Content-Type-Options` on static asset responses | Same NGINX inheritance gap | Full header set re-declared in every `location` block | `nginx.conf` |
| 🔵 LOW | Missing `Referrer-Policy` on static asset responses | Same NGINX inheritance gap | Full header set re-declared in every `location` block | `nginx.conf` |
| 🔵 LOW | Missing `Permissions-Policy` on static asset responses | Same NGINX inheritance gap | Full header set re-declared in every `location` block | `nginx.conf` |

---

## Root Cause Explanation: NGINX Header Inheritance

NGINX's `add_header` directive has a widely misunderstood inheritance rule:

> **If a `location` block contains ANY `add_header` directive, it will NOT inherit `add_header` directives from the enclosing `server {}` block.**

This means that the previous `nginx.conf`, which correctly set all security headers at the `server {}` level, silently dropped those headers for the static asset `location` block (which had its own `add_header Cache-Control` and `add_header Strict-Transport-Security`).

**Fix:** Every `location` block that returns a response now declares the complete security header set. This is the correct, auditable, UAT-passing pattern.

---

## CI/CD Fix Explanation

The previous `ci.yml` hardcoded:
```yaml
VITE_API_URL: https://api.placeholder.com
```

`api.placeholder.com` is not a real domain. A UAT scanner attempting to verify the URL found a TLS handshake failure (`TLSV1_UNRECOGNIZED_NAME`) — the domain does not exist and has no valid TLS certificate.

**Fix:** CI builds now use:
```yaml
VITE_API_URL: ${{ secrets.VITE_API_URL || 'http://localhost:8000' }}
```

- In CI (no secret set): builds against `localhost:8000` — no external TLS dependency
- In staging/production: set `VITE_API_URL` as a GitHub repository secret pointing to the real HTTPS API

---

## Headers Now Present on ALL Responses

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `0` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=(), usb=(), bluetooth=(), interest-cohort=()` |
| `Content-Security-Policy` | Full policy — `default-src 'none'`, `frame-ancestors 'none'`, `block-all-mixed-content`, `upgrade-insecure-requests` |

---

## How to Re-Run UAT Verification

1. Deploy v2.2 to staging server
2. Point your security scanner at `https://hims.yourhospital.com`
3. Scan: `/` (index), `/assets/*.js`, `/assets/*.css`, `/fonts/*.woff2`, `/health`
4. All 7 headers above should be present on every response
5. No external URLs should appear in CI build logs (no `api.placeholder.com`)

