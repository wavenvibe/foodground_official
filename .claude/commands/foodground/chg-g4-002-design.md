---
description: CHG-G4-002 대체 식재료 추천 웹 이식의 MoAI 상세설계를 수행하고 승인 요청에서 멈춥니다.
---

`AGENTS.md`의 필수 읽기 순서를 따르고 `.moai/project/work-orders/CHG-G4-002-SUBSTITUTE-INTEGRATION-v0.3.md`의 G3 설계 단계만 수행하세요.

필수 동작:

1. 기존 working tree를 감사하고 보존합니다.
2. 기존 분석 폴더는 읽기 전용으로만 감사합니다.
3. 최신 DOC-07 v0.7·DOC-08 v0.5·DOC-09 v0.4·DOC-04 v0.5·ADM-08 v0.5의 inspect 자료를 사용합니다.
4. `.moai/design/chg-g4-002/`의 템플릿 9종을 실제 조사결과로 완성합니다.
5. 현재 2천만원 범위와 후속 범위를 요구사항·화면·API·DB·시험 단위로 분리합니다.
6. `node 05-checks/validate-g3-07.mjs --mode=final`을 통과합니다.
7. `09-review-request.md`에 사용자 승인사항과 미결정사항을 정리한 뒤 멈춥니다.

애플리케이션 코드, migration, 데이터 적재, 원격 Supabase, Vercel, commit, push를 변경하지 마세요.
