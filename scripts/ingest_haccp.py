#\!/usr/bin/env python3
"""
ingest_haccp.py — 스마트HACCP 인증업체 → SQLite haccp_cert 적재

데이터 소스:
  (A) --csv : 기존 data/raw_companies.csv (권장, 바로 실행 가능)
  (B) --api : data.go.kr SmartCertFoodListService 실시간 호출 (월 1회 갱신용)

사용법:
  # 로컬 CSV에서 (기본)
  python scripts/ingest_haccp.py --csv ../data/raw_companies.csv

  # API 직접 호출 (인증키는 .env의 HACCP_SERVICE_KEY)
  python scripts/ingest_haccp.py --api

동작:
  1) CSV/API → 품목별 행 읽기
  2) licenseno 단위로 그룹핑 + CCP 리스트 합집합
  3) facility 인덱스(이름 정규화 + 시도별칭) 로 매칭
  4) haccp_cert INSERT, facility.is_haccp 동기화, ingest_log 기록

실측: 1,046행 → 308개 고유 업체. 매칭률은 개선에 따라 54% → 70%+ 목표.
"""
from __future__ import annotations
import argparse, csv, json, os, sqlite3, sys, time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

DEFAULT_DB = os.getenv("SQLITE_PATH", "data/foodground.db")

_FREEZE = Path(__file__).parent.parent / "data" / ".freeze"
if _FREEZE.exists():
    print(f"[FREEZE] data/.freeze 존재 — 적재 중단. KTCC 시험 기간 중에는 실행 금지.", file=sys.stderr)
    sys.exit(0)

HACCP_KEY  = os.getenv("HACCP_SERVICE_KEY", "")
HACCP_URL  = "https://apis.data.go.kr/B553748/SmartCertFoodListService/getFoodList"

# 시도명 정규화 (2023년 강원·전북 특별자치도 개편 반영)
REGION_ALIAS = {
    "강원도": "강원특별자치도",  "강원": "강원특별자치도",
    "전라북도": "전북특별자치도", "전북도": "전북특별자치도", "전북": "전북특별자치도",
    "경기": "경기도",
    "충북": "충청북도", "충남": "충청남도",
    "경남": "경상남도", "경북": "경상북도",
    "전남": "전라남도",
    "제주": "제주특별자치도", "제주도": "제주특별자치도",
    "세종": "세종특별자치시",
    "서울": "서울특별시", "부산": "부산광역시", "인천": "인천광역시",
    "대구": "대구광역시", "대전": "대전광역시", "광주": "광주광역시",
    "울산": "울산광역시",
}

# 법인 표기 토큰 (긴 순서 우선 제거)
_LEGAL_TOKENS = (
    "농업회사법인", "농업협동조합", "사회적협동조합",
    "영농조합법인", "유한회사", "합자회사",
    "주식회사", "협동조합",
    "㈜", "㈔", "(주)", "（주）", "(유)", "（유）",
)


def nz(s):
    s = s.strip() if s else ""
    return s or None


def _norm_sido(s):
    if not s:
        return None
    s = s.strip()
    return REGION_ALIAS.get(s, s)


def _norm_name(s):
    """업체명 정규화: 공백·괄호·법인표기 제거."""
    if not s:
        return None
    t = s.strip()
    for tok in _LEGAL_TOKENS:
        t = t.replace(tok, "")
    t = t.replace(" ", "").replace("(", "").replace(")", "")
    t = t.replace("（", "").replace("）", "")
    return t or None


def rows_from_csv(path):
    """data/raw_companies.csv 포맷."""
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            yield {
                "licenseno":    nz(row.get("licenseno")),
                "company":      nz(row.get("company")),
                "sido":         nz(row.get("sido")),
                "sgg":          nz(row.get("sgg")),
                "ccp":          nz(row.get("ccp")),
                "year":         nz(row.get("year")),
                "appointno":    nz(row.get("appointno")),
                "businessitem": nz(row.get("businessitem")),
                "appointyn":    nz(row.get("appointyn")),
            }


def rows_from_api(service_key, max_pages=60, per_page=100):
    """data.go.kr 실시간 호출 (네트워크 허용 환경 필요)."""
    if not service_key:
        raise RuntimeError("HACCP_SERVICE_KEY 환경변수 비어있음")
    for page in range(1, max_pages + 1):
        qs = urlencode({
            "serviceKey": service_key,
            "pageNo":     page,
            "numOfRows":  per_page,
            "returnType": "json",
        }, safe="%")
        url = f"{HACCP_URL}?{qs}"
        with urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        items = (data.get("response", {}).get("body", {}).get("items", []) or [])
        if not items:
            break
        for it in items:
            yield {
                "licenseno":    nz(it.get("licenseno") or it.get("licenseNo")),
                "company":      nz(it.get("company") or it.get("bsshNm")),
                "sido":         nz(it.get("sido")),
                "sgg":          nz(it.get("sgg")),
                "ccp":          nz(it.get("ccp")),
                "year":         nz(str(it.get("year")) if it.get("year") else None),
                "appointno":    nz(it.get("appointno")),
                "businessitem": nz(it.get("businessitem") or it.get("prdlstNm")),
                "appointyn":    nz(it.get("appointyn")),
            }
        time.sleep(0.2)


def group_by_license(rows):
    groups = defaultdict(lambda: {
        "licenseno": None, "company": None, "sido": None, "sgg": None,
        "year": None, "appointno": None, "ccp_set": set(), "item_set": set(),
    })
    for r in rows:
        if not r["licenseno"]:
            continue
        g = groups[r["licenseno"]]
        g["licenseno"] = r["licenseno"]
        g["company"]   = g["company"] or r["company"]
        g["sido"]      = g["sido"] or r["sido"]
        g["sgg"]       = g["sgg"] or r["sgg"]
        g["year"]      = g["year"] or r["year"]
        g["appointno"] = g["appointno"] or r["appointno"]
        if r["ccp"]:
            for c in r["ccp"].split(","):
                c = c.strip()
                if c:
                    g["ccp_set"].add(c)
        if r["businessitem"]:
            g["item_set"].add(r["businessitem"])
    return list(groups.values())


