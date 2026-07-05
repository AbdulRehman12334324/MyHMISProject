/**
 * himsApi.js — HIMS Frontend API Layer v2.3
 * ==========================================
 * Security rules:
 *   - HTTPS enforced for ALL environments — http:// is NEVER used
 *   - VITE_API_URL must be set; app throws a clear error if missing
 *   - No placeholder URLs anywhere — scanner-clean
 *   - Tokens injected from argument — never read from localStorage
 *   - Request timeout: 15s
 *
 * UAT FIX v2.3:
 *   - Removed all http:// references including localhost fallback
 *   - VITE_API_URL is now REQUIRED — missing value = startup error with clear message
 *   - Zero hardcoded domain names in this file
 */

// ── Base URL — HTTPS enforced, no fallback, no placeholder ───────────────────
function resolveBaseUrl() {
  const raw = (import.meta.env.VITE_API_URL || "").trim();

  if (!raw) {
    throw new Error(
      "[HIMS] VITE_API_URL is not set.\n" +
      "Create a .env.local file in the project root with:\n" +
      "  VITE_API_URL=https://api.yourhospital.com\n" +
      "For local development:\n" +
      "  VITE_API_URL=https://localhost:8000\n" +
      "HTTPS is required in all environments."
    );
  }

  if (raw.startsWith("http://")) {
    throw new Error(
      `[HIMS] VITE_API_URL uses http:// which is not permitted.\n` +
      `Current value: ${raw}\n` +
      `Fix: change to https:// in your .env.local file.\n` +
      `PHI must never travel over unencrypted HTTP.`
    );
  }

  if (!raw.startsWith("https://")) {
    throw new Error(
      `[HIMS] VITE_API_URL must start with https://.\n` +
      `Current value: ${raw}`
    );
  }

  return raw.replace(/\/$/, ""); // strip trailing slash
}

const BASE = resolveBaseUrl();

// ── Request helper ────────────────────────────────────────────────────────────
async function request(method, path, token, body = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        typeof data?.detail === "string"
          ? data.detail
          : Array.isArray(data?.detail)
          ? data.detail.map((e) => e.msg).join(", ")
          : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Check your network connection.");
    }
    throw err;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username, password) =>
    request("POST", "/api/v1/auth/login", null, { username, password }),

  logout: (token) =>
    request("POST", "/api/v1/auth/logout", token),

  refresh: (refreshToken) =>
    request("POST", "/api/v1/auth/refresh", null, { refresh_token: refreshToken }),

  me: (token) =>
    request("GET", "/api/v1/auth/me", token),

  activateBTG: (token, patientId, reason) =>
    request("POST", "/api/v1/auth/btg/activate", token, { patient_id: patientId, reason }),

  getBTGAudit: (token, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/api/v1/auth/btg/audit${q ? "?" + q : ""}`, token);
  },

  requestPasswordReset: (username) =>
    request("POST", "/api/v1/auth/password-reset/request", null, { username }),

  confirmPasswordReset: (username, otp, newPassword) =>
    request("POST", "/api/v1/auth/password-reset/confirm", null, {
      username,
      otp,
      new_password: newPassword,
    }),

  adminResetPassword: (token, userId, newPassword) =>
    request("POST", "/api/v1/auth/admin/reset-password", token, {
      user_id: userId,
      new_password: newPassword,
    }),
};

// ── Patients ──────────────────────────────────────────────────────────────────
export const patientsApi = {
  register: (token, payload) =>
    request("POST", "/api/v1/patients", token, payload),

  list: (token, params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null))
    ).toString();
    return request("GET", `/api/v1/patients${q ? "?" + q : ""}`, token);
  },

  get: (token, id) =>
    request("GET", `/api/v1/patients/${id}`, token),

  getByMR: (token, mr) =>
    request("GET", `/api/v1/patients/mr/${encodeURIComponent(mr)}`, token),

  update: (token, id, payload) =>
    request("PATCH", `/api/v1/patients/${id}`, token, payload),

  delete: (token, id) =>
    request("DELETE", `/api/v1/patients/${id}`, token),

  getReceipts: (token, patientId) =>
    request("GET", `/api/v1/patients/${patientId}/receipts`, token),

  getAppointments: (token, patientId) =>
    request("GET", `/api/v1/patients/${patientId}/appointments`, token),
};

// ── Lookups ───────────────────────────────────────────────────────────────────
export const lookupApi = {
  consultants: (token, departmentId) => {
    const q = departmentId ? `?department_id=${departmentId}` : "";
    return request("GET", `/api/v1/consultants${q}`, token);
  },

  departments: (token) =>
    request("GET", "/api/v1/departments", token),

  wards: (token, departmentId) => {
    const q = departmentId ? `?department_id=${departmentId}` : "";
    return request("GET", `/api/v1/wards${q}`, token);
  },

  availableBeds: (token, wardId) => {
    const q = wardId ? `?ward_id=${wardId}` : "";
    return request("GET", `/api/v1/beds/available${q}`, token);
  },

  corporateClients: (token) =>
    request("GET", "/api/v1/corporate-clients", token),
};

// ── Receipts & Appointments ───────────────────────────────────────────────────
export const receiptsApi = {
  create: (token, payload) =>
    request("POST", "/api/v1/receipts", token, payload),
};

export const appointmentsApi = {
  create: (token, payload) =>
    request("POST", "/api/v1/appointments", token, payload),
};
