---
description: 푸드그라운드 G3 상세설계를 MoAI로 수행하고 구현 전 승인자료를 작성
argument-hint: "[추가 설계 요청]"
allowed-tools: Read, Write, Edit, Glob, Grep, Skill, Bash(git status:*), Bash(git diff:*)
---

1. `AGENTS.md`와 `.moai/project/current-slice.md`를 읽는다.
2. `.moai/project/work-orders/G3-DESIGN.md`의 읽기 순서와 역할 경계를 그대로 따른다.
3. 현재 working tree의 미커밋 VS-1A 코드는 동결된 참고초안으로만 읽고 수정하지 않는다.
4. MoAI의 code-based design 경로를 사용한다.

Use Skill("moai") with arguments: design --path B --harness thorough

5. `$ARGUMENTS`가 있으면 고정조건을 위반하지 않는 범위에서 설계 요구에 반영한다.
6. 필수 산출물 9종을 `.moai/design/foodground-g3/`에 작성한다.
7. 필요하면 정적 프로토타입만 `docs/design/claude-g3/`에 작성한다.
8. `app/`, `components/`, `lib/`, `supabase/migrations/`를 수정하지 않는다.
9. commit, push, deploy, 원격 Supabase 변경을 하지 않는다.
10. 결과와 미결정사항, 사용자 승인항목을 보고하고 멈춘다. `/moai:run`을 실행하지 않는다.
