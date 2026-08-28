# G3-07 Codex 독립검토 v0.2

- 검토일: 2026-08-25
- 대상: `.moai/design/chg-g4-002/` 상세설계 9종 B-01~B-09 반영본
- 권위문서: DOC-07 v0.7, DOC-08 v0.5, DOC-09 v0.4, DOC-04 v0.5, ADM-08 v0.5
- 판정: **미승인 — 의미 정합성 보완 후 재검토**
- 변경금지: 앱 코드, SQL/migration 적용, 데이터 적재, Supabase, Vercel, commit·push

## 1. 검증 결과

기존 검증기는 9종 파일과 필수 문자열, 현재범위 ID 60개의 존재만 확인하여 PASS했다. 그러나 DOC-07 v0.7 원본과 의미를 대조하면 동일 ID에 다른 기능명이 붙은 항목이 다수 확인된다.

`05-checks/g3-07-current-requirements.json`에 DOC-07 v0.7의 현재범위 60건을 ID·상태·정식 요구사항명으로 고정하고 검증기를 보강했다.

```text
node 05-checks/validate-g3-07.mjs --mode=final
G3-07 final validation: FAIL (78)
```

오류 구성은 요구사항 의미 불일치 60건, 보류 요구사항 승인 오표기 2건, 데이터·보안·롤백 잔존오류, 조건부 화면 노출, 잘못된 요구사항 ID 해석이다.

## 2. 차단사항

### B-10. DOC-07 요구사항 의미로 추적표 재작성

- `06-qa-acceptance-trace.md`의 현재범위 60건을 `05-checks/g3-07-current-requirements.json`의 ID·상태·정식 요구사항명과 동일하게 작성한다.
- 각 행에 화면/경로, API 또는 내부검증, 데이터, 시험방법, 합격기준, 증빙, 구현 슬라이스를 연결한다.
- FG-FUN-006·007은 제품 검색·상세 후속 요구사항이므로 승인 행에서 제거한다.
- FG-FUN-005는 제조업체 상세정보, FG-FUN-012는 안정적 페이지네이션이다.
- NFR·SEC·DAT·OPS는 단순 ID 존재가 아니라 DOC-07의 정식 의미와 합격기준을 따른다.

### B-11. 공동제조 핵심범위 복원

- FG-FUN-032: 매칭조건 입력
- FG-FUN-033: 필수조건 위반 없는 후보 필터·순위
- FG-FUN-034: 각 조건의 일치·미충족 근거와 데이터 출처 표시
- FG-FUN-035: 시설 상세 연결과 뒤로가기 조건 유지

FG-FUN-042는 운영자 데이터·서비스 상태, FG-FUN-044는 배치 실패·지연 알림, FG-FUN-060은 운영자 게시물·문의 처리현황이다. 이 ID를 URL 파라미터, 일치근거, 미충족조건의 근거로 사용하지 않는다. 무후보 상태도 현재범위 공통 상태로 설계한다.

### B-12. 대체 식재료 데이터계약 실제 산출물과 일치

- 정렬식의 `score_overall`, `facility_id`를 제거하고 실제 `score_final`과 승인된 안정 식별키를 사용한다.
- 1단계 기본가중치 영양성분 0.60, 재료구분 0.15, 식품군 0.15, 조리상태 0.10과 2단계 가중치 0.70/0.20/0.10을 구분한다.
- 결측 지표가 있을 때 활성 지표 가중치를 재정규화하는 실제 로직을 명시한다.
- 식품쌍 6개 지표, 식재료명 매칭방법, 영양정보가 서로 다른 산출물에 있으므로 join 키·중복·무매칭·결측 계약을 정의한다.
- 5개 매칭방법 `완전일치·포함일치·철자유사·동의어·미매칭`을 UI와 API에서 동일하게 다룬다.

### B-13. 제조시설 `product_types` 파생근거 확정

원본 `facility` 테이블에는 `email`과 `product_types` 컬럼이 없다. `product_types`가 공동제조 필수조건이면 `production_log` 등 승인된 원천에서 시설키 `mgt_no`로 파생 가능한지 행수·참조율·중복·결측을 읽기 전용으로 감사하고 파생규칙과 계보를 먼저 확정한다. 불가능하면 사용자 승인 없이 가상 컬럼을 만들지 말고 G3 미결정사항으로 올린다.

### B-14. Supabase·rollback 설계 정합화