def build_facility_index(cur):
    """영업 중 facility를 (norm_name, sido, sgg) 인덱스로 적재."""
    idx_full = {}   # (norm, sido, sgg) → mgt_no  (1순위)
    idx_sido = {}   # (norm, sido)      → mgt_no  (2순위, fallback)
    dup_full = set()
    dup_sido = set()
    n = 0
    for mgt_no, name, sido, sgg in cur.execute("""
        SELECT mgt_no, name, region_sido, region_sigungu
          FROM facility
         WHERE status = '영업/정상'
    """):
        norm = _norm_name(name)
        sido_n = _norm_sido(sido)
        if not norm or not sido_n:
            continue
        n += 1
        kf = (norm, sido_n, sgg)
        ks = (norm, sido_n)
        if kf in idx_full:
            dup_full.add(kf)
        else:
            idx_full[kf] = mgt_no
        if ks in idx_sido:
            dup_sido.add(ks)
        else:
            idx_sido[ks] = mgt_no
    # 중복된 sido-only 키는 제거(잘못 매칭 방지)
    for k in dup_sido:
        idx_sido.pop(k, None)
    return idx_full, idx_sido, n


def ingest(conn, groups):
    cur = conn.cursor()
    cur.execute("DELETE FROM haccp_cert")
    idx_full, idx_sido, n_fac = build_facility_index(cur)
    print(f"  facility 인덱스: {n_fac:,}건 (유니크 full={len(idx_full):,}, sido-only={len(idx_sido):,})")

    ins = 0
    matched = 0
    for g in groups:
        addr  = " ".join(x for x in (g["sido"], g["sgg"]) if x) or None
        yr = g["year"]
        cdate = (yr + "-01-01") if yr and yr.isdigit() else None
        ccp_json = json.dumps(sorted(g["ccp_set"]), ensure_ascii=False)
        raw = json.dumps({
            "items":     sorted(g["item_set"]),
            "ccp":       sorted(g["ccp_set"]),
            "appointno": g["appointno"],
        }, ensure_ascii=False)

        norm = _norm_name(g["company"])
        sido_n = _norm_sido(g["sido"])
        fac_mgt = None
        if norm and sido_n:
            fac_mgt = idx_full.get((norm, sido_n, g["sgg"]))
            if not fac_mgt:
                fac_mgt = idx_sido.get((norm, sido_n))
        if fac_mgt:
            matched += 1

        cur.execute("""
            INSERT INTO haccp_cert (facility_mgt_no, biz_name, biz_addr,
                                    cert_no, cert_date, ccp_list, raw_payload,
                                    updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (fac_mgt, g["company"] or "(무명)", addr,
              g["appointno"], cdate, ccp_json, raw,
              datetime.now().isoformat(timespec="seconds")))
        ins += 1

    cur.execute("UPDATE facility SET is_haccp = 0")
    cur.execute("""
        UPDATE facility SET is_haccp = 1
        WHERE mgt_no IN (SELECT facility_mgt_no FROM haccp_cert
                         WHERE facility_mgt_no IS NOT NULL)
    """)
    conn.commit()
    return ins, matched


def log_run(conn, started, finished, ins, matched, status, err=None):
    conn.execute(
        "INSERT INTO ingest_log (dataset, started_at, finished_at, "
        "rows_inserted, rows_updated, status, error_message) "
        "VALUES ('haccp', ?, ?, ?, ?, ?, ?)",
        (started.isoformat(timespec="seconds"),
         finished.isoformat(timespec="seconds"),
         ins, matched, status, err),
    )
    conn.commit()


def main():
    ap = argparse.ArgumentParser(description="HACCP 인증업체 → SQLite 적재")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--csv", help="data/raw_companies.csv 경로")
    src.add_argument("--api", action="store_true", help="data.go.kr 직접 호출")
    ap.add_argument("--db", default=DEFAULT_DB)
    args = ap.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"ERROR: DB 없음: {db_path}", file=sys.stderr)
        return 1

    started = datetime.now()
    print(f"[{started:%H:%M:%S}] HACCP 적재 시작 (source={'API' if args.api else 'CSV'})")

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        t0 = time.time()
        if args.api:
            rows = list(rows_from_api(HACCP_KEY))
        else:
            csv_path = Path(args.csv).resolve()
            if not csv_path.exists():
                print(f"CSV 없음: {csv_path}", file=sys.stderr)
                return 1
            rows = list(rows_from_csv(csv_path))
        print(f"  읽기: {len(rows):,}행, {time.time()-t0:.1f}s")

        t1 = time.time()
        groups = group_by_license(rows)
        print(f"  그룹핑: {len(groups):,}개 업체")

        ins, matched = ingest(conn, groups)
        rate = (matched / ins * 100) if ins else 0
        print(f"  적재: {ins:,}건 (facility 매칭 {matched:,}건, {rate:.1f}%), {time.time()-t1:.1f}s")

        finished = datetime.now()
        log_run(conn, started, finished, ins, matched, "ok")
        print(f"[{finished:%H:%M:%S}] 완료 ({(finished-started).total_seconds():.1f}s)")
        return 0
    except Exception as e:
        finished = datetime.now()
        try:
            log_run(conn, started, finished, 0, 0, "fail", str(e))
        except Exception:
            pass
        print(f"ERROR: {e}", file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
