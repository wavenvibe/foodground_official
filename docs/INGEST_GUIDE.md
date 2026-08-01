# 푸드그라운드 — 로컬 개발 스캐폴드 (Phase 1~2)

TIPS 과제 성능지표 TTI ≤ 1,000ms / Server RAS 5시간 연속 검증을 위해,
공공데이터 식품제조가공업 94,723건을 로컬에 적재·조회하는 최소 스캐폴드.

## 스택

- **DB**: SQLite (로컬) → Phase 3 에서 Supabase PostgreSQL 로 전환
- **적재**: Python 3.8+ 표준 라이브러리 (sqlite3, csv)
- **원천**: data.go.kr 15044976 CSV (CP949). LOCALDATA API 는 2026-04-14 폐쇄.

## 2-커맨드 셋업

```bash
# 1) DB 초기화
mkdir -p data
python3 -c "import sqlite3; conn=sqlite3.connect('data/foodground.db'); \
  conn.executescript(open('migrations/0001_init.sqlite.sql', encoding='utf-8').read())"

# 2) CSV 적재 (최초 전량)
python3 scripts/ingest_facility.py --csv "../식품_식품제조가공업.csv"
```

결과 확인:

```bash
python3 scripts/verify.py
```

## 증분 적재 (매월)

```bash
# data.go.kr 에서 새 CSV 받아 덮어쓴 뒤
python3 scripts/ingest_facility.py --csv "../식품_식품제조가공업.csv" --mode incremental
```

`최종수정시점` 이 직전 `ingest_log.finished_at` 이후인 행만 UPSERT.
FTS5 (`facility_fts`) 도 동기 갱신.

## HACCP 인증업체 적재

```bash
# 로컬 CSV (raw_companies.csv, 1,046행)
python3 scripts/ingest_haccp.py --csv ../data/raw_companies.csv

# API 직접 호출 (HACCP_SERVICE_KEY 필요, ~2028-02-11 유효)
python3 scripts/ingest_haccp.py --api
```

업체명 정규화(㈜·주식회사·농업회사법인 제거) + 시도 별칭(강원도↔강원특별자치도, 전북↔전북특별자치도) 로
**매칭률 87.3%** (308/269건). `facility.is_haccp` 자동 동기화.

## 품목제조보고 적재

```bash
# 최초에 응답 스키마 확인 (필드명 점검)
python3 scripts/ingest_production.py --probe

# 전량 적재 (MFDS_REPORT_KEY 필요)
python3 scripts/ingest_production.py --api
```

data.go.kr 15062098 → `production_log` UPSERT.
업체명+주소로 facility 매칭 (ingest_haccp.py 와 동일 인덱스 재사용).
401/SERVICE_KEY 에러 시 `.env` 의 `MFDS_REPORT_KEY` 를 '일반 인증키(Encoding)' 로 교체.

## 실측 성능 (2026-04-24 기준)

| 항목 | 값 |
|------|-----|
| facility 건수 | 94,723 (영업중 30,257) |
| CSV 파싱 | 2.6s |
| facility DB 적재 | 2.0s |
| 기본 검색 쿼리 평균 | 8.94ms |
| FTS5 업체명 부분매칭 | 6.05ms |
| 주소 파싱 성공률 | 100% (parse_fail=0) |
| 좌표 커버리지 (영업중) | 98.1% |
| HACCP 인증업체 | 308건 / facility 매칭 269건 (87.3%) |
| production_log 적재 | **1,047,894** / 1,047,962건 (99.99%, 완결) |
| production facility 매칭 | **815,989건 (77.9%)** — 스케일 무관 일관 |
| production JOIN 조회 | **0.05ms** (TTI 1,000ms 예산의 1/20,000) |

## TIPS 성능지표 관점 여유

TTI 1,000ms / Server RAS 5시간 예산에 대해 현재 단일 SQLite 인스턴스
기준으로도 쿼리 레이턴시는 **1ms 미만**. 데이터 이상치(예: 보고일자
2103-06-18 등 식약처 원본 오기)가 존재하므로, TIPS 8개 지표 중
'식품표기오류 탐지' 시연 데이터로 그대로 재활용 가능.

## 디렉터리

```
푸드그라운드/
├─ migrations/
│  ├─ 0001_init.sqlite.sql   # Phase 1~2 로컬
│  └─ 0001_init.sql          # Phase 3 PostgreSQL (pg_trgm + JSONB)
├─ scripts/
│  ├─ ingest_facility.py     # CSV → SQLite 적재
│  ├─ ingest_haccp.py        # HACCP getFoodList → haccp_cert
│  ├─ ingest_production.py   # 15062098 품목제조보고 → production_log
│  ├─ verify.py              # 11개 검증 쿼리
│  └─ verify_queries.sql     # Phase 3 PG 용 동일 쿼리 (psql -f)
├─ docker-compose.yml        # Phase 3 Postgres 16 + Redis 7 (필요 시)
├─ .env.example              # 템플릿
└─ data/foodground.db        # (git ignore)
```

## Phase 3 PostgreSQL 전환

1. `docker compose up -d` 또는 Supabase 프로젝트 생성
2. `psql "$PG_DSN" -f migrations/0001_init.sql`
3. `requirements.txt` 의 `psycopg2-binary` 주석 해제 후 설치
4. `ingest_facility.py` 의 `sqlite3` → `psycopg2` 로 교체 (별도 브랜치에서 작업)

테이블·컬럼·인덱스 구조는 두 마이그레이션이 동일해서 쿼리는 그대로 재사용.
