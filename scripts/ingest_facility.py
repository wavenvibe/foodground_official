#\!/usr/bin/env python3
"""
ingest_facility.py — 식품제조가공업 CSV → SQLite 적재 (Phase 1~2 로컬 개발용)

사용법:
  python scripts/ingest_facility.py --csv "../식품_식품제조가공업.csv"
  python scripts/ingest_facility.py --csv "../식품_식품제조가공업.csv" --mode incremental

의존성: Python 3.8+ 표준 라이브러리만 사용 (sqlite3, csv).
"""
from __future__ import annotations
import argparse, csv, os, re, sqlite3, sys, time
from datetime import datetime
from pathlib import Path

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

COLS = (
    "mgt_no","local_gov_code","name","biz_type","status","status_detail",
    "licensed_at","closed_at","tel","road_addr","lot_addr","road_postal",
    "coord_x","coord_y","homepage","updated_at","ingest_gubun",
    "region_sido","region_sigungu","region_dong",
)

CSV_MAP = {
    "mgt_no": "관리번호", "local_gov_code": "개방자치단체코드",
    "name": "사업장명", "biz_type": "업태구분명",
    "status": "영업상태명", "status_detail": "상세영업상태명",
    "licensed_at": "인허가일자", "closed_at": "폐업일자",
    "tel": "전화번호", "road_addr": "도로명주소", "lot_addr": "지번주소",
    "road_postal": "도로명우편번호",
    "coord_x": "좌표정보(X)", "coord_y": "좌표정보(Y)",
    "homepage": "홈페이지", "updated_at": "최종수정시점",
    "ingest_gubun": "데이터갱신구분",
}


def parse_region(road, lot):
    src = (road or lot or "").strip()
    if not src:
        return (None, None, None)
    toks = src.split()
    sido = toks[0] if toks else None
    sigungu = toks[1] if len(toks) > 1 else None
    if sido == "세종특별자치시":
        sigungu = None
    dong = None
    for t in toks[2:]:
        if re.search(r"(동|읍|면|리)$", t):
            dong = t
            break
    return (sido, sigungu, dong)


def to_float(s):
    try:
        return float(s) if s and s.strip() else None
    except ValueError:
        return None


def to_date_str(s):
    if not s or not s.strip():
        return None
    t = s.strip()[:10]
    try:
        datetime.strptime(t, "%Y-%m-%d")
        return t
    except ValueError:
        return None


def to_ts_str(s):
    if not s or not s.strip():
        return None
    t = s.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(t[:len(fmt)+3], fmt).isoformat(sep="T", timespec="seconds")
        except ValueError:
            continue
    return None


def nz(s):
    s = s.strip() if s else ""
    return s or None


