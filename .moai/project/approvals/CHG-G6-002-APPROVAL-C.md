# CHG-G6-002 Approval C 게시·검증 완료 기록

## 승인 범위

- 대상: 공식 신규 Supabase `glczrbadvfgmblmkpgfj`
- 승인: migration 0036 적용 후 Approval C public 원자 게시 및 게시 후 검증
- 제외: Vercel, Git commit·push·PR·merge, 기존 Foodground·레거시 Supabase 변경

## 실행 결과

### Publish

- lineage marker 5건: `chg-g6-002-v1`
- 건수·PK·FK·매핑·비공개 열 제외: PASS
- RLS/ACL 및 `pg_policies` 경비: PASS
- 단일 트랜잭션 COMMIT: PASS

### Post-publish verify

| 대상 | 검증 건수 | 결과 |
|---|---:|---|
| `public.products_public` | 1,047,894 | PASS |
| `public.facility_products_public` VIEW | 815,989 | PASS |
| `public.haccp_certifications_public` | 308 | PASS |
| `public.facility_safety_public` | 103 | PASS |
| `public.manufacturing_profiles_public` | 265 | PASS |
| `private.company_profile_mapping` | 308 | PASS |

- PK uniqueness: PASS
- FK orphan: products 0, HACCP 0, safety 0, manufacturing 0
- VIEW consistency: PASS
- mapping: linked 265, ambiguous 4, unlinked 39
- private column exclusion: PASS
- 4개 public table RLS: PASS
- anon/authenticated effective ACL: public SELECT-only, staging/private USAGE 없음
- `pg_policies` 및 VIEW grant: PASS
- lineage: checkpoint 5건 → published lineage 5건, VIEW filter PASS
- anon Data API 독립 재검증: public 5종·lineage 5건 exact count PASS, private mapping HTTP 404 차단 PASS

## 판정

**APPROVAL_C_PUBLISH_PASS / APPROVAL_C_VERIFY_PASS**

Approval C를 완료했으며 publish를 재실행하지 않는다. 다음 원격 변경은 별도 승인 전에 실행하지 않는다.
