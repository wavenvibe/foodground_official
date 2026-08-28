"""
VS-2 승인점 B — public 7개 테이블 0건 확인
SUPABASE_DB_URL 환경변수를 사용해 psycopg2로 직접 연결한다.
합계가 정확히 0이면 exit 0, 1건 이상이거나 오류이면 exit 1.
URL·자격증명은 출력하지 않는다.
"""
import os
import sys

TABLES = [
    'facilities',
    'ingredients',
    'recipes',
    'recipe_ingredients',
    'standard_foods',
    'substitute_pairs',
    'ingredient_name_match',
]


def main() -> None:
    db_url = os.environ.get('SUPABASE_DB_URL', '').strip()
    if not db_url:
        print('[오류] SUPABASE_DB_URL 환경변수가 설정되지 않았습니다.', file=sys.stderr)
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        print('[오류] psycopg2 가 설치되지 않았습니다. pip install psycopg2-binary', file=sys.stderr)
        sys.exit(1)

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()

        total = 0
        for table in TABLES:
            cur.execute(f'SELECT COUNT(*) FROM public.{table}')
            row = cur.fetchone()
            total += row[0]

        cur.close()
        conn.close()
    except Exception:
        print('[오류] public 테이블 조회 실패 (연결 정보 생략)', file=sys.stderr)
        sys.exit(1)

    if total == 0:
        print(f'[확인] public 테이블 {len(TABLES)}개 합계 0건 — 정상')
        sys.exit(0)
    else:
        print(f'[오류] public 테이블에 데이터 감지: 합계 {total}건', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
