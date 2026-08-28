# G3-07 design workspace

이 폴더의 9개 문서는 Claude Code + MoAI가 실제 소스·데이터·최신 요구사항을 감사하여 완성하는 상세설계 산출물이다.

- 현재 상태: `TEMPLATE - CLAUDE FILL REQUIRED`
- 권위 작업지시서: `.moai/project/work-orders/CHG-G4-002-SUBSTITUTE-INTEGRATION-v0.3.md`
- 템플릿 검사: `node 05-checks/validate-g3-07.mjs --mode=template`
- 완료 검사: `node 05-checks/validate-g3-07.mjs --mode=final`

Claude는 확인한 사실에 근거해 모든 `TODO(G3-07)`을 제거하고 각 파일의 상태를 `Status: REVIEW READY`로 변경한다. 확인할 수 없는 항목은 추정하지 않고 `UNKNOWN` 및 사용자 미결정사항으로 남긴다.

설계 승인 전 애플리케이션 코드, SQL migration, 데이터 적재, 원격 Supabase, Vercel, commit, push를 변경하지 않는다.
