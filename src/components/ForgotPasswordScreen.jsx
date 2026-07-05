/**
 * ForgotPasswordScreen.jsx — HIMS v2.3
 * ======================================
 * Step 1 of the password reset flow.
 * Staff enters their username. Backend sends a one-time code to their
 * registered email address. On success, transitions to ResetPasswordScreen.
 *
 * Open item closed: 🟠 "Password reset flow" from context memory Section 6.
 * Backend endpoint: POST /api/v1/auth/password-reset/request
 */

import { useState } from "react";
import { authApi } from "../api/himsApi";
import ResetPasswordScreen from "./ResetPasswordScreen";

export default function ForgotPasswordScreen({ onBack }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [otpSent, setOtpSent]   = useState(false);

  // After OTP is sent, transition to reset screen
  if (otpSent) {
    return (
      <ResetPasswordScreen
        username={username}
        onBack={onBack}
        onSuccess={onBack}
      />
    );
  }

  async function handleRequest(e) {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.requestPasswordReset(username.trim());
      setOtpSent(true);
    } catch (err) {
      // Security: do NOT reveal whether the username exists or not.
      // Always show the same message — prevents username enumeration.
      // The backend also returns 200 even for unknown usernames.
      setOtpSent(true);
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
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🔑</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>
            Reset Your Password
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6, lineHeight: 1.5 }}>
            Enter your username. A one-time reset code will be sent to your
            registered email address.
          </p>
        </div>

        <form onSubmit={handleRequest} method="post" action="#">
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block", fontSize: 13, fontWeight: 600,
              color: "#374151", marginBottom: 6,
            }}>
              Username <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box", padding: "11px 14px",
                border: `1.5px solid ${error ? "#DC2626" : "#D1D5DB"}`,
                borderRadius: 9, fontSize: 14, color: "#111827", outline: "none",
              }}
            />
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
              marginBottom: 12,
            }}
          >
            {loading ? "⏳ Sending code..." : "Send Reset Code →"}
          </button>

          <button
            type="button"
            onClick={onBack}
            style={{
              width: "100%", padding: "10px", borderRadius: 9, fontSize: 14,
              fontWeight: 600, background: "#fff",
              color: "#6B7280", border: "1.5px solid #E5E7EB", cursor: "pointer",
            }}
          >
            ← Back to Sign In
          </button>
        </form>

        <div style={{
          marginTop: 20, padding: "10px 14px",
          background: "#FFFBEB", borderRadius: 10, fontSize: 12, color: "#92400E",
        }}>
          <strong>No email on file?</strong> Contact your HIMS administrator
          to reset your password directly.
        </div>
      </div>
    </div>
  );
}
