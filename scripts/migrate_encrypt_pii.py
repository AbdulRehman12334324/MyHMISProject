#!/usr/bin/env python3
"""
migrate_encrypt_pii.py — HIMS PII Migration Script
====================================================
🔴 CRITICAL OPEN ITEM — Context Memory Section 6, Priority 1

Encrypts existing PLAINTEXT CNIC and mobile values in the patients table
with AES-256-GCM before go-live. Safe to run on live databases.

HOW IT WORKS:
  1. Reads patients in batches (default: 100 per commit)
  2. Detects whether each CNIC / mobile value is already encrypted
     (base64 AES-GCM ciphertext is >= 40 chars and decodes to >= 29 bytes)
  3. Encrypts plaintext values in-place
  4. Generates cnic_hash (HMAC-SHA256) for each newly encrypted CNIC
  5. Logs every record touched with patient ID + action
  6. Commits each batch, then continues
  7. Never deletes data — only rewrites encrypted fields

PREREQUISITES:
  pip install cryptography psycopg2-binary python-dotenv

USAGE:
  # Always dry-run first:
  python3 scripts/migrate_encrypt_pii.py --dry-run

  # Then run live:
  python3 scripts/migrate_encrypt_pii.py

  # Custom batch size for large datasets:
  python3 scripts/migrate_encrypt_pii.py --batch-size 500

ENVIRONMENT VARIABLES (reads from .env in project root):
  DATABASE_URL_SYNC       postgresql+psycopg2://user:pass@host/db
  FIELD_ENCRYPTION_KEY    32-byte hex key (openssl rand -hex 32)
  HMAC_SECRET_KEY         32-byte hex key (different from above)
  KMS_KEY_ARN             (optional) AWS KMS key — overrides FIELD_ENCRYPTION_KEY
  AWS_REGION              (default: us-east-1)
"""

import sys
import os
import argparse
import base64
import hashlib
import hmac
import secrets
import logging
from datetime import datetime

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    sys.exit("ERROR: cryptography not installed. Run: pip install cryptography")

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # .env loading is optional

# ── Logging ───────────────────────────────────────────────────────────────────
log_filename = f"pii_migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_filename),
    ],
)
log = logging.getLogger(__name__)


# ── Key loading ───────────────────────────────────────────────────────────────

def _load_aes_key() -> bytes:
    """Load AES-256 key from environment. KMS takes priority over direct key."""
    kms_arn = os.environ.get("KMS_KEY_ARN", "")
    if kms_arn:
        return _fetch_kms_key(kms_arn)

    raw = os.environ.get("FIELD_ENCRYPTION_KEY", "")
    if not raw:
        sys.exit(
            "ERROR: Neither KMS_KEY_ARN nor FIELD_ENCRYPTION_KEY is set.\n"
            "Set FIELD_ENCRYPTION_KEY in your .env file (openssl rand -hex 32)."
        )
    try:
        key = bytes.fromhex(raw)
    except ValueError:
        sys.exit("ERROR: FIELD_ENCRYPTION_KEY is not valid hex. Re-generate with: openssl rand -hex 32")

    if len(key) != 32:
        sys.exit(f"ERROR: FIELD_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got {len(key)} bytes.")
    return key


def _fetch_kms_key(kms_arn: str) -> bytes:
    try:
        import boto3
        region = os.environ.get("AWS_REGION", "us-east-1")
        client = boto3.client("kms", region_name=region)
        response = client.generate_data_key(KeyId=kms_arn, KeySpec="AES_256")
        return response["Plaintext"]
    except Exception as exc:
        sys.exit(f"ERROR: AWS KMS GenerateDataKey failed: {exc}")


def _load_hmac_key() -> bytes:
    raw = os.environ.get("HMAC_SECRET_KEY", "")
    if not raw:
        sys.exit("ERROR: HMAC_SECRET_KEY is not set. Set it in your .env file.")
    try:
        return bytes.fromhex(raw)
    except ValueError:
        sys.exit("ERROR: HMAC_SECRET_KEY is not valid hex.")


# ── Crypto helpers ────────────────────────────────────────────────────────────

def encrypt_field(plaintext: str, key: bytes) -> str:
    """AES-256-GCM encrypt. Returns base64(nonce + ciphertext_with_tag)."""
    aesgcm = AESGCM(key)
    nonce  = secrets.token_bytes(12)
    ct     = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def hmac_cnic(cnic: str, key: bytes) -> str:
    """HMAC-SHA256 of normalised CNIC for exact-match search."""
    normalised = cnic.replace("-", "").replace(" ", "").lower()
    return hmac.new(key, normalised.encode("utf-8"), hashlib.sha256).hexdigest()


def is_already_encrypted(value: str) -> bool:
    """
    Heuristic: Is this value already AES-256-GCM ciphertext?
    Valid ciphertext: base64-encoded, decodes to >= 29 bytes (12 nonce + 1 min + 16 tag).
    """
    if not value or len(value) < 40:
        return False
    try:
        decoded = base64.b64decode(value)
        return len(decoded) >= 29
    except Exception:
        return False


# ── DB connection ─────────────────────────────────────────────────────────────

def get_connection():
    url = os.environ.get("DATABASE_URL_SYNC", "")
    if not url:
        sys.exit(
            "ERROR: DATABASE_URL_SYNC is not set.\n"
            "Example: postgresql+psycopg2://hims_user:pass@localhost:5432/hims_db"
        )
    # Strip SQLAlchemy driver prefix if present
    url = url.replace("postgresql+psycopg2://", "postgresql://")
    try:
        return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)
    except Exception as exc:
        sys.exit(f"ERROR: Cannot connect to database: {exc}")


