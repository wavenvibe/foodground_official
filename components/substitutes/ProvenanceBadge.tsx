import type { MatchType } from "@/lib/substitutes";

interface ProvenanceBadgeProps {
  matchType: MatchType;
  inputName: string;
  matchedName: string;
}

const PROVENANCE: Record<MatchType, string | null> = {
  exact: null,
  substring: "입력어가 식품명에 포함되어 매칭됨",
  fuzzy: "유사도 기반 근사 매칭",
  synonym: "동의어 사전 기반 매칭",
  unmatched: null,
};

export default function ProvenanceBadge({ matchType, inputName, matchedName }: ProvenanceBadgeProps) {
  const note = PROVENANCE[matchType];
  if (!note) return null;

  return (
    <div className="provenance-badge" role="note" aria-label="매칭 출처 안내">
      <span className="provenance-badge__icon" aria-hidden="true">ℹ</span>
      <span className="provenance-badge__text">
        입력한 <strong>&ldquo;{inputName}&rdquo;</strong>이(가) 표준식품명{" "}
        <strong>&ldquo;{matchedName}&rdquo;</strong>으로 매칭되었습니다. {note}.
      </span>
    </div>
  );
}
