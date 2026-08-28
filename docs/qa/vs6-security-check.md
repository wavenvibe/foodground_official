# VS-6 보안 체크

Date: 2026-08-28
Branch: codex/g1-baseline

---

## 체크 목록

| 항목 | 결과 | 비고 |
|------|------|------|
| `.env.local` git tracked 여부 | ✅ 미추적 | `git ls-files .env.local` → 빈 결과 |
| Service role key 소스코드 노출 | ✅ 없음 | grep 결과 없음 |
| 구 Supabase ref(kxovymfrfyvtarrqxpyj) 소스 내 참조 | ✅ 없음 | grep 결과 없음 |
| 구 Vercel/레거시 저장소 write ref | ✅ 없음 | |
| 신 Supabase ref 정상 설정 | ✅ glczrbadvfgmblmkpgfj | .env.local 기준 |
| homepage 링크 http/https only 검증 | ✅ `safeHomepage()` 로직 적용 | `app/facilities/[id]/page.tsx` |
| API: 비공개 컬럼(road_addr, coord_x, coord_y, suspension_count) 누출 | ✅ 없음 | E2E 검증 통과 |
| API: 한글 mgt_no → 400 + FG_BAD_REQUEST | ✅ | E2E 검증 통과 |
| API: service_role 키 브라우저 번들 포함 | ✅ 없음 | server-only 파일에서만 사용 |
| XSS: substitutes?ingredient=`<script>` | ✅ 200 렌더링, 스크립트 미실행 | E2E 검증 통과 |
| SQL injection 위험: 입력 PostgREST ilike 처리 | ✅ 길이 제한 + parameterized | lib/facilities.ts 검토 |

## npm audit

```
8 vulnerabilities (1 low, 7 high)
```

### ws@8.20.0 — High (GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p)

**의존성 체인**: ws@8.20.0 ← @supabase/realtime-js@2.104.1 ← @supabase/supabase-js@2.104.1 ← root project

**런타임 포함 여부**: `.next/server/chunks/node_modules_@supabase_supabase-js_dist_index_mjs_0hp37pu._.js` 에 포함 확인 (WebSocket/RealtimeClient 참조 7건). ws는 **런타임 서버 번들에 포함됨**.

**실제 악용 가능성**: ws는 이 앱에서 Supabase 서버로의 **아웃바운드 WebSocket 클라이언트**로만 사용됨. 해당 CVE는 ws가 서버로서 외부 HTTP 헤더를 수신할 때 발동하는 취약점으로, 클라이언트 용도에서는 직접 공격 경로 없음. `createPublicServerClient()` 는 auth/realtime 비활성화 설정 사용; 실제 WebSocket 연결이 수립되지 않음.

**수정 가능성**: `npm audit fix` (--force 불필요) 로 ws ≥ 8.20.2 업그레이드 가능. @supabase/realtime-js의 semver 범위(^8.18.2) 내에서 해소됨.

**조치**: `npm audit fix` 미실행 (금지 사항 준수). 위험 분류: 낮음 (실제 공격 경로 없음). 다음 릴리스 시 `npm audit fix` 실행 권장.

### next, postcss, sharp — High

수정 시 `npm audit fix --force` 필요 (next@16.3.3으로 강제 업그레이드, 명시된 범위 외). 현재 스냅샷에서 수정 보류.

### brace-expansion, js-yaml, nanoid (@babel/core 경유), @babel/core — High/Low

`npm audit fix` (--force 불필요) 로 수정 가능. 현재 스냅샷에서 수정 보류.

## git diff --check

- LF→CRLF 변환 경고 18개 — Windows 기본 line ending 차이로 인한 경고. 코드 무결성 영향 없음.
- 실제 trailing whitespace 오류: **0개**.

## 스크린샷·로그 내 키 노출

- Playwright 스크린샷(`output/playwright/`) — URL만 표시, 환경변수·토큰 미포함.
- 콘솔 에러 0개(favicon 제외) — 서버 사이드 에러 스택 브라우저 미노출 확인.
