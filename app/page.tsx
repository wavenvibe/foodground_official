import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchForm from "@/app/components/SearchForm";
import { getSyncStatus } from "@/lib/facility";

export const dynamic = "force-dynamic";

const POPULAR_CATEGORIES = [
  {
    label: "식품 제조·가공",
    bizType: "식품제조가공업",
    emoji: "🏭",
  },
  {
    label: "기타 식품 제조·가공",
    bizType: "기타 식품제조가공업",
    emoji: "🍱",
  },
  {
    label: "도시락 제조",
    bizType: "도시락제조업",
    emoji: "🥡",
  },
] as const;

const QUICK_FILTERS = [
  { label: "HACCP ✓", href: "/facilities?haccp=1" },
  { label: "제조시설 전체", href: "/facilities" },
] as const;

const FEATURES = [
  { label: "레시피", href: "/recipes", description: "70,000+ 식품 레시피 탐색" },
  { label: "식재료", href: "/ingredients", description: "식재료 성분·특성 검색" },
  { label: "대체 식재료", href: "/substitutes", description: "영양·조리 유사도 기반 대체 추천" },
  { label: "제조시설", href: "/facilities", description: "94,000+ HACCP 인증 업체 검색" },
] as const;

function formatDate(iso: string): string {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

export default async function HomePage() {
  const syncStatus = await getSyncStatus();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1">
        {/* Hero section */}
        <section
          className="px-4 py-16 sm:py-24"
          style={{ background: "var(--green-100)" }}
          aria-labelledby="hero-heading"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h1
              id="hero-heading"
              className="text-3xl sm:text-4xl font-bold leading-tight mb-4"
              style={{ color: "var(--green-900)" }}
            >
              필요한 제조시설, 바로 찾기
            </h1>
            <p
              className="text-lg mb-8"
              style={{ color: "var(--ink-2)" }}
            >
              지역과 업종만 골라도 HACCP 인증 업체가 나옵니다.
            </p>

            {/* Search bar — client island */}
            <div className="flex justify-center">
              <SearchForm />
            </div>

            {/* Quick filter chips */}
            <div
              className="flex flex-wrap justify-center gap-2 mt-6"
              aria-label="빠른 필터"
            >
              {QUICK_FILTERS.map((f) => (
                <Link
                  key={f.label}
                  href={f.href}
                  className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
                  style={{
                    background: "var(--paper)",
                    color: "var(--green-700)",
                    border: "1px solid var(--green-300)",
                  }}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Popular categories */}
        <section
          className="px-4 py-12"
          aria-labelledby="categories-heading"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="categories-heading"
              className="text-xl font-bold mb-6"
              style={{ color: "var(--green-900)" }}
            >
              인기 카테고리
            </h2>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4" role="list">
              {POPULAR_CATEGORIES.map((cat) => (
                <li key={cat.bizType}>
                  <Link
                    href={`/facilities?bizType=${encodeURIComponent(cat.bizType)}`}
                    className="flex flex-col items-center justify-center rounded-lg p-6 text-center transition-shadow hover:shadow-md"
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--rule)",
                    }}
                  >
                    <span className="text-3xl mb-2" aria-hidden="true">
                      {cat.emoji}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {cat.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Feature navigation */}
        <section
          className="px-4 py-12 border-t"
          style={{ borderColor: "var(--rule)" }}
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="features-heading"
              className="text-xl font-bold mb-6"
              style={{ color: "var(--green-900)" }}
            >
              주요 기능
            </h2>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4" role="list">
              {FEATURES.map((f) => (
                <li key={f.href}>
                  <Link
                    href={f.href}
                    className="flex flex-col rounded-lg p-5 transition-shadow hover:shadow-md"
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--rule)",
                    }}
                  >
                    <span
                      className="text-sm font-semibold mb-1"
                      style={{ color: "var(--ink)" }}
                    >
                      {f.label}
                    </span>
                    <span
                      className="text-xs leading-snug"
                      style={{ color: "var(--muted)" }}
                    >
                      {f.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Data sync status bar */}
        <section
          className="px-4 pb-8"
          aria-label="데이터 동기화 현황"
        >
          <div className="mx-auto max-w-5xl">
            <p
              className="text-xs rounded-lg px-4 py-3"
              style={{
                background: "var(--green-50)",
                color: "var(--ink-2)",
                border: "1px solid var(--rule)",
              }}
            >
              데이터 최종 동기화 · 등록정보{" "}
              <strong>{formatDate(syncStatus.facility_at)}</strong> · 생산이력{" "}
              <strong>{formatDate(syncStatus.production_at)}</strong> · HACCP{" "}
              <strong>{formatDate(syncStatus.haccp_at)}</strong> · 판매중지{" "}
              <strong>{formatDate(syncStatus.suspension_at)}</strong>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
