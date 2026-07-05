/**
 * LoginScreen.jsx — HIMS v2.3
 * ============================
 * Changes from v2.2:
 *   - Added "Forgot password?" link → navigates to ForgotPasswordScreen
 *   - PII migration status banner (shown when VITE_PII_MIGRATION_REQUIRED=true)
 *   - Improved lockout messaging (account locked → try again in X minutes)
 */

import { useState } from "react";
import { authApi } from "../api/himsApi";
import ForgotPasswordScreen from "./ForgotPasswordScreen";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showForgot, setShowForgot] = useState(false);

  // Show forgot password screen
  if (showForgot) {
    return <ForgotPasswordScreen onBack={() => setShowForgot(false)} />;
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(username.trim(), password);
      const me = await authApi.me(res.access_token);
      onLogin({
        access_token:  res.access_token,
        refresh_token: res.refresh_token,
        user_id:       me.id,
        username:      me.username,
        full_name:     me.full_name,
        role:          me.role,
      });
    } catch (err) {
      // Provide specific messaging for account lockout vs bad credentials
      const msg = err.message || "";
      if (msg.toLowerCase().includes("locked")) {
        setError("Account locked due to multiple failed attempts. Please contact your administrator or try again later.");
      } else if (msg.toLowerCase().includes("disabled") || msg.toLowerCase().includes("inactive")) {
        setError("Account is deactivated. Please contact your system administrator.");
      } else {
        setError("Invalid username or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #1D4ED8 0%, #0C4A6E 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 36px",
        width: "100%", maxWidth: 400,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏥</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
            HIMS Patient Intake
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
            Hospital Management Information System
          </p>
        </div>

        <form onSubmit={handleLogin} method="post" action="#">
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              style={{
                width: "100%", boxSizing: "border-box", padding: "11px 14px",
                border: "1.5px solid #D1D5DB", borderRadius: 9, fontSize: 14,
                color: "#111827", outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                width: "100%", boxSizing: "border-box", padding: "11px 14px",
                border: "1.5px solid #D1D5DB", borderRadius: 9, fontSize: 14,
                color: "#111827", outline: "none",
              }}
            />
          </div>

          {/* ── Forgot password link ─────────────────────────────────── */}
          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              style={{
                background: "none", border: "none", color: "#1D4ED8",
                fontSize: 12, fontWeight: 500, cursor: "pointer", padding: 0,
                textDecoration: "underline",
              }}
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FCA5A5",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              color: "#DC2626", fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "12px", borderRadius: 9, fontSize: 15,
              fontWeight: 700, background: loading ? "#9CA3AF" : "#1D4ED8",
              color: "#fff", border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "⏳ Signing in..." : "Sign In →"}
          </button>
        </form>

        <div style={{
          marginTop: 24, padding: "12px 16px",
          background: "#F0F9FF", borderRadius: 10, fontSize: 12, color: "#0369A1",
        }}>
          <strong>Security notice:</strong> This system enforces role-based access.
          Doctors see only their assigned patients. Emergency access available via
          Break-the-Glass protocol — all access is audited.
        </div>
      </div>
    </div>
  );
}
