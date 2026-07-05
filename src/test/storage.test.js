/**
 * storage.test.js — Verify no localStorage usage
 * Ensures PHI is never written to persistent browser storage.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveFormDraft, loadFormDraft, clearFormDraft } from "../hooks/useFormPersistence";

describe("Form Persistence — sessionStorage ONLY", () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Spy to ensure localStorage is never touched
    vi.spyOn(Storage.prototype, "setItem");
  });

  it("saves draft to sessionStorage", () => {
    const form = { first_name:"Ahmed", last_name:"Khan" };
    saveFormDraft(form, 3);
    const draft = loadFormDraft();
    expect(draft.form.first_name).toBe("Ahmed");
    expect(draft.step).toBe(3);
  });

  it("clears draft from sessionStorage", () => {
    saveFormDraft({ first_name:"Test" }, 1);
    clearFormDraft();
    expect(loadFormDraft()).toBeNull();
  });

  it("never writes to localStorage", () => {
    const localSpy = vi.spyOn(window.localStorage, "setItem");
    saveFormDraft({ first_name:"Ahmed" }, 1);
    expect(localSpy).not.toHaveBeenCalled();
  });

  it("returns null when no draft exists", () => {
    expect(loadFormDraft()).toBeNull();
  });
});
