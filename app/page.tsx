import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
  { label: "제품", href: "/products", description: "제품·제조업체·HACCP 근거 연결" },
  { label: "레시피", href: "/recipes", description: "70,000+ 식품 레시피 탐색" },
  { label: "식재료", href: "/ingredients", description: "식재료 성분·특성 검색" },
  { label: "대체 식재료", href: "/substitutes", description: "영양·조리 유사도 기반 대체 추천" },
  { label: "공동제조", href: "/manufacturing-brief", description: "품목·CCP·지역 근거로 후보 비교" },
  { label: "제조시설", href: "/facilities", description: "94,000+ HACCP 인증 업체 검색" },
] as const;

const PRODUCT_FLOW = [
  { step: "1", label: "제품 찾기", description: "품목보고 제품과 원재료 확인", href: "/products" },
  { step: "2", label: "제품화 요건", description: "제품유형·필수 CCP·희망지역 확정", href: "/manufacturing-brief" },
  { step: "3", label: "제조 후보 비교", description: "충족·미충족·미확인 근거 확인", href: "/manufacturing-brief" },
  { step: "4", label: "업체 근거 검증", description: "생산제품·HACCP·안전정보 확인", href: "/facilities" },
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
              제품에서 제조업체·HACCP 근거까지
            </h1>
            <p
              className="text-lg mb-8"
              style={{ color: "var(--ink-2)" }}
            >
              품목보고 제품을 기준으로 실제 생산업체와 인증·공정·안전정보를 한 흐름에서 확인하세요.
            </p>

            <form action="/products" method="get" className="mx-auto flex max-w-2xl gap-2" role="search" aria-label="제품 검색">
              <input className="min-w-0 flex-1 rounded-lg border bg-white px-4 py-3" style={{ borderColor: "var(--rule)" }} type="search" name="q" placeholder="제품명·식품유형·제조업체 검색" />
              <button className="button button--point" type="submit">제품 근거 찾기</button>
            </form>

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

        <section className="px-4 py-10" aria-labelledby="product-flow-heading">
          <div className="mx-auto max-w-5xl">
            <div className="facility-results__head"><div><h2 id="product-flow-heading">제품화 검토 흐름</h2><p>각 메뉴를 따로 보는 것이 아니라 제품을 기준으로 다음 근거가 이어집니다.</p></div></div>
            <ol className="product-flow" role="list">
              {PRODUCT_FLOW.map((item) => <li key={item.step}><Link href={item.href}><span>{item.step}</span><strong>{item.label}</strong><small>{item.description}</small></Link></li>)}
            </ol>
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
                    href={`/facilities?businessType=${encodeURIComponent(cat.bizType)}`}
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
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" role="list">
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
