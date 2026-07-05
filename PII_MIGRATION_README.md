# 🔴 PII Migration — Run Before Go-Live

**File:** `scripts/migrate_encrypt_pii.py`
**Priority:** CRITICAL — must run on any database with existing patient data before production launch.

---

## What It Does

Encrypts any existing **plaintext CNIC and mobile number** values in the `patients` table with AES-256-GCM. Safe on live databases. Never deletes data. Skips already-encrypted values automatically.

---

## Setup

```bash
pip install cryptography psycopg2-binary python-dotenv
```

Ensure your `.env` has:
```
DATABASE_URL_SYNC=postgresql+psycopg2://hims_user:pass@localhost:5432/hims_db
FIELD_ENCRYPTION_KEY=<your 32-byte hex key>   # openssl rand -hex 32
HMAC_SECRET_KEY=<different 32-byte hex key>    # openssl rand -hex 32
```

---

## Run Order (Always dry-run first)

```bash
# Step 1 — Preview what will change (no writes):
python3 scripts/migrate_encrypt_pii.py --dry-run

# Step 2 — Review the log output from dry-run

# Step 3 — Run live:
python3 scripts/migrate_encrypt_pii.py
```

---

## Output

A timestamped log file is created in the current directory: `pii_migration_YYYYMMDD_HHMMSS.log`.

Every patient record processed is logged with:
- Patient UUID
- Fields encrypted (`cnic=ENCRYPTED`, `mobile_primary=ENCRYPTED`)
- CNIC HMAC prefix for verification (first 8 chars of hash)
- Fields skipped (already encrypted)

---

## Backend E2E Tests Status

| Item | Status |
|------|--------|
| PII migration script | ✅ Delivered (this file) |
| Backend E2E tests (pytest) | 🔴 Pending — Step 2 |
| Password reset (frontend) | ✅ Delivered (v2.3) |
| Password reset (backend endpoints) | 🔴 Pending — Step 2 |
| Staging deployment | 🔴 Pending |

**Backend E2E test suite** will cover all 14 endpoints with JWT, RBAC, BTG, and doctor scoping scenarios. Pending your go-ahead for Step 2.
