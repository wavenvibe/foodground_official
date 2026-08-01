import Link from "next/link";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FacilityCardItem from "@/components/FacilityCardItem";
import DataWarning from "@/components/DataWarning";
import SearchFilters from "./SearchFilters";
import SearchForm from "@/app/components/SearchForm";
import { searchFacilities, getSyncStatus } from "@/lib/facility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    sido?: string;
    sigungu?: string;
    bizType?: string;
    haccp?: string;
    suspension?: string;
    page?: string;
  }>;
}

function Pagination({
  page,
  total,
  pageSize,
  baseHref,
}: {
  page: number;
  total: number;
  pageSize: number;
  baseHref: string;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const makeHref = (p: number) => `${baseHref}&page=${p}`;

  // Show at most 5 page numbers centered around current page
  const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const endPage = Math.min(totalPages, startPage + 4);
  const pages = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  const btnBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    height: 36,
    padding: "0 8px",
    borderRadius: 6,
    fontSize: "0.875rem",
    border: "1px solid var(--rule)",
    background: "var(--paper)",
    color: "var(--ink)",
    textDecoration: "none",
  };

  const activeBtnStyle = {
    ...btnBase,
    background: "var(--green-500)",
    color: "var(--green-cta-text)",
    border: "1px solid var(--green-500)",
    fontWeight: 600,
  };

  return (
    <nav aria-label="페이지 이동" className="flex items-center gap-1 flex-wrap">
      {page > 1 && (
        <Link href={makeHref(page - 1)} style={btnBase} aria-label="이전 페이지">
          ‹ 이전
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={makeHref(p)}
          style={p === page ? activeBtnStyle : btnBase}
          aria-current={p === page ? "page" : undefined}
          aria-label={`${p} 페이지`}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={makeHref(page + 1)} style={btnBase} aria-label="다음 페이지">
          다음 ›
        </Link>
      )}
    </nav>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const sido = params.sido ?? "";
  const sigungu = params.sigungu ?? "";
  const bizType = params.bizType ?? "";
  const haccp = params.haccp ?? "";
  const suspension = params.suspension ?? "";
  const page = Number(params.page) || 1;

  const [result, syncStatus] = await Promise.all([
    searchFacilities({
      q: q || undefined,
      sido: sido || undefined,
      sigungu: sigungu || undefined,
      bizType: bizType || undefined,
      haccp: haccp === "1",
      suspension: (suspension === "none" || suspension === "has") ? suspension : undefined,
      page,
    }),
    getSyncStatus(),
  ]);

  // Build base href for pagination (all current params except page)
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (sido) baseParams.set("sido", sido);
  if (sigungu) baseParams.set("sigungu", sigungu);
  if (bizType) baseParams.set("bizType", bizType);
  if (haccp) baseParams.set("haccp", haccp);
  if (suspension) baseParams.set("suspension", suspension);
  const baseHref = `/search?${baseParams.toString()}`;

  const syncDate = syncStatus.facility_at
    ? syncStatus.facility_at.slice(0, 10)
    : undefined;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {/* Search heading */}
          <h1
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--green-900)" }}
          >
            {q ? <>&ldquo;{q}&rdquo; 검색 결과</> : "업체 검색"}
          </h1>

          <Suspense fallback={null}>
            <SearchForm
              defaultValue={q}
              placeholder="업체명, 지역으로 검색..."
              className="flex w-full gap-2"
            />
          </Suspense>
          <div className="mb-6" />

          <div className="flex gap-6">
            {/* Sidebar filters — wrapped in Suspense because SearchFilters uses useSearchParams */}
            <div className="hidden md:block w-56 flex-shrink-0">
              <Suspense fallback={null}>
                <SearchFilters
                  currentSido={sido}
                  currentBizType={bizType}
                  currentHaccp={haccp}
                  currentSuspension={suspension}
                />
              </Suspense>
            </div>

            {/* Results */}
            <section className="flex-1 min-w-0" aria-label="검색 결과">
              {/* Result count */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p
                  className="text-sm"
                  style={{ color: "var(--ink-2)" }}
                >
                  총{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {result.total.toLocaleString()}
                  </strong>
                  건
                  {syncDate && (
                    <span> · 기준 {syncDate}</span>
                  )}
                </p>
              </div>

              {/* Facility list */}
              {result.facilities.length === 0 ? (
                <div
                  className="rounded-lg p-12 text-center"
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  <p
                    className="text-base font-medium mb-2"
                    style={{ color: "var(--ink)" }}
                  >
                    검색 결과가 없습니다.
                  </p>
                  <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                    필터를 조정하거나 다른 검색어를 입력해 보세요.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3" role="list">
                  {result.facilities.map((f) => (
                    <li key={f.mgt_no}>
                      <FacilityCardItem facility={f} />
                    </li>
                  ))}
                </ul>
              )}

              {/* Pagination */}
              {result.total > result.pageSize && (
                <div className="mt-6">
                  <Pagination
                    page={result.page}
                    total={result.total}
                    pageSize={result.pageSize}
                    baseHref={baseHref}
                  />
                </div>
              )}

              {/* Data warning */}
              <div className="mt-8">
                <DataWarning
                  facilityAt={syncStatus.facility_at}
                  productionAt={syncStatus.production_at}
                  haccpAt={syncStatus.haccp_at}
                  suspensionAt={syncStatus.suspension_at}
                />
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
