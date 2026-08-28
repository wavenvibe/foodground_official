---
description: 승인된 CHG-G4-002 설계의 현재 vertical slice 하나만 구현합니다.
---

먼저 `.moai/design/chg-g4-002/09-review-request.md`의 사용자 승인기록과 `.moai/project/current-slice.md`의 구현 VS를 확인하세요. 둘 중 하나라도 없으면 구현하지 말고 중단사유를 보고하세요.

승인된 현재 VS 하나만 `/moai:run` 방식으로 수행합니다. UI·데이터·상태·시험·요구사항 추적을 함께 완료하며, 다음 VS로 자동 이동하지 않습니다. 원격 migration·적재·배포·commit·push는 사용자 명시 승인 없이는 실행하지 않습니다.
