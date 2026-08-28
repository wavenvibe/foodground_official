# VS-6 로컬 성능 진단

Date: 2026-08-28
Branch: codex/g1-baseline
환경: `next build` → `next start --port 3001` (로컬, Windows 11)
방법: 엔드포인트별 curl 10회 측정 후 중앙값·p95 산출

> **주의**: 이 수치는 로컬 개발 환경(LAN loopback, HDD I/O 포함) 기준 참고 진단입니다.
> TIPS 성과 지표가 아니며, Vercel 프로덕션 성능과 직접 비교할 수 없습니다.

---

## 측정 결과 (10회, curl time_total 기준)

| 엔드포인트 | 중앙값(p50) | p95 | 비고 |
|-----------|------------|-----|------|
| `/` | 0.014s | 1.387s | 정적 shell + 서버 워밍업 |
| `/recipes` | 0.313s | 1.335s | Supabase 조회 포함 |
| `/ingredients` | 0.226s | 0.547s | Supabase 조회 포함 |
| `/substitutes?ingredient=가시오갈피` | 0.813s | 1.109s | 유사도 계산 포함 |
| `/facilities` | 0.376s | 1.724s | 30,257건 기본 뷰 |
| `/api/facilities?pageSize=10` | 0.330s | 0.377s | API 전용 |
| `/api/substitutes?ingredient=가시오갈피` | 0.833s | 0.873s | 유사도 API |

### 관찰사항

- p95가 p50 대비 크게 높은 엔드포인트: `/`, `/facilities` — 로컬 cold-start 및 Supabase 연결 지연 영향.
- `/substitutes` 중앙값 ~0.8초: 유사도 벡터 조회가 Supabase 왕복 1회로 처리되며 허용 범위 내.
- API 레이어(`/api/facilities`) p95 0.38초: Next.js Route Handler 오버헤드 최소.

### 프로덕션 참고

- 본 진단은 배포 전 회귀 baseline 확인 목적이며, SLA 보장 지표가 아님.
- Vercel 프로덕션 성능은 배포 후 실측치를 기준으로 별도 평가해야 함.

---

## 측정 환경

- OS: Windows 11 Pro 10.0.26200
- Node.js: LTS (PATH: /c/Program Files/nodejs)
- Next.js: 16.2.4
- Supabase region: ap-south-1, South Asia (Mumbai) — 로컬 .env.local 기준 (glczrbadvfgmblmkpgfj)
- 서버 포트: 3001 (dev 서버 3000과 분리)
