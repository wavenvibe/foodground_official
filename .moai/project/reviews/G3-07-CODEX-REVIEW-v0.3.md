# G3-07 Codex 독립검토 v0.3

- 검토일: 2026-08-25
- 대상: B-10~B-17 반영본 상세설계 9종
- 권위문서: DOC-07 v0.7, DOC-08 v0.5, DOC-09 v0.4, ADM-08 v0.5
- 판정: **미승인 — validator PASS 재현 후 의미·스키마 잔여오류 확인**
- 원격·앱 변경: 없음

## 1. 독립검증 결과

Claude Code가 보고한 기존 검증 결과는 재현됐다.

```text
G3-07 final validation: PASS (9 files)
```

그러나 기존 검증은 정식 요구사항명의 존재를 확인할 뿐, 같은 행의 화면·API·데이터·합격기준과 문서 간 스키마 모순을 충분히 검사하지 못했다. 아래 잔여오류를 검증기에 추가한 뒤 결과는 FAIL이어야 정상이다.

## 2. 잔여 차단사항

### B-18. 보류 요구사항의 허위 의미 연결이 남아 있음

실제 DOC-07 의미는 다음과 같다.

- FG-FUN-031: 후보 저장·재조회
- FG-FUN-042: 데이터·서비스 상태 조회
- FG-FUN-044: 기존 배치 알림
- FG-FUN-060: 게시물·문의 처리현황

현재 01·02·03·06·09는 이 ID를 무후보, 대체→시설 연동, 후보 일치·배제근거로 계속 설명한다. ID를 단순히 보류로 표시하는 것과 의미를 올바르게 표시하는 것은 별개다. 허위 설명을 전부 제거하고, 필요하면 위 정식명으로만 기록한다.

또한 보류는 총 46건이며 위 4건도 그 46건에 포함된다. `46건 + 추가 4건`으로 계산하지 않는다.

### B-19. 공동제조 추적과 슬라이스 범위가 다시 어긋남

- FG-FUN-034는 공동제조 후보 결과에서 조건별 일치·미충족 근거와 출처를 보여야 한다. 보류 FG-FUN-044·060과 혼합하지 않는다.
- FG-FUN-035는 공동제조 후보→동일 시설 상세 이동과 뒤로가기 조건 유지다. `/substitutes → /facilities/[id]`가 아니다.
- `FG-FUN-001~011` 범위 표기는 보류 FG-FUN-006·007을 다시 포함한다. `001~005·008~012`처럼 현재범위만 명시한다.
- FG-FUN-012 안정적 페이지네이션은 시설 연락 VS가 아니라 모든 대량목록 구현에 연결한다.
- 08의 `FG-DAT-002`, `FG-AUD-*`, `FG-INF-*`, `FG-RESP-*`는 DOC-07 요구사항 ID가 아니다. 내부 작업 ID라면 별도 네임스페이스로 정의하고 요구사항 ID로 표기하지 않는다.

### B-20. 대체 식재료 데이터 모델이 실제 산출물 구조와 다름

읽기 전용 확인 결과는 다음과 같다.

- `food_pair_similarities.csv`: 기준식품ID·후보식품ID·6개 지표·계산가능 유사도 수
- `ingredient_matching.csv`: 입력 재료명·표준재료·신뢰도·매칭방법
- `food_master.csv` 및 영양 파일: 식품 기본정보·영양값

따라서 `match_type`은 식품쌍의 NOT NULL 컬럼이 아니다. 입력명 해석 계층을 별도 테이블/DTO로 두고, 식품쌍 및 영양 마스터와 join 키를 명확히 정의해야 한다.

추가 수정사항:

- `ORDER BY score_final DESC, facility_id ASC`의 `facility_id`를 제거하고 후보식품 안정키를 사용한다.
- 실제 `weighted_score()`처럼 행별 유효 지표의 가중치 합으로 재정규화하는 결측 규칙을 명시한다.
- 1단계 0.60/0.15/0.15/0.10과 2단계 0.70/0.20/0.10은 이미 코드에서 확인된 기본값이다. 다시 헤더 확인 대상으로 돌리거나 두 단계 비율을 혼동하지 않는다.
- `MatchTypeBadge`를 exact/substring 2종이 아니라 exact/substring/fuzzy/synonym/none 상태로 설계한다.

### B-21. Supabase 논리 스키마가 내부적으로 실행 불가능하거나 불완전함

