#!/usr/bin/env python3
"""
ingest_production.py - Food Safety Korea C002 (prdct report) SQLite ingest.
API: http://openapi.foodsafetykorea.go.kr/api/{key}/C002/json/{start}/{end}
"""
from __future__ import annotations
import argparse, csv, json, os, sqlite3, sys, time
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

sys.path.insert(0, str(Path(__file__).parent))
from ingest_haccp import _norm_name, _norm_sido, build_facility_index

DEFAULT_DB = os.getenv("SQLITE_PATH", "data/foodground.db")

_FREEZE = Path(__file__).parent.parent / "data" / ".freeze"
if _FREEZE.exists():
    print(f"[FREEZE] data/.freeze 존재 — 적재 중단. KTCC 시험 기간 중에는 실행 금지.", file=sys.stderr)
    sys.exit(0)

REPORT_KEY = os.getenv("MFDS_REPORT_KEY", "").strip()
SERVICE_ID = "C002"
BASE = "http://openapi.foodsafetykorea.go.kr/api"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")
PAGE_SIZE = 1000


def nz(s):
    s = s.strip() if s else ""
    return s or None


def _fetch(url, timeout=45):
    req = Request(url, headers={"User-Agent": UA})
    try:
        with urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except HTTPError as e:
        b = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, b
    except (URLError, TimeoutError) as e:
        reason = getattr(e, "reason", str(e))
        return 0, "CONNECT_FAIL: " + str(reason)


def _parse_body(body):
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return [], 0, "JSON_PARSE_FAIL"
    root = data.get(SERVICE_ID) or data
    rows = root.get("row") or []
    total = int(root.get("total_count", 0) or 0)
    result = root.get("RESULT") or {}
    code = result.get("CODE", "")
    msg = result.get("MSG", "")
    if code and code != "INFO-000":
        return [], total, "[" + code + "] " + msg
    return rows, total, "OK"


def rows_from_api(service_key, max_rows=None, start_idx=1, max_retries=5):
    if not service_key:
        raise RuntimeError("MFDS_REPORT_KEY empty.")
    start = start_idx
    total = None
    fetched = 0
    while True:
        end = start + PAGE_SIZE - 1
        url = BASE + "/" + service_key + "/" + SERVICE_ID + "/json/" + str(start) + "/" + str(end)

        status = body = None
        for attempt in range(1, max_retries + 1):
            status, body = _fetch(url, timeout=45)
            if status == 200 and not body.startswith("CONNECT_FAIL"):
                break
            wait = min(2 ** attempt, 30)
            print("  [retry " + str(attempt) + "/" + str(max_retries) + "] status="
                  + str(status) + " @ start=" + str(start) + " - sleep " + str(wait) + "s",
                  flush=True)
            time.sleep(wait)
        if status != 200:
            raise RuntimeError("HTTP " + str(status) + " @ start=" + str(start)
                               + " (retries exhausted)\n" + body[:400])
        rows, total, note = _parse_body(body)
        if note != "OK":
            raise RuntimeError("API error @ start=" + str(start) + ": " + note)
        if not rows:
            break
        for r in rows:
            yield r
            fetched += 1
            if max_rows and fetched >= max_rows:
                return
        print("  [" + str(start).rjust(7) + "-" + str(end).rjust(7) + "] "
              + str(len(rows)).rjust(4) + " rows (cum " + f"{fetched:,}/{total:,}" + ")",
              flush=True)
        if len(rows) < PAGE_SIZE:
            break
        start = end + 1
        time.sleep(0.15)


def rows_from_csv(path):
    for enc in ("utf-8-sig", "cp949"):
        try:
            with open(path, encoding=enc, newline="") as f:
                for row in csv.DictReader(f):
                    yield row
            return
        except UnicodeDecodeError:
            continue
    raise RuntimeError("encoding detect failed: " + str(path))


def probe():
    if not REPORT_KEY:
        print("MFDS_REPORT_KEY empty.", file=sys.stderr)
        return 1
    url = BASE + "/" + REPORT_KEY + "/" + SERVICE_ID + "/json/1/5"
    print("URL:", url.replace(REPORT_KEY, "***"))
    status, body = _fetch(url)
    print("status=" + str(status))
    if body.strip().startswith("{"):
        try:
            data = json.loads(body)
            print(json.dumps(data, ensure_ascii=False, indent=2)[:3500])
            rows, total, note = _parse_body(body)
            print("\n[summary] total_count=" + f"{total:,}" + " note=" + note
                  + " rows=" + str(len(rows)))
            if rows:
                print("keys:", list(rows[0].keys()))
            return 0
        except json.JSONDecodeError:
            print(body[:500])
    else:
        print(body[:800])
    return 2


