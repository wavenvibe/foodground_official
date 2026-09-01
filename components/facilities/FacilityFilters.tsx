import Link from "next/link";

const SIDO_LIST = [
  "서울특별시",
  "경기도",
  "인천광역시",
  "부산광역시",
  "대구광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

const BIZ_TYPES = ["식품제조가공업", "기타 식품제조가공업", "도시락제조업"];

interface FacilityFiltersProps {
  q: string;
  sido: string;
  businessType: string;
  haccp: boolean;
  status: string;
  ingredient?: string;
  substitute?: string;
  recipe?: string;
}

export default function FacilityFilters(props: FacilityFiltersProps) {
  const contextQuery = new URLSearchParams();
  if (props.ingredient) contextQuery.set("ingredient", props.ingredient);
  if (props.substitute) contextQuery.set("substitute", props.substitute);
  if (props.recipe) contextQuery.set("recipe", props.recipe);
  const resetHref = `/facilities${contextQuery.toString() ? `?${contextQuery.toString()}` : ""}`;

  return (
    <form className="facility-filters" method="get" action="/facilities" role="search">
      {props.ingredient && <input type="hidden" name="ingredient" value={props.ingredient} />}
      {props.substitute && <input type="hidden" name="substitute" value={props.substitute} />}
      {props.recipe && <input type="hidden" name="recipe" value={props.recipe} />}
      <div className="facility-filters__search">
        <label htmlFor="facility-q">제조시설 검색</label>
        <div>
          <input
            id="facility-q"
            name="q"
            type="search"
            maxLength={50}
            defaultValue={props.q}
            placeholder="업체명으로 검색"
          />
          <button className="button button--point" type="submit">
            검색
          </button>
        </div>
      </div>

      <div className="facility-filters__grid">
        <label>
          <span>지역</span>
          <select name="sido" defaultValue={props.sido}>
            <option value="">전체 지역</option>
            {SIDO_LIST.map((sido) => (
              <option key={sido} value={sido}>
                {sido}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>업종</span>
          <select name="businessType" defaultValue={props.businessType}>
            <option value="">전체 업종</option>
            {BIZ_TYPES.map((bizType) => (
              <option key={bizType} value={bizType}>
                {bizType}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>스마트 HACCP</span>
          <select name="haccp" defaultValue={props.haccp ? "1" : ""}>
            <option value="">전체</option>
            <option value="1">등록 시설만</option>
          </select>
        </label>
        <label>
          <span>영업 상태</span>
          <select name="status" defaultValue={props.status}>
            <option value="">영업 중 (기본)</option>
            <option value="all">전체 (폐업·정지 포함)</option>
            <option value="영업정지">영업정지</option>
          </select>
        </label>
      </div>
      <div className="facility-filters__actions">
        <Link className="button button--secondary" href={resetHref}>
          조건 초기화
        </Link>
        <button className="button button--slate" type="submit">
          조건 적용
        </button>
      </div>
    </form>
  );
}
