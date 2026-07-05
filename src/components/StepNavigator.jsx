export default function StepNavigator({ steps, current, onGo, isOPD, hasCorporate }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "14px 16px",
      marginBottom: 16, overflowX: "auto",
      boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
    }}>
      <div style={{ display: "flex", gap: 4, minWidth: "max-content" }}>
        {steps.map((step, idx) => {
          const skipped =
            (step.id === 6 && !hasCorporate) ||
            (step.id === 9 && isOPD);
          const done    = step.id < current && !skipped;
          const active  = step.id === current;

          return (
            <button
              key={step.id}
              onClick={() => !skipped && onGo(step.id)}
              disabled={skipped}
              title={skipped ? "Not applicable for this patient type" : step.label}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, padding: "8px 10px", borderRadius: 10, border: "none",
                background: active
                  ? "#1D4ED8"
                  : done
                    ? "#DCFCE7"
                    : skipped
                      ? "#F3F4F6"
                      : "#F9FAFB",
                cursor: skipped ? "not-allowed" : "pointer",
                opacity: skipped ? 0.35 : 1,
                minWidth: 64, transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 16 }}>
                {done ? "✓" : step.icon}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: active ? "#fff" : done ? "#15803D" : skipped ? "#9CA3AF" : "#6B7280",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
              <span style={{
                fontSize: 9,
                color: active ? "rgba(255,255,255,0.7)" : "#D1D5DB",
              }}>
                {step.id}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