def ingest(conn, rows_iter):
    cur = conn.cursor()
    idx_full, idx_sido, n_fac = build_facility_index(cur)
    print("  facility index:", f"{n_fac:,}")

    upsert = (
        "INSERT INTO production_log (report_no, facility_mgt_no, product_name, "
        "category, maker_name, maker_addr, ingredients, shelf_life_days, "
        "reported_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(report_no) DO UPDATE SET "
        "facility_mgt_no = excluded.facility_mgt_no, "
        "product_name = excluded.product_name, "
        "category = excluded.category, "
        "maker_name = excluded.maker_name, "
        "maker_addr = excluded.maker_addr, "
        "ingredients = excluded.ingredients, "
        "shelf_life_days = excluded.shelf_life_days, "
        "reported_at = excluded.reported_at, "
        "updated_at = excluded.updated_at"
    )
    now = datetime.now().isoformat(timespec="seconds")

    fac_by_norm = {}
    dup = set()
    for (norm, sido_n, sgg), mgt in idx_full.items():
        if norm in fac_by_norm:
            dup.add(norm)
        else:
            fac_by_norm[norm] = mgt
    for n in dup:
        fac_by_norm.pop(n, None)

    haccp_by_lcns = {}
    try:
        for mgt, raw in cur.execute(
            "SELECT facility_mgt_no, raw_payload FROM haccp_cert "
            "WHERE facility_mgt_no IS NOT NULL"
        ):
            if not raw:
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict):
                lic = payload.get("licenseno") or payload.get("appointno")
                if lic and mgt:
                    haccp_by_lcns[str(lic).strip()] = mgt
    except sqlite3.OperationalError:
        pass
    print("  HACCP bridge:", f"{len(haccp_by_lcns):,}")

    total = m_lcns = m_haccp = m_name = 0
    batch = []
    cur_lookup = conn.cursor()

    for it in rows_iter:
        report_no = nz(it.get("PRDLST_REPORT_NO"))
        product_name = nz(it.get("PRDLST_NM"))
        if not report_no or not product_name:
            continue
        maker_name = nz(it.get("BSSH_NM"))
        lcns_no = nz(it.get("LCNS_NO"))
        category = nz(it.get("PRDLST_DCNM"))
        ingredients = nz(it.get("RAWMTRL_NM"))
        reported_at = nz(it.get("PRMS_DT"))
        if reported_at and len(reported_at) == 8 and reported_at.isdigit():
            reported_at = reported_at[:4] + "-" + reported_at[4:6] + "-" + reported_at[6:8]

        fac_mgt = None
        if lcns_no:
            row = cur_lookup.execute(
                "SELECT mgt_no FROM facility WHERE mgt_no = ? LIMIT 1", (lcns_no,)
            ).fetchone()
            if row:
                fac_mgt = row[0]
                m_lcns += 1
        if not fac_mgt and lcns_no and lcns_no in haccp_by_lcns:
            fac_mgt = haccp_by_lcns[lcns_no]
            m_haccp += 1
        if not fac_mgt and maker_name:
            norm = _norm_name(maker_name)
            if norm and norm in fac_by_norm:
                fac_mgt = fac_by_norm[norm]
                m_name += 1

        batch.append((report_no, fac_mgt, product_name, category, maker_name,
                      None, ingredients, None, reported_at, now))
        total += 1
        if len(batch) >= 1000:
            cur.executemany(upsert, batch)
            conn.commit()
            batch.clear()
    if batch:
        cur.executemany(upsert, batch)
    conn.commit()
    return total, m_lcns, m_haccp, m_name


def log_run(conn, started, finished, ins, matched, status, err=None):
    conn.execute(
        "INSERT INTO ingest_log (dataset, started_at, finished_at, "
        "rows_inserted, rows_updated, status, error_message) "
        "VALUES ('production', ?, ?, ?, ?, ?, ?)",
        (started.isoformat(timespec="seconds"),
         finished.isoformat(timespec="seconds"),
         ins, matched, status, err),
    )
    conn.commit()


def main():
    ap = argparse.ArgumentParser(description="Production report -> SQLite")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--api", action="store_true")
    src.add_argument("--csv")
    src.add_argument("--probe", action="store_true")
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--max", type=int, default=None)
    ap.add_argument("--resume-from", type=int, default=1,
                    help="startIdx to resume from (e.g. 683001)")
    args = ap.parse_args()

    if args.probe:
        return probe()

    db_path = Path(args.db)
    if not db_path.exists():
        print("ERROR: DB not found:", db_path, file=sys.stderr)
        return 1

    started = datetime.now()
    src_kind = "API" if args.api else "CSV"
    print("[" + started.strftime("%H:%M:%S") + "] ingest start (source=" + src_kind + ")")

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        if args.api:
            row_iter = rows_from_api(REPORT_KEY, max_rows=args.max,
                                     start_idx=args.resume_from)
        else:
            csv_path = Path(args.csv).resolve()
            if not csv_path.exists():
                print("CSV not found:", csv_path, file=sys.stderr)
                return 1
            row_iter = rows_from_csv(csv_path)

        total, m_lcns, m_haccp, m_name = ingest(conn, row_iter)
        mtotal = m_lcns + m_haccp + m_name
        rate = (mtotal / total * 100) if total else 0
        print("  ingested:", f"{total:,}",
              " matched:", f"{mtotal:,}",
              "(LCNS_NO " + f"{m_lcns:,}" + " + HACCP " + f"{m_haccp:,}"
              + " + name " + f"{m_name:,}" + f", {rate:.1f}%)")

        finished = datetime.now()
        log_run(conn, started, finished, total, mtotal, "ok")
        print("[" + finished.strftime("%H:%M:%S") + "] done ("
              + f"{(finished-started).total_seconds():.1f}s)")
        return 0
    except Exception as e:
        finished = datetime.now()
        try:
            log_run(conn, started, finished, 0, 0, "fail", str(e))
        except Exception:
            pass
        print("ERROR:", e, file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
