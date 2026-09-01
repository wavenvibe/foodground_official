import Link from "next/link";
import SaveButton from "@/components/saved/SaveButton";
import type { FacilityListItem } from "@/lib/facilities";
import { SAVED_KEYS, type SavedFacility } from "@/lib/saved-items";

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
          {facility.is_haccp ? <span className="chip chip--success">스마트 HACCP 등록</span> : null}
          {facility.business_type ? <span className="chip">{facility.business_type}</span> : null}
          {region ? <span className="chip">{region}</span> : null}
        </div>
        {facility.tel ? <p className="facility-card__tel">☎ {facility.tel}</p> : null}
      </div>
      <div className="facility-card__foot">
        <span>공공데이터 · 계약 전 업체에 직접 확인</span>
        <div className="facility-card__actions">
          <SaveButton<SavedFacility>
            storageKey={SAVED_KEYS.facilities}
            itemKey="mgt_no"
            item={{ mgt_no: facility.mgt_no, name: facility.name, biz_type: facility.business_type, region_sido: facility.region_sido, region_sigungu: facility.region_sigungu, status: facility.status, is_haccp: facility.is_haccp, saved_at: new Date().toISOString() }}
            compact
          />
          <Link className="button button--secondary" href={detailHref}>업체 근거 보기</Link>
        </div>
      </div>
    </article>
  );
}
