import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSyncStatus } from "@/lib/facility";

export const dynamic = "force-dynamic";

const HERO_STATS = [
  { value: "104.8만", label: "품목보고 제품" },
  { value: "9.5만", label: "제조시설" },
  { value: "7만", label: "레시피" },
  { value: "1.9만", label: "식재료 데이터" },
] as const;

const BENEFITS = ["제품화 아이디어 찾기", "내 제품을 만들 공장 찾기", "더 나은 레시피 찾기"] as const;

const DEVELOPMENT_FLOW = [
  { step: "1", label: "레시피 찾기", description: "만들 제품의 레시피와 재료 구성을 확인", href: "/recipes" },
  { step: "2", label: "대체 식재료 찾기", description: "영양·조리 유사도와 성분 변화를 비교", href: "/substitutes" },
] as const;

const MANUFACTURING_FLOW = [
  { step: "1", label: "기존 제품명 조회하기", description: "제품명·제조업체명으로 생산 이력을 확인", href: "/products" },
  { step: "2", label: "조건 맞춤 제조공장 찾기", description: "제품유형·필수 CCP·희망지역으로 후보를 선별", href: "/manufacturing-brief" },
  { step: "3", label: "제조 후보 비교", description: "검토함에 저장한 시설의 공개 근거를 나란히 비교", href: "/facilities/compare" },
] as const;