def parse_csv(path, last_sync=None):
    with open(path, encoding="cp949", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            upd = to_ts_str(row.get(CSV_MAP["updated_at"]))
            if last_sync and upd and upd <= last_sync:
                continue
            sido, sigungu, dong = parse_region(
                row.get(CSV_MAP["road_addr"]), row.get(CSV_MAP["lot_addr"]))
            yield (
                nz(row.get(CSV_MAP["mgt_no"])) or "",
                nz(row.get(CSV_MAP["local_gov_code"])),
                nz(row.get(CSV_MAP["name"])) or "(무명)",
                nz(row.get(CSV_MAP["biz_type"])),
                nz(row.get(CSV_MAP["status"])) or "영업/정상",
                nz(row.get(CSV_MAP["status_detail"])),
                to_date_str(row.get(CSV_MAP["licensed_at"])),
                to_date_str(row.get(CSV_MAP["closed_at"])),
                nz(row.get(CSV_MAP["tel"])),
                nz(row.get(CSV_MAP["road_addr"])),
                nz(row.get(CSV_MAP["lot_addr"])),
                nz(row.get(CSV_MAP["road_postal"])),
                to_float(row.get(CSV_MAP["coord_x"])),
                to_float(row.get(CSV_MAP["coord_y"])),
                nz(row.get(CSV_MAP["homepage"])),
                upd,
                nz(row.get(CSV_MAP["ingest_gubun"])),
                sido, sigungu, dong,
            )


def ingest(conn, rows, mode="full"):
    cur = conn.cursor()
    ph = ",".join(["?"] * len(COLS))
    col_list = ",".join(COLS)

    if mode == "full":
        cur.execute("DELETE FROM facility_fts")
        cur.execute("DELETE FROM facility")
        batch = []
        cnt = 0
        for r in rows:
            batch.append(r)
            if len(batch) >= 5000:
                cur.executemany(f"INSERT INTO facility ({col_list}) VALUES ({ph})", batch)
                cnt += len(batch)
                batch = []
        if batch:
            cur.executemany(f"INSERT INTO facility ({col_list}) VALUES ({ph})", batch)
            cnt += len(batch)
        cur.execute("INSERT INTO facility_fts(mgt_no, name, road_addr) "
                    "SELECT mgt_no, name, road_addr FROM facility")
        conn.commit()
        return cnt, 0

    update_set = ", ".join(f"{c}=excluded.{c}" for c in COLS if c not in ("mgt_no","licensed_at"))
    upsert_sql = (f"INSERT INTO facility ({col_list}) VALUES ({ph}) "
                  f"ON CONFLICT(mgt_no) DO UPDATE SET {update_set}")
    ins = upd = 0
    for r in rows:
        mgt = r[0]
        existed = cur.execute("SELECT 1 FROM facility WHERE mgt_no = ?", (mgt,)).fetchone() is not None
        cur.execute(upsert_sql, r)
        cur.execute("DELETE FROM facility_fts WHERE mgt_no = ?", (mgt,))
        cur.execute("INSERT INTO facility_fts(mgt_no, name, road_addr) VALUES (?, ?, ?)",
                    (mgt, r[2], r[9]))
        if existed:
            upd += 1
        else:
            ins += 1
    conn.commit()
    return ins, upd


def log_run(conn, started, finished, ins, upd, status, err=None):
    conn.execute(
        "INSERT INTO ingest_log (dataset, started_at, finished_at, "
        "rows_inserted, rows_updated, status, error_message) "
        "VALUES ('facility', ?, ?, ?, ?, ?, ?)",
        (started.isoformat(timespec="seconds"),
         finished.isoformat(timespec="seconds"),
         ins, upd, status, err),
    )
    conn.commit()


def get_last_sync(conn):
    row = conn.execute(
        "SELECT MAX(finished_at) FROM ingest_log "
        "WHERE dataset='facility' AND status='ok'"
    ).fetchone()
    return row[0] if row and row[0] else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--mode", choices=["full","incremental"], default="full")
    args = ap.parse_args()

    csv_path = Path(args.csv).resolve()
    if not csv_path.exists():
        print(f"CSV 없음: {csv_path}", file=sys.stderr)
        return 1

    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if not db_path.exists():
        print(f"ERROR: DB 없음: {db_path}", file=sys.stderr)
        return 1

    started = datetime.now()
    print(f"[{started:%H:%M:%S}] {args.mode} 적재 시작")
    print(f"  CSV : {csv_path}")
    print(f"  DB  : {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    try:
        last_sync = get_last_sync(conn) if args.mode == "incremental" else None
        if last_sync:
            print(f"  증분 기준: {last_sync} 이후")

        t0 = time.time()
        rows = list(parse_csv(csv_path, last_sync=last_sync))
        print(f"  파싱: {len(rows):,}건, {time.time()-t0:.1f}s")

        t1 = time.time()
        ins, upd = ingest(conn, rows, mode=args.mode)
        print(f"  적재: 신규 {ins:,} / 갱신 {upd:,}, {time.time()-t1:.1f}s")

        finished = datetime.now()
        log_run(conn, started, finished, ins, upd, "ok")
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