# ── Main migration ────────────────────────────────────────────────────────────

def migrate_pii(dry_run: bool = False, batch_size: int = 100) -> None:
    log.info("=" * 70)
    log.info("HIMS PII Migration — Starting")
    log.info(f"Mode:        {'DRY RUN — no writes' if dry_run else 'LIVE — writing to DB'}")
    log.info(f"Batch size:  {batch_size}")
    log.info(f"Log file:    {log_filename}")
    log.info("=" * 70)

    aes_key  = _load_aes_key()
    hmac_key = _load_hmac_key()
    conn     = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM patients WHERE is_active = true")
            total = cur.fetchone()["cnt"]
            log.info(f"Total active patients: {total}")

        processed         = 0
        cnic_encrypted    = 0
        mobile_encrypted  = 0
        already_encrypted = 0
        errors            = 0
        offset            = 0

        while True:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, cnic, cnic_hash, mobile_primary, mobile_secondary
                    FROM patients
                    WHERE is_active = true
                    ORDER BY created_at ASC
                    LIMIT %s OFFSET %s
                    """,
                    (batch_size, offset),
                )
                rows = cur.fetchall()

            if not rows:
                break

            batch_updates = []
            for row in rows:
                pid    = str(row["id"])
                update = {}
                notes  = []

                # ── CNIC ─────────────────────────────────────────────────────
                if row["cnic"]:
                    if is_already_encrypted(row["cnic"]):
                        already_encrypted += 1
                        notes.append("cnic=SKIP(encrypted)")
                    else:
                        try:
                            update["cnic"]      = encrypt_field(row["cnic"], aes_key)
                            update["cnic_hash"] = hmac_cnic(row["cnic"], hmac_key)
                            cnic_encrypted     += 1
                            notes.append(f"cnic=ENCRYPTED hash={update['cnic_hash'][:8]}…")
                        except Exception as exc:
                            log.error(f"Patient {pid}: CNIC encryption failed: {exc}")
                            errors += 1

                # ── mobile_primary ────────────────────────────────────────────
                if row["mobile_primary"]:
                    if is_already_encrypted(row["mobile_primary"]):
                        notes.append("mobile_primary=SKIP(encrypted)")
                    else:
                        try:
                            update["mobile_primary"] = encrypt_field(row["mobile_primary"], aes_key)
                            mobile_encrypted        += 1
                            notes.append("mobile_primary=ENCRYPTED")
                        except Exception as exc:
                            log.error(f"Patient {pid}: mobile_primary failed: {exc}")
                            errors += 1

                # ── mobile_secondary ──────────────────────────────────────────
                if row["mobile_secondary"] and not is_already_encrypted(row["mobile_secondary"]):
                    try:
                        update["mobile_secondary"] = encrypt_field(row["mobile_secondary"], aes_key)
                        notes.append("mobile_secondary=ENCRYPTED")
                    except Exception as exc:
                        log.error(f"Patient {pid}: mobile_secondary failed: {exc}")
                        errors += 1

                if update:
                    batch_updates.append((pid, update, notes))
                    log.info(f"[{'DRY RUN' if dry_run else 'UPDATE'}] Patient {pid}: {', '.join(notes)}")
                else:
                    log.debug(f"Patient {pid}: nothing to encrypt")

                processed += 1

            # Write batch
            if not dry_run and batch_updates:
                with conn.cursor() as cur:
                    for pid, update, _ in batch_updates:
                        set_parts = [f"{k} = %s" for k in update]
                        values    = list(update.values()) + [pid]
                        cur.execute(
                            f"UPDATE patients SET {', '.join(set_parts)}, updated_at = NOW() WHERE id = %s",
                            values,
                        )
                conn.commit()
                log.info(f"Committed batch — total processed: {processed}/{total}")

            offset += batch_size
            if offset >= total:
                break

    finally:
        conn.close()

    log.info("=" * 70)
    log.info("Migration Complete")
    log.info(f"Processed:         {processed}")
    log.info(f"CNIC encrypted:    {cnic_encrypted}")
    log.info(f"Mobile encrypted:  {mobile_encrypted}")
    log.info(f"Already encrypted: {already_encrypted}")
    log.info(f"Errors:            {errors}")
    log.info(f"Mode:              {'DRY RUN — no changes written' if dry_run else 'LIVE'}")

    if errors > 0:
        log.error(f"\n⚠  {errors} records had errors — review log: {log_filename}")
        sys.exit(1)
    else:
        log.info("\n✅ Migration completed without errors.")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="HIMS PII Migration: Encrypt plaintext CNIC/mobile in the patients table"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview changes without writing to the database (always run this first)"
    )
    parser.add_argument(
        "--batch-size", type=int, default=100,
        help="Number of patient records to process per DB commit (default: 100)"
    )
    args = parser.parse_args()

    if not args.dry_run:
        print(
            "\n⚠  LIVE MODE: This will ENCRYPT plaintext CNIC/mobile values in the database.\n"
            "   Always run --dry-run first to preview what will change.\n"
        )
        confirm = input("Type 'yes' to proceed with live encryption: ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            sys.exit(0)

    migrate_pii(dry_run=args.dry_run, batch_size=args.batch_size)
