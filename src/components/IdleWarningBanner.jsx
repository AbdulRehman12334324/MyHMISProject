/**
 * IdleWarningBanner.jsx
 * Shows a full-screen modal when the session is about to expire due to inactivity.
 * Countdown visible so the clinician knows exactly how long they have.
 */
export default function IdleWarningBanner({ countdown, onStayActive }) {
  const mins = Math.floor(countdown / 60);
  const secs = String(countdown % 60).padStart(2, "0");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "40px 36px",
        maxWidth: 440, width: "100%", textAlign: "center",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        border: "3px solid #D97706",
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>⏱️</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#92400E", marginBottom: 8 }}>
          Session Expiring Soon
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
          This session will automatically log out in:
        </p>
        <div style={{
          fontSize: 56, fontWeight: 900, color: countdown <= 30 ? "#DC2626" : "#D97706",
          fontFamily: "monospace", marginBottom: 20,
          transition: "color 0.3s",
        }}>
          {mins}:{secs}
        </div>
        <p style={{
          fontSize: 12, color: "#6B7280", marginBottom: 24, lineHeight: 1.5,
          background: "#FFFBEB", borderRadius: 8, padding: "10px 14px",
        }}>
          For patient data security, sessions are limited to 15 minutes of inactivity.
          Your form data is saved — you will not lose registration progress.
        </p>
        <button
          onClick={onStayActive}
          style={{
            width: "100%", padding: "13px", borderRadius: 9,
            fontSize: 15, fontWeight: 700,
            background: "#D97706", color: "#fff",
            border: "none", cursor: "pointer",
          }}
        >
          I'm Still Here — Keep Session Active
        </button>
      </div>
    </div>
  );
}
