"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const SIDO_LIST: { value: string; label: string }[] = [
  { value: "서울특별시", label: "서울" },
  { value: "경기도", label: "경기" },
  { value: "인천광역시", label: "인천" },
  { value: "부산광역시", label: "부산" },
  { value: "대구광역시", label: "대구" },
  { value: "광주광역시", label: "광주" },
  { value: "대전광역시", label: "대전" },
  { value: "울산광역시", label: "울산" },
  { value: "세종특별자치시", label: "세종" },
  { value: "강원특별자치도", label: "강원" },
  { value: "충청북도", label: "충북" },
  { value: "충청남도", label: "충남" },
  { value: "전북특별자치도", label: "전북" },
  { value: "전라남도", label: "전남" },
  { value: "경상북도", label: "경북" },
  { value: "경상남도", label: "경남" },
  { value: "제주특별자치도", label: "제주" },
];

const BIZ_TYPE_LIST = [
  "식품제조가공업",
  "기타 식품제조가공업",
  "도시락제조업",
];

interface SearchFiltersProps {
  currentSido: string;
  currentBizType: string;
  currentHaccp: string;
  currentSuspension: string;
}

// @MX:NOTE: [AUTO] Client component — handles filter interactivity for the search page sidebar
export default function SearchFilters({
  currentSido,
  currentBizType,
  currentHaccp,
  currentSuspension,
}: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filter changes
    params.delete("page");
    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }

  const labelStyle = {
    color: "var(--ink-2)",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };

  const selectStyle = {
    background: "var(--paper)",
    border: "1px solid var(--rule)",
    color: "var(--ink)",
    borderRadius: 8,
    padding: "8px 12px",
    width: "100%",
    fontSize: "0.875rem",
  };

  const toggleBtnStyle = (active: boolean) => ({
    flex: 1,
    padding: "6px 0",
    fontSize: "0.8125rem",
    fontWeight: active ? 600 : 400,
    background: active ? "var(--green-500)" : "var(--paper)",
    color: active ? "var(--green-cta-text)" : "var(--ink-2)",
    border: "1px solid var(--rule)",
    borderRadius: 6,
    cursor: "pointer" as const,
    opacity: isPending ? 0.6 : 1,
  });

  return (
    <aside
      aria-label="검색 필터"
      className="flex flex-col gap-5"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--rule)",
        borderRadius: 8,
        padding: "16px",
        minWidth: 0,
      }}
    >
      <h2 style={{ color: "var(--green-900)", fontSize: "0.9375rem", fontWeight: 700 }}>
        필터
      </h2>

      {/* 지역 */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-sido" style={labelStyle}>
          지역 (시도)
        </label>
        <select
          id="filter-sido"
          value={currentSido}
          onChange={(e) => updateParam("sido", e.target.value)}
          style={selectStyle}
          disabled={isPending}
        >
          <option value="">전체</option>
          {SIDO_LIST.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* 업종 */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-biz" style={labelStyle}>
          업종
        </label>
        <select
          id="filter-biz"
          value={currentBizType}
          onChange={(e) => updateParam("bizType", e.target.value)}
          style={selectStyle}
          disabled={isPending}
        >
          <option value="">전체</option>
          {BIZ_TYPE_LIST.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* HACCP 인증 */}
      <div className="flex flex-col gap-1.5">
        <span style={labelStyle} id="haccp-label">
          HACCP 인증
        </span>
        <div className="flex gap-1.5" role="group" aria-labelledby="haccp-label">
          <button
            type="button"
            style={toggleBtnStyle(currentHaccp === "1")}
            onClick={() =>
              updateParam("haccp", currentHaccp === "1" ? "" : "1")
            }
            aria-pressed={currentHaccp === "1"}
            disabled={isPending}
          >
            인증만
          </button>
          <button
            type="button"
            style={toggleBtnStyle(currentHaccp !== "1")}
            onClick={() => updateParam("haccp", "")}
            aria-pressed={currentHaccp !== "1"}
            disabled={isPending}
          >
            전체
          </button>
        </div>
      </div>

      {/* 판매중지 이력 */}
      <div className="flex flex-col gap-1.5">
        <span style={labelStyle} id="suspension-label">
          판매중지 이력
        </span>
        <div className="flex gap-1.5" role="group" aria-labelledby="suspension-label">
          <button
            type="button"
            style={toggleBtnStyle(currentSuspension === "")}
            onClick={() => updateParam("suspension", "")}
            aria-pressed={currentSuspension === ""}
            disabled={isPending}
          >
            전체
          </button>
          <button
            type="button"
            style={toggleBtnStyle(currentSuspension === "none")}
            onClick={() => updateParam("suspension", currentSuspension === "none" ? "" : "none")}
            aria-pressed={currentSuspension === "none"}
            disabled={isPending}
          >
            없음
          </button>
          <button
            type="button"
            style={toggleBtnStyle(currentSuspension === "has")}
            onClick={() => updateParam("suspension", currentSuspension === "has" ? "" : "has")}
            aria-pressed={currentSuspension === "has"}
            disabled={isPending}
          >
            있음
          </button>
        </div>
      </div>
    </aside>
  );
}
