interface SimilarityBarProps {
  label: string;
  value: number | null;
}

export default function SimilarityBar({ label, value }: SimilarityBarProps) {
  const hasValue = value != null;
  const pct = hasValue ? Math.round(value * 100) : null;
  const fillWidth = hasValue ? `${Math.min(100, Math.max(0, value * 100)).toFixed(1)}%` : "0%";

  return (
    <div className="sim-bar">
      <div className="sim-bar__label">{label}</div>
      <div
        className="sim-bar__track"
        role="meter"
        aria-label={label}
        aria-valuenow={hasValue ? value : undefined}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuetext={hasValue ? `${pct}%` : "측정불가"}
      >
        {hasValue ? (
          <div
            className="sim-bar__fill"
            style={{ width: fillWidth }}
          />
        ) : (
          <div className="sim-bar__fill sim-bar__fill--na" style={{ width: "100%" }} />
        )}
      </div>
      <div className="sim-bar__value" aria-hidden="true">
        {hasValue ? `${pct}%` : "측정불가"}
      </div>
    </div>
  );
}
