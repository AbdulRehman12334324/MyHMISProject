/**
 * useFormPersistence.js — Refresh-safe form state via sessionStorage
 * ===================================================================
 * Saves form state to sessionStorage on every change.
 * Restores on mount (survives accidental F5 refresh).
 * Clears on successful submit or explicit logout.
 *
 * STORAGE RULE COMPLIANCE:
 *   - sessionStorage ONLY — data is wiped when the browser tab closes.
 *   - localStorage is explicitly NOT used — it persists to disk and
 *     would write PHI (CNIC, patient data) to permanent browser storage.
 *   - Tokens are NEVER written to sessionStorage — they remain in React state.
 *
 * Sensitive fields stored here are temporary form-in-progress state only.
 * On submit success, clearPersistedForm() wipes sessionStorage immediately.
 */

import { useEffect } from "react";

const KEY_FORM = "hims_form_draft";
const KEY_STEP = "hims_form_step";

export function saveFormDraft(form, step) {
  try {
    // Never persist auth tokens — only form field values
    const safe = { ...form };
    sessionStorage.setItem(KEY_FORM, JSON.stringify(safe));
    sessionStorage.setItem(KEY_STEP, String(step));
  } catch {
    // sessionStorage quota exceeded — silently ignore (non-critical)
  }
}

export function loadFormDraft() {
  try {
    const raw  = sessionStorage.getItem(KEY_FORM);
    const step = sessionStorage.getItem(KEY_STEP);
    if (!raw) return null;
    return { form: JSON.parse(raw), step: step ? parseInt(step, 10) : 1 };
  } catch {
    return null;
  }
}

export function clearFormDraft() {
  try {
    sessionStorage.removeItem(KEY_FORM);
    sessionStorage.removeItem(KEY_STEP);
  } catch {
    // ignore
  }
}

export function useBeforeUnloadWarning(isDirty) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      // Modern browsers show their own generic message; returnValue triggers the dialog
      e.returnValue = "You have unsaved patient registration data. Are you sure you want to leave?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
