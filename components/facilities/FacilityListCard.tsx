import Link from "next/link";
import type { FacilityListItem } from "@/lib/facilities";

export default function FacilityListCard({
  facility,
  backUrl,
  ingredient,
  substitute,
  recipe,
}: {
  facility: FacilityListItem;
  backUrl?: string;
  ingredient?: string;
  substitute?: string;
  recipe?: string;
}) {
  const region = [facility.region_sido, facility.region_sigungu].filter(Boolean).join(" ");

  const params = new URLSearchParams();
  if (backUrl) params.set("back", backUrl);
  if (ingredient) params.set("ingredient", ingredient);
  if (substitute) params.set("substitute", substitute);
  if (recipe) params.set("recipe", recipe);
  const qs = params.toString();
  const detailHref = `/facilities/${encodeURIComponent(facility.mgt_no)}${qs ? `?${qs}` : ""}`;

  return (
    <article className="facility-card">
      <div>
        <h2>
          <Link href={detailHref}>
            {facility.name}
          </Link>
        </h2>
        <div className="facility-card__chips">
          {facility.is_haccp ? <span className="chip chip--success">HACCP 인증</span> : null}
          {facility.business_type ? <span className="chip">{facility.business_type}</span> : null}
          {region ? <span className="chip">{region}</span> : null}
        </div>
        {facility.tel ? <p className="facility-card__tel">☎ {facility.tel}</p> : null}
      </div>
      <div className="facility-card__foot">
        <span>공공데이터 · 계약 전 업체에 직접 확인</span>
        <Link className="button button--secondary" href={detailHref}>
          상세 보기
        </Link>
      </div>
    </article>
  );
}
