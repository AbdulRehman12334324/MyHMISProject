/**
 * ResetPasswordScreen.jsx — HIMS v2.3
 * =====================================
 * Step 2 of the password reset flow.
 * Staff enters the 6-digit OTP received by email + their new password.
 * On success, returns to LoginScreen so they can sign in.
 *
 * Security enforced here:
 *   - OTP is 6 digits, numeric only
 *   - Password strength: min 10 chars, uppercase, lowercase, digit, special char
 *   - Password confirm must match
 *   - OTP expiry messaging (backend returns 410 when OTP expired)
 *   - No plaintext OTP stored in state longer than needed
 *
 * Backend endpoint: POST /api/v1/auth/password-reset/confirm
 */

import { useState } from "react";
import { authApi } from "../api/himsApi";

const PASSWORD_RULES = [
  { label: "At least 10 characters",        test: v => v.length >= 10 },
  { label: "One uppercase letter (A–Z)",    test: v => /[A-Z]/.test(v) },
  { label: "One lowercase letter (a–z)",    test: v => /[a-z]/.test(v) },
  { label: "One digit (0–9)",               test: v => /\d/.test(v) },
  { label: "One special character (!@#$…)", test: v => /[^A-Za-z0-9]/.test(v) },
];

function isStrongPassword(password) {
  return PASSWORD_RULES.every(r => r.test(password));
}

export default function ResetPasswordScreen({ username, onBack, onSuccess }) {
  const [otp, setOtp]             = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (otp.replace(/\D/g, "").length !== 6) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password does not meet the requirements below.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.confirmPasswordReset(username, otp.trim(), password);
      setSuccess(true);
    } catch (err) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("expired") || msg.includes("410")) {
        setError("This reset code has expired. Please go back and request a new one.");
      } else if (msg.includes("invalid") || msg.includes("incorrect")) {
        setError("The code is incorrect. Check your email and try again.");
      } else {
        setError(err.message || "Password reset failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #14532D 0%, #166534 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif", padding: 16,
      }}>
        <div style={{
          background: "#fff", borderRadius: 20, padding: "40px 36px",
          width: "100%", maxWidth: 400, textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#14532D", margin: "0 0 10px" }}>
            Password Reset
          </h2>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, lineHeight: 1.6 }}>
            Your password has been changed successfully. You can now sign in
            with your new password.
          </p>
          <button
            onClick={onSuccess}
            style={{
              width: "100%", padding: "12px", borderRadius: 9, fontSize: 15,
              fontWeight: 700, background: "#1D4ED8", color: "#fff",
              border: "none", cursor: "pointer",
            }}
          >
            Sign In →
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #1D4ED8 0%, #0C4A6E 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 36px",
        width: "100%", maxWidth: 420,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>📧</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>
            Enter Reset Code
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6, lineHeight: 1.5 }}>
            A 6-digit code was sent to the email address registered
            for <strong>{username}</strong>.
          </p>
        </div>

        {/* OTP info banner */}
        <div style={{
          background: "#EFF6FF", border: "1px solid #BFDBFE",
          borderRadius: 8, padding: "10px 14px", marginBottom: 20,
          fontSize: 12, color: "#1E40AF",
        }}>
          ⏱ The code expires in <strong>15 minutes</strong>.
          Check your spam folder if you do not see it.
        </div>

        <form onSubmit={handleReset} method="post" action="#">
          {/* OTP field */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: "block", fontSize: 13, fontWeight: 600,
              color: "#374151", marginBottom: 6,
            }}>
              6-Digit Reset Code <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box", padding: "11px 14px",
                border: "1.5px solid #D1D5DB", borderRadius: 9,
                fontSize: 20, fontFamily: "monospace", letterSpacing: "0.3em",
                textAlign: "center", color: "#111827", outline: "none",
              }}
            />
          </div>

          {/* New password */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: "block", fontSize: 13, fontWeight: 600,
              color: "#374151", marginBottom: 6,
            }}>
              New Password <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create a strong password"
                autoComplete="new-password"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "11px 44px 11px 14px",
                  border: "1.5px solid #D1D5DB", borderRadius: 9,
                  fontSize: 14, color: "#111827", outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 15, color: "#6B7280",
                }}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Password strength checklist */}
          {password && (
            <div style={{ marginBottom: 16 }}>
              {PASSWORD_RULES.map(rule => (
                <div key={rule.label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, marginBottom: 3,
                  color: rule.test(password) ? "#16A34A" : "#9CA3AF",
                }}>
                  <span>{rule.test(password) ? "✓" : "○"}</span>
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Confirm password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block", fontSize: 13, fontWeight: 600,
              color: "#374151", marginBottom: 6,
            }}>
              Confirm New Password <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              style={{
                width: "100%", boxSizing: "border-box", padding: "11px 14px",
                border: `1.5px solid ${confirm && confirm !== password ? "#DC2626" : "#D1D5DB"}`,
                borderRadius: 9, fontSize: 14, color: "#111827", outline: "none",
              }}
            />
            {confirm && confirm !== password && (
              <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>
                ⚠ Passwords do not match
              </p>
            )}
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
            {loading ? "⏳ Resetting password..." : "Reset Password →"}
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
      </div>
    </div>
  );
}
