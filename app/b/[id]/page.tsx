import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DataWarning from "@/components/DataWarning";
import { getFacilityDetail } from "@/lib/facility";

export const revalidate = 300;
import FacilitySaveButton from "./FacilitySaveButton";

// No pre-generation at build time — on-demand ISR
export async function generateStaticParams() {
  return [];
}

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

function normalizeTel(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (!digits) return null;
  // DB에 선행 0이 누락된 채 저장된 경우 복원
  return digits.startsWith("0") ? digits : "0" + digits;
}

export default async function FacilityDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const facility = await getFacilityDetail(id);

  if (!facility) notFound();

  const {
    name,
    biz_type,
    region_sido,
    region_sigungu,
    is_haccp,
    suspension_count,
    tel,
    homepage,
    road_addr,
    production_logs,
    haccp_cert,
    last_synced,
  } = facility;

  const regionLabel = [region_sido, region_sigungu].filter(Boolean).join(" ");
  const syncDate = last_synced ? last_synced.slice(0, 10) : undefined;
  const telNormalized = normalizeTel(tel);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">

          {/* Title block */}
          <article
            className="rounded-lg p-6 mb-6"
            style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
          >
            {/* Facility name */}
            <h1
              className="text-2xl font-bold mb-3 leading-tight"
              style={{ color: "var(--green-900)" }}
            >
              {name}
            </h1>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {is_haccp === 1 ? (
                <span
                  className="rounded-full px-3 py-1 text-sm font-semibold"
                  style={{ background: "var(--green-500)", color: "var(--green-cta-text)" }}
                >
                  HACCP 인증
                </span>
              ) : (
                <span
                  className="rounded-full px-3 py-1 text-sm font-medium"
                  style={{ background: "var(--rule)", color: "var(--ink-2)" }}
                >
                  HACCP 미인증
                </span>
              )}
              {biz_type && (
                <span
                  className="rounded-full px-3 py-1 text-sm font-medium"
                  style={{ background: "var(--green-100)", color: "var(--ink)" }}
                >
                  {biz_type}
                </span>
              )}
              {regionLabel && (
                <span
                  className="rounded-full px-3 py-1 text-sm"
                  style={{ background: "var(--green-50)", color: "var(--ink-2)" }}
                >
                  {regionLabel}
                </span>
              )}
            </div>

            {/* Address */}
            {road_addr && (
              <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
                <span aria-hidden="true">📍 </span>
                {road_addr}
              </p>
            )}

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 mt-4">
              <FacilitySaveButton
                mgtNo={facility.mgt_no}
                name={name}
                bizType={biz_type}
                regionSido={region_sido}
              />
              {telNormalized && (
                <a
                  href={`tel:${telNormalized}`}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--rule)",
                    color: "var(--ink)",
                  }}
                  aria-label={`${name}에 전화하기: ${telNormalized}`}
                >
                  📞 전화 {telNormalized}
                </a>
              )}
              {homepage && (
                <a
                  href={homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--rule)",
                    color: "var(--ink)",
                  }}
                  aria-label={`${name} 홈페이지 방문 (새 창)`}
                >
                  🌐 홈페이지
                </a>
              )}
            </div>
          </article>

          {/* Two-column body */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Production logs — 2/3 width */}
            <section
              className="md:col-span-2 rounded-lg p-5"
              style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
              aria-labelledby="production-heading"
            >
              <h2
                id="production-heading"
                className="text-base font-bold mb-4"
                style={{ color: "var(--green-900)" }}
              >
                최근 제품 생산이력 (최신 10건)
              </h2>
              {production_logs.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                  생산이력 정보가 없습니다.
                </p>
              ) : (
                <ul className="flex flex-col gap-3" role="list">
                  {production_logs.map((log) => (
                    <li
                      key={log.report_no}
                      className="flex flex-col gap-0.5 pb-3"
                      style={{ borderBottom: "1px solid var(--rule)" }}
                    >
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {log.product_name}
                      </p>
                      {log.category && (
                        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
                          {log.category}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: "var(--ink-2)" }}>
                        신고일: {formatDate(log.reported_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* HACCP cert — 1/3 width */}
            <section
              className="rounded-lg p-5"
              style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
              aria-labelledby="haccp-heading"
            >
              <h2
                id="haccp-heading"
                className="text-base font-bold mb-4"
                style={{ color: "var(--green-900)" }}
              >
                HACCP 인증 현황
              </h2>
              {haccp_cert ? (
                <dl className="flex flex-col gap-2 text-sm">
                  <div>
                    <dt
                      className="text-xs font-medium mb-0.5"
                      style={{ color: "var(--ink-2)" }}
                    >
                      인증번호
                    </dt>
                    <dd style={{ color: "var(--ink)" }}>
                      {haccp_cert.cert_no ?? "-"}
                    </dd>
                  </div>
                  <div>
                    <dt
                      className="text-xs font-medium mb-0.5"
                      style={{ color: "var(--ink-2)" }}
                    >
                      인증일
                    </dt>
                    <dd style={{ color: "var(--ink)" }}>
                      {formatDate(haccp_cert.cert_date)}
                    </dd>
                  </div>
                  <div>
                    <dt
                      className="text-xs font-medium mb-0.5"
                      style={{ color: "var(--ink-2)" }}
                    >
                      정보 갱신
                    </dt>
                    <dd style={{ color: "var(--ink)" }}>
                      {formatDate(haccp_cert.updated_at)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                  HACCP 인증 정보가 없습니다.
                </p>
              )}
            </section>
          </div>

          {/* Suspension history */}
          <section
            className="rounded-lg p-5 mb-6"
            style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
            aria-labelledby="suspension-heading"
          >
            <h2
              id="suspension-heading"
              className="text-base font-bold mb-3"
              style={{ color: "var(--green-900)" }}
            >
              판매중지 / 회수 이력
            </h2>
            {suspension_count === 0 ? (
              <p
                className="text-sm flex items-center gap-1.5"
                style={{ color: "var(--ink-2)" }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: "var(--green-500)" }}
                  aria-hidden="true"
                />
                이력 없음
              </p>
            ) : (
              <p
                className="text-sm flex items-center gap-1.5 font-medium"
                style={{ color: "var(--warn)" }}
                role="alert"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: "var(--warn)" }}
                  aria-hidden="true"
                />
                <span aria-hidden="true">⚠</span>
                판매중지 이력 {suspension_count}건
              </p>
            )}
          </section>

          {/* Map placeholder */}
          <div
            className="rounded-lg flex items-center justify-center mb-6"
            style={{
              background: "var(--green-100)",
              height: 200,
              border: "1px solid var(--rule)",
            }}
            aria-label="지도 준비 중"
          >
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              지도 정보 (준비중)
            </p>
          </div>

          {/* Data warning — mandatory */}
          <DataWarning facilityAt={last_synced ?? undefined} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
