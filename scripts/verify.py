#!/usr/bin/env python3
"""
verify.py — 적재 후 데이터 무결성·실데이터 통계·기본 쿼리 성능 확인

사용법:
  python scripts/verify.py                          # 기본 data/foodground.db
  python scripts/verify.py --db path/to.db

PG 용 scripts/verify_queries.sql 의 SQLite 버전.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
import time
from pathlib import Path

DEFAULT_DB = os.getenv('SQLITE_PATH', 'data/foodground.db')


def section(title: str) -> None:
    print(f'\n━━ {title} ━━')


def run_query(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> list[tuple]:
    return conn.execute(sql, params).fetchall()


def fmt_table(rows: list[tuple], headers: list[str]) -> None:
    if not rows:
        print('  (결과 없음)')
        return
    widths = [len(h) for h in headers]
    for r in rows:
        for i, v in enumerate(r):
            widths[i] = max(widths[i], len(str(v) if v is not None else ''))
    line = '  ' + '  '.join(h.ljust(widths[i]) for i, h in enumerate(headers))
    print(line)
    print('  ' + '  '.join('-' * w for w in widths))
    for r in rows:
        print('  ' + '  '.join(
            (str(v) if v is not None else '').ljust(widths[i]) for i, v in enumerate(r)
        ))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', default=DEFAULT_DB)
    args = ap.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f'ERROR: DB 없음: {db_path}', file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(db_path))
    conn.execute('PRAGMA foreign_keys = ON')

    total = conn.execute('SELECT COUNT(*) FROM facility').fetchone()[0]
    print(f'DB : {db_path}')
    print(f'facility : {total:,}건')
    if total == 0:
        print('(비어있음 — ingest 먼저 실행)')
        return 0

    # 1. 영업상태 분포
    section('1. 영업상태 분포')
    rows = run_query(conn, '''
        SELECT status, COUNT(*) AS cnt,
               ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM facility), 1) AS pct
        FROM facility GROUP BY status ORDER BY cnt DESC
    ''')
    fmt_table(rows, ['status', 'cnt', 'pct(%)'])

    # 2. 시도별 영업중 업체
    section('2. 시도별 영업중 업체 TOP 10')
    rows = run_query(conn, '''
        SELECT region_sido, COUNT(*) AS active
        FROM facility WHERE status = '영업/정상'
        GROUP BY region_sido ORDER BY active DESC LIMIT 10
    ''')
    fmt_table(rows, ['region_sido', 'active'])

    # 3. 경기도 시군구 TOP 10
    section('3. 경기도 시군구 TOP 10 (영업중)')
    rows = run_query(conn, '''
        SELECT region_sigungu, COUNT(*) AS active
        FROM facility
        WHERE status = '영업/정상' AND region_sido = '경기도'
        GROUP BY region_sigungu ORDER BY active DESC LIMIT 10
    ''')
    fmt_table(rows, ['region_sigungu', 'active'])

    # 4. 업태 분포
    section('4. 업태 분포 (영업중) TOP 10')
    rows = run_query(conn, '''
        SELECT biz_type, COUNT(*) AS active
        FROM facility WHERE status = '영업/정상'
        GROUP BY biz_type ORDER BY active DESC LIMIT 10
    ''')
    fmt_table(rows, ['biz_type', 'active'])

    # 5. 필드 커버리지
    section('5. 필드 커버리지 (영업중)')
    rows = run_query(conn, '''
        SELECT
          COUNT(*) AS active_total,
          COUNT(coord_x) AS with_coord,
          COUNT(road_addr) AS with_road_addr,
          COUNT(tel) AS with_tel,
          COUNT(homepage) AS with_homepage
        FROM facility WHERE status = '영업/정상'
    ''')
    fmt_table(rows, ['active_total', 'with_coord', 'with_road_addr', 'with_tel', 'with_homepage'])

    # 6. 최근 변경 (증분 배치 규모 감)
    section('6. 최근 변경 분포 (increment 배치 예상치)')
    rows = run_query(conn, '''
        SELECT
          SUM(CASE WHEN updated_at >= date('now','-7 days')  THEN 1 ELSE 0 END) AS last_7d,
          SUM(CASE WHEN updated_at >= date('now','-30 days') THEN 1 ELSE 0 END) AS last_30d,
          SUM(CASE WHEN updated_at >= date('now','-90 days') THEN 1 ELSE 0 END) AS last_90d
        FROM facility
    ''')
    fmt_table(rows, ['last_7d', 'last_30d', 'last_90d'])

    # 7. 주요 검색 쿼리 성능
    section('7. 검색 쿼리 지연시간 (5회 평균)')
    q = '''
        SELECT mgt_no, name, biz_type, road_addr, tel, coord_x, coord_y
        FROM facility
        WHERE status = '영업/정상'
          AND region_sido = '경기도'
          AND biz_type LIKE '%식품제조가공업%'
        ORDER BY licensed_at DESC
        LIMIT 20
    '''
    durs = []
    for _ in range(5):
        t = time.time()
        conn.execute(q).fetchall()
        durs.append((time.time() - t) * 1000)
    avg = sum(durs) / len(durs)
    print(f'  평균 {avg:.2f}ms   (min {min(durs):.2f} / max {max(durs):.2f})')

    # 8. RMR 타깃 업종 샘플
    section('8. RMR 타깃 업종 샘플 (도시락·PB)')
    rows = run_query(conn, '''
        SELECT name, region_sido, region_sigungu, tel
        FROM facility
        WHERE biz_type IN ('도시락제조업', 'PB제품 제조업체') AND status = '영업/정상'
        LIMIT 10
    ''')
    fmt_table(rows, ['name', 'region_sido', 'region_sigungu', 'tel'])

    # 9. 주소 파싱 실패 건수 (0이어야 정상)
    section('9. 주소 파싱 실패 (0이면 정상)')
    cnt = conn.execute(
        "SELECT COUNT(*) FROM facility WHERE status = '영업/정상' AND region_sido IS NULL"
    ).fetchone()[0]
    print(f'  parse_fail : {cnt}')

    # 10. FTS5 한글 부분매칭 샘플
    section('10. FTS5 업체명 검색 샘플 (name MATCH "*주식회사*")')
    t = time.time()
    rows = conn.execute('''
        SELECT f.name, f.region_sido, f.region_sigungu
        FROM facility_fts ft JOIN facility f ON f.mgt_no = ft.mgt_no
        WHERE facility_fts MATCH 'name:주식회사*'
          AND f.status = '영업/정상'
        LIMIT 5
    ''').fetchall()
    dur = (time.time() - t) * 1000
    fmt_table(rows, ['name', 'region_sido', 'region_sigungu'])
    print(f'  ({dur:.2f}ms)')

    # 11. 적재 이력
    section('11. ingest_log 최근 5건')
    rows = run_query(conn, '''
        SELECT dataset, started_at, finished_at, rows_inserted, rows_updated, status
        FROM ingest_log ORDER BY started_at DESC LIMIT 5
    ''')
    fmt_table(rows, ['dataset', 'started_at', 'finished_at', 'ins', 'upd', 'status'])

    # ──── HACCP 인증 ────
    haccp_total = conn.execute('SELECT COUNT(*) FROM haccp_cert').fetchone()[0]
    if haccp_total:
        section('12. HACCP 인증업체 총괄')
        rows = run_query(conn, '''
            SELECT
              COUNT(*) AS total,
              COUNT(facility_mgt_no) AS matched,
              ROUND(COUNT(facility_mgt_no) * 100.0 / COUNT(*), 1) AS match_pct
            FROM haccp_cert
        ''')
        fmt_table(rows, ['total', 'matched', 'match_pct(%)'])

    # ──── 품목제조보고 (production_log) ────
    prod_total = conn.execute('SELECT COUNT(*) FROM production_log').fetchone()[0]
    if prod_total:
        section('13. production_log 총괄')
        rows = run_query(conn, '''
            SELECT
              COUNT(*) AS total,
              COUNT(facility_mgt_no) AS matched,
              ROUND(COUNT(facility_mgt_no) * 100.0 / COUNT(*), 1) AS match_pct,
              COUNT(DISTINCT maker_name) AS unique_makers,
              COUNT(DISTINCT category) AS unique_categories
            FROM production_log
        ''')
        fmt_table(rows, ['total', 'matched', 'match(%)', 'makers', 'categories'])

        section('14. 품목 카테고리 TOP 15')
        rows = run_query(conn, '''
            SELECT category, COUNT(*) AS cnt
            FROM production_log
            WHERE category IS NOT NULL
            GROUP BY category ORDER BY cnt DESC LIMIT 15
        ''')
        fmt_table(rows, ['category', 'cnt'])

        section('15. 보고일자 범위·연도별 분포')
        rows = run_query(conn, '''
            SELECT
              MIN(reported_at) AS earliest,
              MAX(reported_at) AS latest,
              COUNT(DISTINCT substr(reported_at,1,4)) AS year_count
            FROM production_log WHERE reported_at IS NOT NULL
        ''')
        fmt_table(rows, ['earliest', 'latest', 'year_count'])

        rows = run_query(conn, '''
            SELECT substr(reported_at,1,4) AS year, COUNT(*) AS cnt
            FROM production_log WHERE reported_at IS NOT NULL
            GROUP BY year ORDER BY year DESC LIMIT 10
        ''')
        fmt_table(rows, ['year', 'cnt'])

        section('16. facility 당 품목 수 TOP 10 (가장 활발한 제조시설)')
        rows = run_query(conn, '''
            SELECT f.name, f.region_sido, f.region_sigungu, COUNT(p.report_no) AS items
            FROM production_log p
            JOIN facility f ON f.mgt_no = p.facility_mgt_no
            GROUP BY p.facility_mgt_no
            ORDER BY items DESC LIMIT 10
        ''')
        fmt_table(rows, ['name', 'sido', 'sgg', 'items'])

        section('17. production_log 조회 지연 (facility→품목, 5회 평균)')
        q = '''
            SELECT p.product_name, p.category, p.reported_at
            FROM production_log p
            WHERE p.facility_mgt_no = (
                SELECT mgt_no FROM facility
                WHERE status = '영업/정상' AND region_sido = '경기도'
                LIMIT 1
            )
            LIMIT 20
        '''
        durs = []
        for _ in range(5):
            t = time.time()
            conn.execute(q).fetchall()
            durs.append((time.time() - t) * 1000)
        avg = sum(durs) / len(durs)
        print(f'  평균 {avg:.2f}ms   (min {min(durs):.2f} / max {max(durs):.2f})')

    conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
