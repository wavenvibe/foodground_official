#!/usr/bin/env python3
"""
generate_alerts.py — 관심업체 변동 감지 → alerts 테이블 INSERT

감지 항목:
  - suspension  : sales_suspension 신규 행 (회수·판매중지)
  - new_product : production_log 신규 행 (새 품목제조보고)

실행:
  python scripts/generate_alerts.py
  python scripts/generate_alerts.py --db data/foodground.db --since 2026-01-01

동작 방식:
  1) ingest_log에서 dataset='alerts' 최근 실행 시각(window_end) 조회
  2) 그 시각 이후 sales_suspension / production_log 신규 행 탐색
  3) watchlist JOIN → 관심 등록한 user_id 식별
  4) alerts INSERT (중복 방지: ref_id + user_id + alert_type UNIQUE)
  5) ingest_log 기록
"""
from __future__ import annotations
import argparse, os, sqlite3, sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

DEFAULT_DB = os.getenv("SQLITE_PATH", "data/foodground.db")

# .freeze guard — KTCC 시험 기간 중 적재 금지
_FREEZE = Path(__file__).parent.parent / "data" / ".freeze"
if _FREEZE.exists():
    print("[FREEZE] data/.freeze 존재 — 알림 생성 중단. KTCC 시험 기간 중에는 실행 금지.", file=sys.stderr)
    sys.exit(0)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _last_run_window(conn: sqlite3.Connection) -> str | None:
    row = conn.execute(
        "SELECT window_end FROM ingest_log WHERE dataset='alerts' AND status='ok' "
        "ORDER BY started_at DESC LIMIT 1"
    ).fetchone()
    return row[0] if row else None


def generate_suspension_alerts(
    conn: sqlite3.Connection, since: str
) -> int:
    """sales_suspension 신규 행 → alerts INSERT. 삽입 건수 반환."""
    rows = conn.execute(
        """
        SELECT ss.id, ss.facility_mgt_no, ss.product_name, ss.reason, ss.created_at,
               w.user_id
          FROM sales_suspension ss
          JOIN watchlist w ON w.facility_mgt_no = ss.facility_mgt_no
         WHERE ss.created_at > ?
        """,
        (since,),
    ).fetchall()

    inserted = 0
    for row in rows:
        susp_id, mgt_no, product_name, reason, created_at, user_id = row
        title = f"회수·판매중지: {product_name}"
        detail = reason or ""
        try:
            conn.execute(
                """
                INSERT OR IGNORE INTO alerts
                  (user_id, facility_mgt_no, alert_type, title, detail, ref_id, created_at)
                VALUES (?, ?, 'suspension', ?, ?, ?, ?)
                """,
                (user_id, mgt_no, title, detail, susp_id, created_at),
            )
            inserted += conn.execute("SELECT changes()").fetchone()[0]
        except sqlite3.Error as exc:
            print(f"[WARN] suspension alert insert failed: {exc}", file=sys.stderr)

    return inserted


def generate_new_product_alerts(
    conn: sqlite3.Connection, since: str
) -> int:
    """production_log 신규 행 → alerts INSERT. 삽입 건수 반환."""
    rows = conn.execute(
        """
        SELECT pl.report_no, pl.facility_mgt_no, pl.product_name,
               pl.category, pl.updated_at,
               w.user_id
          FROM production_log pl
          JOIN watchlist w ON w.facility_mgt_no = pl.facility_mgt_no
         WHERE pl.updated_at > ?
        """,
        (since,),
    ).fetchall()

    inserted = 0
    for row in rows:
        report_no, mgt_no, product_name, category, updated_at, user_id = row
        title = f"새 품목: {product_name}"
        detail = category or ""
        # ref_id: report_no는 TEXT PRIMARY KEY → CAST hash로 INTEGER 매핑 불가.
        # alerts.ref_id는 INTEGER이므로 NULL로 저장하고 title+user_id+mgt_no로 중복 제어.
        try:
            conn.execute(
                """
                INSERT OR IGNORE INTO alerts
                  (user_id, facility_mgt_no, alert_type, title, detail, ref_id, created_at)
                VALUES (?, ?, 'new_product', ?, ?, NULL, ?)
                """,
                (user_id, mgt_no, title, detail, updated_at or _now_iso()),
            )
            inserted += conn.execute("SELECT changes()").fetchone()[0]
        except sqlite3.Error as exc:
            print(f"[WARN] new_product alert insert failed: {exc}", file=sys.stderr)

    return inserted


def main() -> int:
    ap = argparse.ArgumentParser(description="관심업체 변동 알림 생성")
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument(
        "--since",
        default=None,
        help="ISO 8601 시각 (기본: ingest_log 최근 실행 시각 또는 7일 전)",
    )
    ap.add_argument("--dry-run", action="store_true", help="INSERT 없이 결과만 출력")
    args = ap.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"[ERROR] DB 없음: {db_path}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    started_at = _now_iso()

    # since 결정: 명시적 인수 > 최근 ingest_log > 7일 전
    if args.since:
        since = args.since
    else:
        since = _last_run_window(conn)
        if since is None:
            from datetime import timedelta
            since = (
                datetime.now(timezone.utc) - timedelta(days=7)
            ).strftime("%Y-%m-%dT%H:%M:%SZ")
            print(f"[INFO] 최초 실행 — {since} 이후 데이터 처리", file=sys.stderr)

    print(f"[INFO] since={since}", file=sys.stderr)

    susp_count = new_prod_count = 0
    try:
        if args.dry_run:
            # dry-run: count only
            susp_count = conn.execute(
                "SELECT COUNT(*) FROM sales_suspension ss "
                "JOIN watchlist w ON w.facility_mgt_no = ss.facility_mgt_no "
                "WHERE ss.created_at > ?",
                (since,),
            ).fetchone()[0]
            new_prod_count = conn.execute(
                "SELECT COUNT(*) FROM production_log pl "
                "JOIN watchlist w ON w.facility_mgt_no = pl.facility_mgt_no "
                "WHERE pl.updated_at > ?",
                (since,),
            ).fetchone()[0]
            print(f"[DRY-RUN] suspension={susp_count}  new_product={new_prod_count}")
            return 0

        susp_count = generate_suspension_alerts(conn, since)
        new_prod_count = generate_new_product_alerts(conn, since)
        conn.commit()

    except Exception as exc:
        conn.rollback()
        conn.execute(
            "INSERT INTO ingest_log (dataset, started_at, finished_at, status, error_message) "
            "VALUES ('alerts', ?, ?, 'error', ?)",
            (started_at, _now_iso(), str(exc)),
        )
        conn.commit()
        conn.close()
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    finished_at = _now_iso()
    total = susp_count + new_prod_count
    conn.execute(
        "INSERT INTO ingest_log "
        "  (dataset, started_at, finished_at, rows_inserted, status, window_begin, window_end) "
        "VALUES ('alerts', ?, ?, ?, 'ok', ?, ?)",
        (started_at, finished_at, total, since, finished_at),
    )
    conn.commit()
    conn.close()

    print(
        f"[OK] 알림 생성 완료: suspension={susp_count}  new_product={new_prod_count}  total={total}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
