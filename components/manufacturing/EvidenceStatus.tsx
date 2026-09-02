import type { EvidenceStatus as EvidenceStatusType } from "@/lib/manufacturing-match";

const STATUS_LABEL: Record<EvidenceStatusType, string> = { match: "충족", unmet: "미충족", unknown: "미확인" };

export default function EvidenceStatus({ status }: { status: EvidenceStatusType }) {
  return <span className={`evidence-status evidence-status--${status}`}>{STATUS_LABEL[status]}</span>;
}