- public 목록에는 `data_lineage`라고 쓰고 DDL은 `private.data_lineage`를 만든다.
- FK가 `REFERENCES data_lineage(id)`로 무자격 참조돼 private 테이블과 연결되지 않는다.
- `private` 스키마 생성·권한 설계가 없다.
- `product_types`는 Q-06 미결정인데 facilities DDL·UPSERT·UI에서 확정 컬럼으로 사용한다.
- recipes·ingredients·standard_foods·입력명 매칭·영양 데이터의 실제 DDL과 관계가 없다.
- public 직접 테이블에는 `ingest_run_id`가 있어 RLS만으로 컬럼 최소화를 보장할 수 없다. 승인 필드 전용 public view 또는 private 원본/public view 구조가 필요하다.

Q-06은 원본 `facility`에는 없지만 기존 스키마상 `production_log.category`를 `facility_mgt_no`로 집계하는 파생 가능성이 있다. 다만 실제 참조율·중복·결측과 제품 전건이관 보류 범위를 확인해야 하므로, VS-1에서 읽기 전용 집계 후 다음 중 하나를 사용자에게 제시한다.

1. 승인된 파생 요약만 이관해 product_types 필터 유지
2. 파생 품질이 낮으면 business_type·지역·HACCP·상태 기반 매칭으로 축소

### B-22. 공개 권한·rollback·승인 경계가 다시 모순됨

- 04·05는 공개 런타임 anon+RLS를 정했지만 09는 `service-role 보호`를 권고한다. 공개 Route Handler는 anon+RLS로 통일한다.
- `REVOKE SELECT ON public.* FROM anon`은 정확한 객체 문법이 아니다. 04의 개별 객체 REVOKE와 일치시킨다.
- 08·09의 일반 `DROP TABLE` rollback을 객체·단계·백업 기준으로 구체화한다.
- G3 승인 후 로컬 migration 파일 작성은 가능하며 사용자 별도 승인은 신규 Supabase 원격 적용·적재·공개권한 변경에 필요하다. 04의 migration 파일 작성 금지 문구를 수정한다.

### B-23. FG-FUN-059는 변경통제 없이 축소됨

DOC-07 v0.7의 FG-FUN-059 합격기준은 공개 수신 이메일이 있는 경우 mailto 초안을 열고, 미지원 시 복사 대안을 제공하는 것이다. 현재 데이터에 email이 없다는 사실은 확인됐지만, 이를 이유로 Must 요구사항을 복사 전용으로 자동 변경할 수 없다.

다음 중 하나를 사용자 승인사항으로 제시한다.

1. 별도 승인 이메일 소스 확보 시 mailto 활성화, 그 전까지 조건부 미충족으로 관리
2. ADM-08 및 DOC-07 새 리비전에서 ContactButton 복사·tel·homepage를 현재 합격기준으로 변경

`사용자 확인 불필요` 문구는 삭제한다.

### B-24. Stop 훅은 아직 조치되지 않음

이번 실행에서도 동일한 두 파일 미존재 오류가 반복됐다. R-11에 기록한 것은 조치가 아니다. 9종 파일은 보존됐으므로 설계 내용 검토와는 분리할 수 있지만, VS-1 착수 전에는 설치 버전·전역/프로젝트 훅 출처를 확인하고 정상 종료 smoke test를 통과해야 한다. 빈 stub 파일을 만들어 오류만 숨기지 않는다.

## 3. 재작업 지시문

```text
G3-07 3차 보완을 수행해줘.

작업 루트:
D:\0. codex\웨이브앤바이브 프로젝트\0. foodground_official

먼저 아래를 읽어:
1. .moai/project/reviews/G3-07-CODEX-REVIEW-v0.3.md
2. 05-checks/g3-07-current-requirements.json
3. DOC-07 v0.7
4. .moai/design/chg-g4-002/ 9종

B-18~B-24를 반영해. 앱 코드·원격 Supabase·데이터 적재·Vercel·commit·push는 변경하지 마.
실제 산출물은 식품쌍, 입력 재료명 매칭, 식품/영양 마스터로 분리해 설계하고, 공동제조와 대체 식재료 흐름의 요구사항 ID를 혼합하지 마.
product_types와 FG-FUN-059는 임의 확정하지 말고 사용자 승인 선택지로 남겨.
Stop 훅은 빈 파일로 우회하지 말고 실제 호출 출처와 설치 버전을 진단해.

마지막에 다음을 실행하고 PASS 후 중단해:
node 05-checks/validate-g3-07.mjs --mode=final
```

## 4. 승인조건

- 강화 validator PASS
- B-18~B-24 전부 반영
- Q-06 product_types와 FG-FUN-059에 대한 사용자 선택지가 09에 명확히 제시됨
- 공개 런타임 anon+RLS, private lineage, rollback 문서가 서로 동일함
- Stop 훅 정상 종료 또는 VS-1 전 조치가 명확한 차단조건으로 등록됨
- 앱·원격 DB·배포·Git 원격 변경 0건

위 조건 전에는 G3-07·G3-GATE를 완료로 표시하거나 VS-1을 시작하지 않는다.
