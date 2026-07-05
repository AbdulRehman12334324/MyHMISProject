import { useState } from "react";

export default function SuccessScreen({ success, onNew, auth }) {
  const [copied, setCopied] = useState(false);

  function copyMR() {
    navigator.clipboard.writeText(success.mr_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #14532D 0%, #166534 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 36px",
        maxWidth: 460, width: "100%", textAlign: "center",
        boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#14532D", margin: "0 0 8px" }}>
          Patient Registered
        </h1>
        <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 28 }}>
          {success.patient_name} has been successfully registered in HIMS.
        </p>

        {/* MR Number display */}
        <div style={{
          background: "#F0FDF4", border: "2px solid #86EFAC",
          borderRadius: 14, padding: "20px 24px", marginBottom: 28,
        }}>
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Medical Record Number
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#15803D",
            letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 14 }}>
            {success.mr_number}
          </div>
          <button onClick={copyMR} style={{
            padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: copied ? "#15803D" : "#1D4ED8",
            color: "#fff", border: "none", cursor: "pointer",
            transition: "background 0.2s",
          }}>
            {copied ? "✓ Copied!" : "📋 Copy MR Number"}
          </button>
        </div>

        <div style={{
          background: "#F0F9FF", border: "1px solid #BAE6FD",
          borderRadius: 10, padding: "12px 16px", marginBottom: 24,
          fontSize: 12, color: "#0369A1", textAlign: "left",
        }}>
          <strong>Next steps:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
            <li>Give the MR number to the patient</li>
            <li>Send patient to the assigned department</li>
            <li>Admission slip will be printed by the ward nurse</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onNew} style={{
            flex: 1, padding: "12px", borderRadius: 9, fontSize: 14, fontWeight: 700,
            background: "#1D4ED8", color: "#fff", border: "none", cursor: "pointer",
          }}>
            + Register New Patient
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: "#9CA3AF" }}>
          Registered by {auth.full_name} · {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}
