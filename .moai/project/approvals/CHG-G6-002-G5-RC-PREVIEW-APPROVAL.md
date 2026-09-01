# CHG-G6-002 G5 단일 RC Preview 방향 승인 기록

- 변경 ID: `CHG-G6-002`
- 승인일: 2026-09-01
- 승인자: 발주자(사용자대표)
- 승인 근거: 대화에서 사용자가 단일 RC Preview 확인 후 `승인해 진행해줘`라고 명시

## 승인 범위

- PR #3 단일 RC Preview 방향을 승인한다.
- 현재 RC를 기준으로 자동 QA, 사용자 QA 목록 정비, 복구 준비도 점검과 증빙 문서 갱신을 진행한다.
- 로컬 읽기·시험·문서 작업을 허용한다.

## 승인에서 제외되는 사항

- DOC-13 사용자 QA 54건의 발주자 합격 판정
- 실제 격리 복구 성공 및 RPO·RTO 달성 판정
- PR #3 merge 또는 `main` 변경
- Vercel Production 배포·별칭·환경변수 변경
- Supabase DDL·DML·migration·restore
- G5 RELEASE-GATE 또는 G6 최종 인수

## 판정

`RC_PREVIEW_DIRECTION_APPROVED / FOLLOWUP_VERIFICATION_AUTHORIZED / MERGE_AND_PRODUCTION_NOT_AUTHORIZED`
