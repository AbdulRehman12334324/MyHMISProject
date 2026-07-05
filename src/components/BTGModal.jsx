import { useState } from "react";
import { authApi } from "../api/himsApi";

const BTG_REASONS = [
  "Unconscious patient — immediate life threat",
  "Severe trauma / Road traffic accident",
  "Cardiac arrest / Resuscitation",
  "Acute allergic reaction / Anaphylaxis",
  "Respiratory failure / Airway emergency",
  "Severe sepsis or septic shock",
  "Acute stroke — time-critical intervention",
  "Major haemorrhage — surgical emergency",
  "Overdose / Poisoning",
  "Obstetric emergency",
  "Other clinical emergency (specify below)",
];

export default function BTGModal({ auth, onActivated, onClose }) {
  const [patientId, setPatientId]   = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [confirmed, setConfirmed]   = useState(false);

  const finalReason = selectedReason === "Other clinical emergency (specify below)"
    ? customReason.trim()
    : selectedReason;

  async function handleActivate() {
    if (!patientId.trim()) { setError("Patient ID is required."); return; }
    if (!finalReason || finalReason.length < 20) {
      setError("Please select a reason (or type at least 20 characters for custom reason).");
      return;
    }
    if (!confirmed) { setError("Please confirm this is a genuine clinical emergency."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await authApi.activateBTG(
        auth.access_token,
        patientId.trim(),
        finalReason,
      );
      onActivated(res.btg_token);
    } catch (err) {
      setError(err.message || "BTG activation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520,
        boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
        border: "3px solid #DC2626",
      }}>
        {/* Header */}
        <div style={{
          background: "#DC2626", color: "#fff", padding: "16px 24px",
          borderRadius: "13px 13px 0 0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>🚨 Break-the-Glass Emergency Access</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              This access is logged, audited, and reviewed by administration
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 18,
          }}>✕</button>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {/* Warning box */}
          <div style={{
            background: "#FEF3C7", border: "1.5px solid #F59E0B",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#92400E",
          }}>
            <strong>⚠ Important:</strong> Break-the-Glass bypasses patient scope restrictions.
            A permanent, tamper-proof audit entry will be created immediately.
            Misuse will result in disciplinary action. Use only for genuine clinical emergencies.
          </div>

          {/* Patient ID */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Patient ID <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              placeholder="Enter the patient's system ID"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px",
                border: "1.5px solid #D1D5DB", borderRadius: 8, fontSize: 14,
              }}
            />
          </div>

          {/* Clinical reason */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
              Clinical Emergency Reason <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {BTG_REASONS.map(r => (
                <label key={r} style={{
                  display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                  padding: "8px 10px", borderRadius: 8, fontSize: 13,
                  background: selectedReason === r ? "#FEF2F2" : "#F9FAFB",
                  border: `1.5px solid ${selectedReason === r ? "#DC2626" : "#E5E7EB"}`,
                }}>
                  <input
                    type="radio"
                    name="btg_reason"
                    value={r}
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                    style={{ marginTop: 1 }}
                  />
                  <span style={{ color: selectedReason === r ? "#991B1B" : "#374151" }}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom reason field */}
          {selectedReason === "Other clinical emergency (specify below)" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Describe the Emergency (min 20 characters) <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                rows={3}
                placeholder="Describe the clinical emergency in detail..."
                style={{
                  width: "100%", boxSizing: "border-box", padding: "10px 12px",
                  border: "1.5px solid #D1D5DB", borderRadius: 8, fontSize: 14,
                  fontFamily: "inherit", resize: "vertical",
                }}
              />
              <div style={{ fontSize: 12, color: customReason.length >= 20 ? "#16A34A" : "#9CA3AF", marginTop: 4 }}>
                {customReason.length} / 20 characters minimum
              </div>
            </div>
          )}

          {/* Confirmation checkbox */}
          <label style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            marginBottom: 16, cursor: "pointer",
            background: "#FFF7ED", border: "1.5px solid #FDBA74",
            borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#7C2D12",
          }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              I confirm this is a <strong>genuine clinical emergency</strong>.
              I understand this access is permanently recorded and will be reviewed
              by administration. I accept responsibility for this bypass.
            </span>
          </label>

          {error && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FCA5A5",
              borderRadius: 8, padding: "10px 14px", marginBottom: 14,
              color: "#DC2626", fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: "#fff", border: "1.5px solid #D1D5DB", color: "#374151", cursor: "pointer",
            }}>
              Cancel
            </button>
            <button onClick={handleActivate} disabled={loading} style={{
              flex: 2, padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: loading ? "#9CA3AF" : "#DC2626",
              color: "#fff", border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "⏳ Activating..." : "🚨 Activate Emergency Access"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
