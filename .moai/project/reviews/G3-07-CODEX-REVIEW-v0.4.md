# G3-07 Codex 4차 독립검토

- 검토일: 2026-08-25
- 대상: `.moai/design/chg-g4-002/` 상세설계 9종 B-18~B-24 반영본
- 자동검증 재현: 기존 validator `PASS (9 files)`
- 최종판정: **보완 후 승인 — G3-GATE 및 VS-1 진입 보류**

## 1. 반영 확인

B-18~B-23의 주요 수정은 실제 파일에서 확인했다. 보류 요구사항의 정식명, 공동제조 FG-FUN-032~035 흐름, 식품쌍 정렬·가중치·조인 계약, `private.data_lineage`, 공개 anon+RLS 경계, 로컬 migration 작성 가능 범위와 FG-FUN-059 선택지는 이전본보다 명확해졌다.

다만 validator 통과가 설계 승인과 동일하지는 않다. 아래 다섯 항목은 보고된 완료 내용과 실제 파일이 일치하지 않거나 구현 계약이 아직 닫히지 않았다.

## 2. 잔여 차단사항

### B-25. 비표준 요구사항 ID와 슬라이스 중복 제거

- `08-implementation-slices.md`에 DOC-07 요구사항이 아닌 `FG-AUD-001`, `FG-INF-001~003`이 여전히 **요구사항 ID**로 남아 있다.
- FG-FUN-012는 모든 대량 목록의 페이지네이션이므로 VS-3에만 배정하고 시설 연락 VS-5에서 제거한다.
- 감사·인프라 작업은 `WORK-VS1-AUDIT`, `WORK-VS2-INFRA`처럼 요구사항과 구분되는 내부 작업 ID로 표기하거나 ID 없이 선행작업으로 관리한다.

### B-26. 공개 데이터 5종의 완전한 논리 스키마 작성

`04-supabase-schema-migration-rls.md`는 5개 공개 테이블을 선언하지만 실제 컬럼·키·인덱스 계약은 `facilities`와 `substitute_pairs`만 있다. 구현 전 다음 객체의 DDL 의사코드와 원천 필드 매핑을 추가한다.

- `recipes`: 안정 식별자, 명칭, 재료 연결 방식, 공개 필드, 검색·정렬키
- `ingredients`: 안정 식별자, 명칭, 영양·단위 연결키, 검색·정렬키
- `standard_foods`: 표준 식품 ID와 영양 필드·단위
- 입력명 매칭 계약: `ingredient_matching.csv`의 입력명·기준식품ID·`match_type`을 보존할 객체 또는 조회계약

RLS·staging·UPSERT·rollback도 위 객체에 같은 수준으로 연결한다. 원천 감사 전 확정할 수 없는 컬럼은 `UNKNOWN`과 VS-1 확정조건을 명시한다.

### B-27. `product_types` 미결정 상태의 전 문서 일관성 확보

`04`와 `07`은 Q-06을 미결정으로 두었지만 `02`, `03`, `05`는 `product_types`를 필수 필터·공개 필드·URL 계약으로 확정했다. 세 문서의 모든 사용처를 다음처럼 조건부로 바꾼다.

- VS-1에서 승인 원천·`mgt_no` 참조율·중복·결측을 확인한 경우에만 활성화한다.
- 파생 불가 시 공동제조 기본 필터는 `business_type`, 지역, HACCP, 영업상태로 동작한다.
- 미확정 컬럼을 API 응답·UI 필수 필드로 요구하지 않는다.

### B-28. FG-FUN-059 선택지의 변경통제 논리 수정

현재 DOC-07 v0.7은 이메일이 존재하는 경우 브라우저 메일초안을 요구한다. 따라서 승인된 이메일 소스가 확보되면 기존 요구사항대로 구현하며 DOC-07 변경이 필요하지 않다. 반대로 이메일 소스 없이 복사 전용으로 확정할 때만 ADM-08 변경등록과 DOC-07 새 리비전이 필요하다.

- `06`의 “승인된 이메일 소스 확보 또는 DOC-07 변경통제 완료 시 mailto” 문구를 두 갈래 합격기준으로 분리한다.
- `09` 선택 1의 “소스 확보 후 DOC-07 변경통제”를 삭제한다.
- 선택 2에는 복사 전용 확정 시 ADM-08 등록·DOC-07 새 리비전 필요를 명시한다.

### B-29. Stop 훅 설치·전역설정 불일치 복구

오류 원인은 설계 문서가 아니라 전역 Claude 설정과 프로젝트 MoAI 설치의 불일치다. `C:/Users/rlove/.claude/settings.json`의 Stop 훅은 다음 두 파일을 모든 프로젝트에서 호출하지만 현재 저장소에는 없다.

- `.claude/hooks/moai/sync-phase-quality-gate.sh`
- `.claude/hooks/moai/handle-stop-goal.sh`

빈 성공 스크립트를 만들지 않는다. 사용 중인 MoAI 버전의 정식 훅을 재설치하거나, 해당 훅이 전역 적용 대상이 아니라면 전역 Stop 등록을 제거한다. 전역 설정은 다른 프로젝트에도 영향을 주므로 사용자 승인 없이 Codex가 수정하지 않는다. 수정 후 정상 종료 1회와 두 동기화 기능의 실제 실행 로그를 증빙한다.

## 3. 재검토 합격조건

- 강화 validator가 `PASS (9 files)`
- `FG-AUD-*`, `FG-INF-*`가 요구사항 ID로 남지 않음
- 공개 데이터 5종과 입력명 매칭의 키·필드·RLS·적재 계약이 구현 가능한 수준으로 연결됨
- Q-06 미결정 중에는 `product_types`가 필수 API·UI 계약으로 사용되지 않음
- FG-FUN-059의 “소스 확보”와 “복사 전용 변경” 분기가 정확함
- Stop 훅 오류 없이 Claude Code가 정상 종료되고 품질게이트·목표상태 동기화 증빙이 남음

## 4. Claude Code·MoAI 재작업 지시문

```text
G3-07 Codex 4차 독립검토 B-25~B-29를 반영해.
검토서: .moai/project/reviews/G3-07-CODEX-REVIEW-v0.4.md

특히 08의 FG-AUD/FG-INF 요구사항 ID와 VS-5 FG-FUN-012를 제거하고,
04에 recipes·ingredients·standard_foods·입력명 매칭 객체의 구현 가능한 논리 스키마를 추가해.
product_types는 Q-06 해소 전까지 02·03·05 전체에서 조건부로 표시하고 파생 불가 fallback을 명시해.
FG-FUN-059는 이메일 소스 확보 시 기존 요구 구현, 복사 전용 확정 시에만 ADM-08·DOC-07 새 리비전이 필요하도록 고쳐.

Stop 훅은 빈 스텁으로 우회하지 말고 현재 Claude/MoAI 버전의 정식 설치 또는 전역 설정 정합화로 복구해.
전역 설정 변경은 사용자 승인을 먼저 받아.

node 05-checks/validate-g3-07.mjs --mode=final을 실행하고 PASS 및 Stop 훅 정상종료를 함께 보고한 뒤 중단해.
앱 코드, 원격 Supabase, 데이터 적재, Vercel, commit, push는 변경하지 마.
```
