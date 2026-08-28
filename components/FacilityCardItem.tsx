import Link from "next/link";
import type { FacilityCard } from "@/lib/types";

interface FacilityCardItemProps {
  facility: FacilityCard;
  lastProductionDate?: string | null;
}

export default function FacilityCardItem({
  facility,
  lastProductionDate,
}: FacilityCardItemProps) {
  const {
    mgt_no,
    name,
    biz_type,
    region_sido,
    region_sigungu,
    is_haccp,
    suspension_count,
  } = facility;

  const regionLabel = [region_sido, region_sigungu].filter(Boolean).join(" ");

  return (
    <article
      className="rounded-lg p-4 transition-shadow hover:shadow-md"
      style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
    >
      <Link
        href={`/facilities/${mgt_no}`}
        className="block"
        aria-label={`${name} 상세 보기`}
      >
        {/* Name */}
        <h3
          className="font-semibold text-base leading-tight mb-2"
          style={{ color: "var(--green-900)" }}
        >
          {name}
        </h3>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2 mb-2">
          {/* HACCP badge */}
          {is_haccp === 1 ? (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "var(--green-500)",
                color: "var(--green-cta-text)",
              }}
            >
              HACCP 인증
            </span>
          ) : (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "var(--rule)",
                color: "var(--ink-2)",
              }}
            >
              HACCP 미인증
            </span>
          )}

          {/* Biz type chip */}
          {biz_type && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "var(--green-100)",
                color: "var(--ink)",
              }}
            >
              {biz_type}
            </span>
          )}

          {/* Region chip */}
          {regionLabel && (
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                background: "var(--green-50)",
                color: "var(--ink-2)",
              }}
            >
              {regionLabel}
            </span>
          )}
        </div>

        {/* Suspension warning — dot + icon + text (not color alone) */}
        {suspension_count > 0 && (
          <p
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--warn)" }}
            role="alert"
            aria-label={`판매중지 이력 ${suspension_count}건`}
          >
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: "var(--warn)" }}
            />
            <span aria-hidden="true">⚠</span>
            판매중지 이력 {suspension_count}건
          </p>
        )}

        {/* Production date */}
        {lastProductionDate && (
          <p className="text-xs mt-1" style={{ color: "var(--ink-2)" }}>
            생산이력 최근: {lastProductionDate}
          </p>
        )}
      </Link>
    </article>
  );
}