- `data_lineage`의 스키마를 `private`로 통일하고 모든 FK를 `private.data_lineage(id)`로 명시한다. 공개 화면에는 승인된 최소 메타데이터 view만 제공한다.
- `substitute_pairs.match_type`는 실제 식품쌍 CSV 필드가 아니므로 별도 매칭 산출물과의 관계로 재설계한다.
- rollback의 `RLS 비활성화`, 일반화된 `DROP TABLE`, `git reset`을 제거한다. 정확한 객체별 권한 복구·이전 migration 적용·revert 또는 수정 커밋 절차로 쓴다.
- PostgreSQL 권한 회수는 `public.*` 같은 모호한 표현 대신 정확한 테이블·뷰 또는 스키마 기본권한 문법으로 작성한다.
- migration 파일 작성은 G3 승인 후 로컬에서 가능하고, 신규 Supabase 원격 적용·적재만 별도 사용자 승인점으로 둔다.

### B-15. Next.js·화면상태 일관성

- 공개 Route Handler와 Server Component는 anon 키+RLS만 사용한다. `09-review-request.md`의 공개 API service-role 표현을 제거한다.
- `MatchTypeBadge`를 5개 실제 매칭방법으로 확장한다.
- 조건부 `/label-guide`는 승인자료 미제공 시 메뉴 비노출 및 직접 URL 404로 고정한다. `준비 중` 화면을 만들지 않는다.
- 조건 유지·상세 이동은 FG-FUN-035의 합격기준으로 설계하고 잘못된 FG-FUN-042 연결을 제거한다.

### B-16. 연락기능의 데이터 선행조건 명시

FG-FUN-059는 공개 수신 이메일이 있는 경우 mailto와 복사 대안을 요구하지만, 현재 원본 시설 데이터에는 email 컬럼이 없다. 현재 데이터로는 전화·홈페이지·문의문안 복사까지만 구현 가능하다. 공개 이메일의 승인된 별도 소스가 확인될 때만 수신자 포함 mailto를 활성화하고, 그렇지 않으면 변경통제 또는 조건부 합격기준을 사용자에게 요청한다.

### B-17. MoAI Stop 훅 설치 불일치 정리

`.claude/settings.json`은 `.claude/hooks/moai/handle-stop.sh`를 호출하고 해당 wrapper는 존재한다. 그러나 실행 중 MoAI가 호출한 `sync-phase-quality-gate.sh`, `handle-stop-goal.sh`는 저장소와 `.moai/manifest.json`에 없다. 비차단 오류라 9종 파일이 유실되지는 않았지만 품질게이트·목표상태 자동 동기화는 수행되지 않았다. 현재 설치 버전과 프로젝트 템플릿을 일치시키거나 존재하지 않는 보조 훅 참조를 제거한 뒤 stop 훅을 재실행한다.

## 3. Claude Code·MoAI 재작업 지시문

```text
G3-07 2차 보완을 수행해줘.

작업 루트:
D:\0. codex\웨이브앤바이브 프로젝트\0. foodground_official

먼저 다음 파일을 읽어:
1. .moai/project/reviews/G3-07-CODEX-REVIEW-v0.2.md
2. 05-checks/g3-07-current-requirements.json
3. DOC-07 v0.7, DOC-08 v0.5, DOC-09 v0.4의 연결 경로
4. .moai/design/chg-g4-002/ 9종

B-10~B-17을 모두 반영하되 앱 코드·migration 적용·데이터 적재·Supabase·Vercel·commit·push는 변경하지 마.
특히 06 추적표의 60건을 정식 요구사항명과 의미로 재작성하고, 공동제조 FG-FUN-032~035의 조건입력·후보순위·일치/미충족 근거·상세연결을 복원해.
product_types는 원천·파생 가능성을 읽기 전용으로 확인하기 전 가정하지 말고 미결정사항으로 관리해.

마지막에 아래 명령을 실행해 PASS를 확인하고 중단해:
node 05-checks/validate-g3-07.mjs --mode=final
```

## 4. 승인조건

- 강화 검증 PASS
- B-10~B-17의 문서별 반영 위치가 `09-review-request.md`에 요약됨
- 공동제조 핵심흐름과 데이터 선행조건이 사용자 승인 가능한 형태로 제시됨
- MoAI stop 훅 오류의 원인과 조치결과가 기록됨
- 앱 코드·원격환경·데이터·배포·Git 이력이 변경되지 않음

위 조건을 충족하기 전에는 G3-07, G3-GATE, VS-1을 완료로 표시하지 않는다.
