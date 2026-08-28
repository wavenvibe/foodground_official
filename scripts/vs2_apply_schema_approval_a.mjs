/**
 * VS-2 승인점 A — 스키마 생성 실행기
 * 대상: glczrbadvfgmblmkpgfj (Mumbai / ap-south-1)
 * 실행 범위: DDL + RLS + staging 테이블만 (데이터 적재 없음)
 * 사용: node scripts/vs2_apply_schema_approval_a.mjs
 *
 * 환경변수:
 *   SUPABASE_DB_URL  — postgresql://postgres.glczrbadvfgmblmkpgfj:[PW]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
 *
 * 안전 경계:
 *   - INSERT/UPDATE/DELETE 없음
 *   - 데이터 적재 없음 (승인점 B는 별도)
 *   - RLS GRANT SELECT만 (데이터 공개는 승인점 C)
 */

import { readFile } from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// VS-2 승인점 A 실행 순서 (rollback 제외)
const MIGRATIONS = [
  "supabase/migrations/20260825001000_0020_vs2_init_schemas.sql",
  "supabase/migrations/20260825002000_0021_vs2_standard_foods.sql",
  "supabase/migrations/20260825003000_0022_vs2_substitute_pairs.sql",
  "supabase/migrations/20260825004000_0023_vs2_ingredient_name_match.sql",
  "supabase/migrations/20260825004500_0024_vs2_recipes.sql",
  "supabase/migrations/20260825005000_0025_vs2_facilities_v2.sql",
  "supabase/migrations/20260825005200_0025b_vs2_facilities_col_acl.sql",
  "supabase/migrations/20260825006000_0026_vs2_ingredients.sql",
  "supabase/migrations/20260825007000_0027_vs2_recipe_ingredients.sql",
];

// 검증 쿼리 목록 (승인점 A 결과 확인용)
const VERIFICATION_QUERIES = [
  {
    label: "private schema exists",
    sql: "SELECT schema_name FROM information_schema.schemata WHERE schema_name='private'",
    expect: (rows) => rows.length === 1,
  },
  {
    label: "staging schema exists",
    sql: "SELECT schema_name FROM information_schema.schemata WHERE schema_name='staging'",
    expect: (rows) => rows.length === 1,
  },
  {
    label: "anon cannot access private schema",
    sql: "SELECT has_schema_privilege('anon', 'private', 'USAGE') AS can_use",
    expect: (rows) => rows[0]?.can_use === false,
  },
  {
    label: "anon cannot access staging schema",
    sql: "SELECT has_schema_privilege('anon', 'staging', 'USAGE') AS can_use",
    expect: (rows) => rows[0]?.can_use === false,
  },
  {
    label: "private.data_lineage exists",
    sql: "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema='private' AND table_name='data_lineage'",
    expect: (rows) => Number(rows[0]?.c) === 1,
  },
  {
    label: "public.data_lineage_public view exists",
    sql: "SELECT COUNT(*) AS c FROM information_schema.views WHERE table_schema='public' AND table_name='data_lineage_public'",
    expect: (rows) => Number(rows[0]?.c) === 1,
  },
  {
    label: "public tables exist (7 tables)",
    sql: `SELECT table_name FROM information_schema.tables
          WHERE table_schema='public' AND table_type='BASE TABLE'
          AND table_name IN ('standard_foods','substitute_pairs','ingredient_name_match','recipes','facilities','ingredients','recipe_ingredients')
          ORDER BY table_name`,
    expect: (rows) => rows.length === 7,
  },
  {
    label: "staging tables exist (7 tables)",
    sql: `SELECT table_name FROM information_schema.tables
          WHERE table_schema='staging' AND table_type='BASE TABLE'
          ORDER BY table_name`,
    expect: (rows) => rows.length >= 7,
  },
  {
    label: "RLS enabled on all public tables",
    sql: `SELECT relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=true
          ORDER BY relname`,
    expect: (rows) => rows.length === 7,
  },
  {
    label: "facilities: approved columns only for anon",
    sql: `SELECT column_name FROM information_schema.column_privileges
          WHERE table_schema='public' AND table_name='facilities'
            AND grantee='anon' AND privilege_type='SELECT'
          ORDER BY column_name`,
    expect: (rows) => {
      const cols = rows.map((r) => r.column_name).sort();
      const approved = [
        "business_type","created_at","homepage","ingest_run_id",
        "is_haccp","mgt_no","name","region_sigungu","region_sido","status","tel",
      ].sort();
      return JSON.stringify(cols) === JSON.stringify(approved);
    },
  },
];

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("\n❌ SUPABASE_DB_URL 환경변수가 없습니다.");
    console.error("   Set: SUPABASE_DB_URL=postgresql://postgres.glczrbadvfgmblmkpgfj:[PW]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres");
    process.exit(1);
  }

  // Guard: 올바른 프로젝트만 허용
  if (!dbUrl.includes("glczrbadvfgmblmkpgfj")) {
    console.error("❌ DB URL이 승인된 프로젝트(glczrbadvfgmblmkpgfj)가 아닙니다. 중단.");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log("✅ Supabase glczrbadvfgmblmkpgfj 연결 성공");

    // 현재 DB 상태 pre-check
    const preCheck = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    console.log(`\n현재 public 테이블 수: ${preCheck.rows.length}개`);
    if (preCheck.rows.length > 0) {
      console.log("  기존 테이블:", preCheck.rows.map((r) => r.table_name).join(", "));
    }

    // Migration 실행
    console.log("\n--- 스키마 생성 시작 ---");
    for (const relPath of MIGRATIONS) {
      const absPath = path.join(ROOT, relPath);
      const sql = await readFile(absPath, "utf-8");
      const shortName = path.basename(relPath);
      process.stdout.write(`  ${shortName} ... `);
      await client.query(sql);
      console.log("OK");
    }
    console.log("--- 스키마 생성 완료 ---\n");

    // 검증 실행
    console.log("--- 승인점 A 검증 ---");
    let passCount = 0;
    let failCount = 0;
    for (const v of VERIFICATION_QUERIES) {
      const result = await client.query(v.sql);
      const pass = v.expect(result.rows);
      const mark = pass ? "✅" : "❌";
      console.log(`  ${mark} ${v.label}`);
      if (!pass) {
        console.log(`     rows: ${JSON.stringify(result.rows)}`);
        failCount++;
      } else {
        passCount++;
      }
    }
    console.log(`\n결과: ${passCount}/${VERIFICATION_QUERIES.length} 통과, ${failCount} 실패`);

    if (failCount === 0) {
      console.log("\n✅ 승인점 A 통과 — 데이터는 아직 없음. 승인점 B(적재)는 별도 지시 후 실행.");
    } else {
      console.log("\n❌ 일부 검증 실패 — 위 오류를 확인하고 재실행하거나 rollback을 검토하세요.");
      process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ 오류:", err.message);
    if (err.position || err.detail) {
      console.error("   detail:", err.detail);
      console.error("   hint:", err.hint);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
