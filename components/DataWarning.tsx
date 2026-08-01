interface DataWarningProps {
  syncDate?: string;
  facilityAt?: string;
  productionAt?: string;
  haccpAt?: string;
  suspensionAt?: string;
}

function fmt(iso: string | undefined): string {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

export default function DataWarning({
  syncDate,
  facilityAt,
  productionAt,
  haccpAt,
  suspensionAt,
}: DataWarningProps) {
  const hasDetail = facilityAt || productionAt || haccpAt || suspensionAt;

  return (
    <aside
      role="note"
      className="rounded-lg p-4 text-sm"
      style={{
        background: "var(--warn-bg)",
        borderLeft: "4px solid var(--warn)",
        color: "var(--ink)",
      }}
    >
      <p className="font-medium mb-1" style={{ color: "var(--warn)" }}>
        ⚠ 공공데이터 기반 스냅샷 안내
      </p>
      <p style={{ color: "var(--ink-2)" }}>
        본 정보는 공공데이터포털 기반의 정기 스냅샷입니다.{" "}
        <strong style={{ color: "var(--ink)" }}>계약·발주 전 반드시 해당 업체에 직접 확인하세요.</strong>
      </p>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: "var(--ink-2)" }}>
        <span>🔄 업데이트 주기: <strong style={{ color: "var(--ink)" }}>월 1회</strong></span>
        {hasDetail ? (
          <>
            {facilityAt && (
              <span>업체정보: <strong style={{ color: "var(--ink)" }}>{fmt(facilityAt)}</strong></span>
            )}
            {productionAt && (
              <span>생산이력: <strong style={{ color: "var(--ink)" }}>{fmt(productionAt)}</strong></span>
            )}
            {haccpAt && (
              <span>HACCP: <strong style={{ color: "var(--ink)" }}>{fmt(haccpAt)}</strong></span>
            )}
            {suspensionAt && (
              <span>회수·판매중지: <strong style={{ color: "var(--ink)" }}>{fmt(suspensionAt)}</strong></span>
            )}
          </>
        ) : syncDate ? (
          <span>최종 동기화: <strong style={{ color: "var(--ink)" }}>{fmt(syncDate)}</strong></span>
        ) : null}
      </div>
    </aside>
  );
}
