import type { MatchType } from "@/lib/substitutes";

interface MatchTypeBadgeProps {
  matchType: MatchType;
  confidence?: number | null;
}

const LABELS: Record<MatchType, string> = {
  exact: "정확 일치",
  substring: "부분 일치",
  fuzzy: "유사 일치",
  synonym: "동의어 일치",
  unmatched: "미매칭",
};

const MODIFIERS: Record<MatchType, string> = {
  exact: "exact",
  substring: "substring",
  fuzzy: "fuzzy",
  synonym: "synonym",
  unmatched: "unmatched",
};

export default function MatchTypeBadge({ matchType, confidence }: MatchTypeBadgeProps) {
  const label = LABELS[matchType] ?? matchType;
  const modifier = MODIFIERS[matchType] ?? "unmatched";
  const pct = confidence != null ? Math.round(confidence * 100) : null;

  return (
    <span className={`match-badge match-badge--${modifier}`} aria-label={`매칭 방식: ${label}`}>
      {label}
      {pct != null && matchType !== "exact" && (
        <span className="match-badge__confidence"> {pct}%</span>
      )}
    </span>
  );
}