function formatDate(iso: string): string {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

export default async function HomePage() {
  const syncStatus = await getSyncStatus();

  return (
    <div className="home-v3-page">
      <main>
        <section className="home-v3-frame" aria-labelledby="hero-heading">
          <div className="home-v3-shell">
            <div className="home-v3-glow" aria-hidden="true" />
            <Header variant="home" />

            <div className="home-v3-title">
              <h1 id="hero-heading">식품 아이디어를 찾고,<br />만들 수 있는 곳까지</h1>
            </div>

            <div className="home-v3-hero-grid">
              <div className="home-v3-intro">
                <p>
                  레시피와 대체 식재료를 탐색하고, 비슷한 제품을 실제로 만든 제조업체와
                  스마트 HACCP·공정·안전정보까지 한곳에서 확인하세요.
                </p>
                <div className="home-v3-intro__actions">
                  <Link href="/recipes">레시피로 시작하기</Link>
                  <Link href="/facilities">제조시설 검색으로 시작하기</Link>
                </div>
              </div>

              <div className="home-v3-hero-photo">
                <div className="home-v3-hero-photo__halo" aria-hidden="true" />
                <Image
                  src="/images/home-r1/hero-expert.png"
                  alt="식품 샘플을 들고 있는 식품 연구원"
                  fill
                  priority
                  sizes="(max-width: 760px) calc(100vw - 64px), 42vw"
                />
              </div>

              <ul className="home-v3-benefits" aria-label="주요 활용 목적">
                {BENEFITS.map((benefit) => (
                  <li key={benefit}><span aria-hidden="true">•••••</span><strong>{benefit}</strong></li>
                ))}
              </ul>
            </div>

            <form action="/products" method="get" className="home-v3-search" role="search" aria-label="제품 검색">
              <input type="search" name="q" placeholder="제품명·식품유형·제조업체 검색" />
              <button type="submit">제품 근거 찾기</button>
            </form>
          </div>
        </section>

        <section className="home-v3-stats" aria-label="푸드그라운드 공개 데이터 규모">
          <dl>
            {HERO_STATS.map((stat) => (
              <div key={stat.label}><dd>{stat.value}<span>+</span></dd><dt>{stat.label}</dt></div>
            ))}
          </dl>
        </section>

        <section className="home-v3-evidence" aria-labelledby="evidence-heading">
          <div className="home-v3-evidence__head">
            <h2 id="evidence-heading">아이디어를 제품으로<br />만드는 경로까지</h2>
            <p>
              81.6만 건의 제품–제조시설 연결 근거로, 비슷한 제품이 어디에서 어떤 공정으로
              만들어졌는지 확인할 수 있습니다. 스마트 HACCP 등록 정보 308건과 제조공정
              프로필 265건도 함께 제공합니다.
            </p>
          </div>

          <div className="home-v3-evidence__visuals">
            <article className="home-v3-visual-card home-v3-visual-card--factory">
              <Image
                src="/images/home-r1/manufacturing-floor.png"
                alt="식품 제조시설 생산 현장에서 공정을 확인하는 작업자들"
                fill
                sizes="(max-width: 760px) calc(100vw - 40px), 50vw"
              />
              <strong>공개 데이터 기반 제조 탐색</strong>
            </article>
            <article className="home-v3-visual-card home-v3-visual-card--nutrition">
              <Image
                src="/images/home-r1/ingredient-lab.png"
                alt="여러 식재료 샘플의 배합을 연구하는 작업대"
                fill
                sizes="(max-width: 760px) calc(100vw - 40px), 50vw"
              />
              <strong>영양성분 기반 대체재료 탐색</strong>
            </article>
          </div>
        </section>

        <section className="home-v3-capabilities" aria-labelledby="capabilities-heading">
          <h2 id="capabilities-heading">무엇을 <span>할 수 있나요</span></h2>
          <h3>제품화 검토 흐름</h3>
          <p className="home-v3-capabilities__lead">제품 아이디어를 다듬고, 실제 생산 이력이 있는 제조시설까지 단계별로 검토합니다.</p>

          <div className="home-v3-flow-groups">
            <section className="home-v3-flow-group" aria-labelledby="development-flow-title">
              <div className="home-v3-flow-group__head">
                <p>PRODUCT DEVELOPMENT</p>
                <h4 id="development-flow-title">제품 개발하기</h4>
                <span>레시피에서 시작해 필요한 식재료의 대체안을 비교합니다.</span>
              </div>
              <ol className="home-v3-flow home-v3-flow--two">
                {DEVELOPMENT_FLOW.map((item) => (
                  <li key={item.step}><Link href={item.href}><span>{item.step}</span><strong>{item.label}</strong><small>{item.description}</small></Link></li>
                ))}
              </ol>
            </section>

            <section className="home-v3-flow-group" aria-labelledby="factory-flow-title">
              <div className="home-v3-flow-group__head">
                <p>MANUFACTURING PARTNER</p>
                <h4 id="factory-flow-title">적정 제조공장 찾기</h4>
                <span>기존 생산 근거를 찾고, 조건에 맞는 후보를 저장해 비교합니다.</span>
              </div>
              <ol className="home-v3-flow home-v3-flow--three">
                {MANUFACTURING_FLOW.map((item) => (
                  <li key={item.step}><Link href={item.href}><span>{item.step}</span><strong>{item.label}</strong><small>{item.description}</small></Link></li>
                ))}
              </ol>
            </section>
          </div>
        </section>

        <div className="home-v3-marquee" aria-hidden="true">
          <div><span>탐색</span><b>✦</b><span>대체</span><b>✦</b><span>제조</span><b>✦</b><span>탐색</span><b>✦</b><span>대체</span><b>✦</b><span>제조</span><b>✦</b></div>
          <div><span>탐색</span><b>✦</b><span>대체</span><b>✦</b><span>제조</span><b>✦</b><span>탐색</span><b>✦</b><span>대체</span><b>✦</b><span>제조</span><b>✦</b></div>
        </div>

        <p className="home-v3-source">
          공개 데이터 기준 · 수치는 갱신에 따라 달라질 수 있습니다.<br />
          등록정보 {formatDate(syncStatus.facility_at)} · 생산이력 {formatDate(syncStatus.production_at)} · 스마트 HACCP {formatDate(syncStatus.haccp_at)}
        </p>
      </main>
      <Footer />
    </div>
  );
}
