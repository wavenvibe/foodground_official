import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg?.split("=")[1] ?? "template";
if (!new Set(["template", "final"]).has(mode)) {
  console.error("Usage: node 05-checks/validate-g3-07.mjs --mode=template|final");
  process.exit(2);
}

const root = process.cwd();
const designDir = path.join(root, ".moai", "design", "chg-g4-002");
const expected = [
  "01-scope-and-source-audit.md",
  "02-user-flow-and-screen-states.md",
  "03-data-contract-and-lineage.md",
  "04-supabase-schema-migration-rls.md",
  "05-nextjs-component-api-design.md",
  "06-qa-acceptance-trace.md",
  "07-risks-decisions-open-items.md",
  "08-implementation-slices.md",
  "09-review-request.md",
];

const requiredByFile = {
  "01-scope-and-source-audit.md": ["69,406", "553,763", "234,955", "git status"],
  "02-user-flow-and-screen-states.md": ["390px", "1440px", "partial-match", "mailto"],
  "03-data-contract-and-lineage.md": ["70,165", "18,933", "94,723", "exact/substring"],
  "04-supabase-schema-migration-rls.md": ["glczrbadvfgmblmkpgfj", "rollback", "RLS"],
  "05-nextjs-component-api-design.md": ["Next.js 16", "Server/Client", "mailto"],
  "06-qa-acceptance-trace.md": ["승인 56건", "조건부 4건", "보류 46건", "390px"],
  "07-risks-decisions-open-items.md": ["52.85%", "UNKNOWN", "PENDING USER"],
  "08-implementation-slices.md": ["VS-1", "VS-2", "VS-3", "VS-4", "VS-5", "VS-6"],
  "09-review-request.md": ["Approval status: PENDING USER", "승인 체크", "Claude 중단 선언"],
};

const errors = [];
for (const filename of expected) {
  const filePath = path.join(designDir, filename);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing: ${filename}`);
    continue;
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const token of requiredByFile[filename]) {
    if (!text.includes(token)) errors.push(`${filename}: missing token: ${token}`);
  }
  if (mode === "template") {
    if (!text.includes("Status: TEMPLATE - CLAUDE FILL REQUIRED")) {
      errors.push(`${filename}: template status missing`);
    }
    if (!text.includes("TODO(G3-07)")) errors.push(`${filename}: TODO marker missing`);
  } else {
    if (!text.includes("Status: REVIEW READY")) errors.push(`${filename}: REVIEW READY missing`);
    if (text.includes("TODO(G3-07)")) errors.push(`${filename}: unresolved TODO`);
    if (text.includes("TEMPLATE - CLAUDE FILL REQUIRED")) errors.push(`${filename}: template status remains`);
  }
}

const forbiddenTargets = [
  "OCR migration",
  "LLM table",
  "1,047,894건 전건 이관을 현재범위",
  "과거 TIPS 점수 재달성",
];
for (const filename of expected) {
  const filePath = path.join(designDir, filename);
  if (!fs.existsSync(filePath)) continue;
  const text = fs.readFileSync(filePath, "utf8");
  for (const phrase of forbiddenTargets) {
    if (text.includes(phrase)) errors.push(`${filename}: forbidden phrase: ${phrase}`);
  }
}

if (mode === "final") {
  const tracePath = path.join(designDir, "06-qa-acceptance-trace.md");
  const traceText = fs.existsSync(tracePath) ? fs.readFileSync(tracePath, "utf8") : "";
  const requirementManifestPath = path.join(root, "05-checks", "g3-07-current-requirements.json");
  const currentRequirements = fs.existsSync(requirementManifestPath)
    ? JSON.parse(fs.readFileSync(requirementManifestPath, "utf8"))
    : [];
  if (currentRequirements.length !== 60) {
    errors.push(`current requirement manifest must contain 60 rows: ${currentRequirements.length}`);
  }
  const traceLines = traceText.split(/\r?\n/);
  for (const requirement of currentRequirements) {
    const requirementLines = traceLines.filter((line) => line.includes(requirement.id));
    if (!requirementLines.length) {
      errors.push(`06-qa-acceptance-trace.md: current requirement missing: ${requirement.id}`);
      continue;
    }
    if (!requirementLines.some((line) => line.includes(requirement.name))) {
      errors.push(
        `06-qa-acceptance-trace.md: requirement meaning mismatch: ${requirement.id} must be "${requirement.name}"`,
      );
    }
    if (!requirementLines.some((line) => line.includes(requirement.status))) {
      errors.push(
        `06-qa-acceptance-trace.md: requirement status mismatch: ${requirement.id} must be ${requirement.status}`,
      );
    }
  }

  const currentRequirementIds = new Set(currentRequirements.map(({ id }) => id));
  for (const line of traceLines) {
    const match = line.match(/\|\s*(FG-(?:FUN|DAT|SEC|NFR|OPS)-\d{3})\s*\|/);
    if (match && !currentRequirementIds.has(match[1]) && /\|\s*승인\s*\|/.test(line)) {
      errors.push(`06-qa-acceptance-trace.md: deferred requirement mislabeled approved: ${match[1]}`);
    }
  }

  const dataContractPath = path.join(designDir, "03-data-contract-and-lineage.md");
  const dataContractText = fs.existsSync(dataContractPath) ? fs.readFileSync(dataContractPath, "utf8") : "";
  for (const token of [
    "영양성분_유사도",
    "재료구분_유사도",
    "식품군_유사도",
    "조리상태_유사도",
    "요리종류_유사도",
    "동반재료_유사도",
    "완전일치",
    "포함일치",
    "철자유사",
    "동의어",
    "미매칭",
    "488",
    "11,764",
    "295",
    "35",
    "11,224",
    "기존 facility 원본에 email 컬럼 없음",
  ]) {
    if (!dataContractText.includes(token)) {
      errors.push(`03-data-contract-and-lineage.md: actual source contract missing: ${token}`);
    }
  }

  for (const inventedField of [
    "similarity_composition",
    "similarity_usage",
    "similarity_category",
    "similarity_allergen",
  ]) {
    if (dataContractText.includes(inventedField)) {
      errors.push(`03-data-contract-and-lineage.md: invented source field remains: ${inventedField}`);
    }
  }

  const supabasePath = path.join(designDir, "04-supabase-schema-migration-rls.md");
  const supabaseText = fs.existsSync(supabasePath) ? fs.readFileSync(supabasePath, "utf8") : "";
  for (const token of ["Healthy", "Mumbai", "mgt_no", "공개 조회에 service-role 사용 금지"]) {
    if (!supabaseText.includes(token)) {
      errors.push(`04-supabase-schema-migration-rls.md: approved safety fact missing: ${token}`);
    }
  }

  for (const filename of expected) {
    const filePath = path.join(designDir, filename);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    if (text.includes("DISABLE ROW LEVEL SECURITY")) {
      errors.push(`${filename}: unsafe RLS rollback remains`);
    }
    if (/52\.85%[^\n]{0,50}(정확 일치|exact)/i.test(text)) {
      errors.push(`${filename}: 52.85% mislabeled as exact-match rate`);
    }
    for (const phrase of [
      "score_overall",
      "ORDER BY score_overall",
      "public.data_lineage 테이블",
      "RLS 비활성화",
      "git reset",
    ]) {
      if (text.includes(phrase)) errors.push(`${filename}: stale or unsafe design phrase: ${phrase}`);
    }
    if (/public runtime[^\n]{0,100}service-role|service-role[^\n]{0,100}공개 런타임/i.test(text) &&
        !/사용 금지|미사용|포함 금지|절대 사용 금지/.test(text)) {
      errors.push(`${filename}: public runtime service-role wording is unsafe or contradictory`);
    }
  }

  const flowPath = path.join(designDir, "02-user-flow-and-screen-states.md");
  const flowText = fs.existsSync(flowPath) ? fs.readFileSync(flowPath, "utf8") : "";
  if (/\/label-guide[^\n]{0,80}준비 중/.test(flowText)) {
    errors.push("02-user-flow-and-screen-states.md: conditional label guide must be hidden/404, not 준비 중");
  }

  const falseDeferredMappings = [
    ["FG-FUN-042", "URL param"],
    ["FG-FUN-044", "조건 충족"],
    ["FG-FUN-060", "미충족 조건"],
  ];
  for (const filename of expected) {
    const filePath = path.join(designDir, filename);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const [id, falseMeaning] of falseDeferredMappings) {
      const pattern = new RegExp(`${id}[^\\n]{0,80}${falseMeaning}|${falseMeaning}[^\\n]{0,80}${id}`);
      if (pattern.test(text)) {
        errors.push(`${filename}: false requirement mapping: ${id} is not ${falseMeaning}`);
      }
    }
  }

  const semanticForbiddenByFile = {
    "01-scope-and-source-audit.md": [
      "대체→시설 자동 연동 기능 (FG-FUN-042)",
      "후보 일치근거 표시 (FG-FUN-044)",
      "후보 배제근거 표시 (FG-FUN-060)",
      "no-candidate 상태 (FG-FUN-031)",
    ],
    "02-user-flow-and-screen-states.md": [
      "FG-FUN-042(대체→시설 자동 연동)",
      "FG-FUN-044(후보 일치근거 표시)",
      "FG-FUN-060(후보 배제근거 표시)",
    ],
    "03-data-contract-and-lineage.md": [
      "facility_id ASC",
      "FG-FUN-044(일치근거 표시)",
      "FG-FUN-060(배제근거 표시)",
      "1단계 4개 지표의 개별 가중치는 VS-1 헤더 확인 후 확정",
    ],
    "04-supabase-schema-migration-rls.md": [
      "REFERENCES data_lineage(id)",
      "migration 파일 생성, 원격 실행",
    ],
    "05-nextjs-component-api-design.md": [
      "'exact' 또는 'substring' 배지",
    ],
    "06-qa-acceptance-trace.md": [
      "/substitutes → /facilities/[id]",
      "보류 요구사항 (46건 + 현재범위 제외 4건)",
      "FG-FUN-042 | 보류 — 대체 후보에서 시설 자동 필터 연동",
      "FG-FUN-044 | 보류 — 시설 상세에서 매칭 이유 표시",
      "FG-FUN-060 | 보류 — 시설 상세에서 배제 조건 표시",
    ],
    "08-implementation-slices.md": [
      "FG-FUN-001~011",
      "FG-DAT-002",
      "REVOKE SELECT ON public.* FROM anon",
    ],
    "09-review-request.md": [
      "service-role 보호",
      "FG-FUN-001~011",
      "REVOKE SELECT ON public.* FROM anon",
      "FG-FUN-031·042·044·060 (대체→시설 URL 전달, 조건 이유·미충족 표시)",
    ],
  };
  for (const [filename, phrases] of Object.entries(semanticForbiddenByFile)) {
    const filePath = path.join(designDir, filename);
    const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
    for (const phrase of phrases) {
      if (text.includes(phrase)) errors.push(`${filename}: semantic blocker remains: ${phrase}`);
    }
  }

  if (!dataContractText.includes("재정규화")) {
    errors.push("03-data-contract-and-lineage.md: missing null-aware weight renormalization contract");
  }
  if (!dataContractText.includes("ingredient_matching.csv") || !dataContractText.includes("food_master")) {
    errors.push("03-data-contract-and-lineage.md: source joins for name matching and nutrition master are incomplete");
  }

  const schemaText = fs.existsSync(supabasePath) ? fs.readFileSync(supabasePath, "utf8") : "";
  if (/CREATE TABLE public\.substitute_pairs[\s\S]*?match_type[\s\S]*?PRIMARY KEY/.test(schemaText)) {
    errors.push("04-supabase-schema-migration-rls.md: match_type is incorrectly stored as a required food-pair field");
  }
  const risksPath = path.join(designDir, "07-risks-decisions-open-items.md");
  const risksText = fs.existsSync(risksPath) ? fs.readFileSync(risksPath, "utf8") : "";
  if (/Q-06[\s\S]{0,500}미결정/.test(risksText) && /product_types\s+TEXT\[\]/.test(schemaText)) {
    errors.push("04-supabase-schema-migration-rls.md: product_types is committed in DDL while Q-06 is unresolved");
  }

  const nextPath = path.join(designDir, "05-nextjs-component-api-design.md");
  const nextText = fs.existsSync(nextPath) ? fs.readFileSync(nextPath, "utf8") : "";
  const qaPath = path.join(designDir, "06-qa-acceptance-trace.md");
  const qaText = fs.existsSync(qaPath) ? fs.readFileSync(qaPath, "utf8") : "";
  if (!/FG-FUN-059[^\n]{0,500}(mailto|메일 앱)/.test(qaText)) {
    errors.push("06-qa-acceptance-trace.md: FG-FUN-059 mailto acceptance or approved change-control condition is missing");
  }
  if (/FG-FUN-035[^\n]{0,300}\/substitutes/.test(qaText) || /대체 후보[^\n]{0,100}시설 상세/.test(qaText)) {
    errors.push("06-qa-acceptance-trace.md: FG-FUN-035 must link co-manufacturing candidates, not substitute candidates, to facility detail");
  }
  if (/service-role 서버 전용/.test(fs.readFileSync(path.join(designDir, "09-review-request.md"), "utf8"))) {
    errors.push("09-review-request.md: public architecture summary remains ambiguous about service-role runtime use");
  }

  const slicesPath = path.join(designDir, "08-implementation-slices.md");
  const slicesText = fs.existsSync(slicesPath) ? fs.readFileSync(slicesPath, "utf8") : "";
  for (const nonRequirementId of ["FG-AUD-", "FG-INF-"]) {
    if (slicesText.includes(nonRequirementId)) {
      errors.push(`08-implementation-slices.md: non-DOC-07 ID remains as requirement ID: ${nonRequirementId}`);
    }
  }
  if (/\| VS-5 \|[^\n]*FG-FUN-012/.test(slicesText) || /### VS-5[\s\S]*?\*\*요구사항 ID\*\*:[^\n]*FG-FUN-012/.test(slicesText)) {
    errors.push("08-implementation-slices.md: FG-FUN-012 pagination is duplicated in VS-5 instead of remaining in VS-3");
  }

  for (const tableName of ["recipes", "ingredients", "standard_foods"]) {
    if (!new RegExp(`CREATE TABLE public\\.${tableName}\\s*\\(`).test(schemaText)) {
      errors.push(`04-supabase-schema-migration-rls.md: missing logical DDL for public.${tableName}`);
    }
  }
  if (!/CREATE TABLE (public\.|private\.)?ingredient_[a-z_]*match[a-z_]*\s*\(/.test(schemaText)) {
    errors.push("04-supabase-schema-migration-rls.md: missing persisted input-name match contract for ingredient_matching.csv");
  }

  if (/Q-06[\s\S]{0,500}미결정/.test(risksText)) {
    for (const filename of [
      "02-user-flow-and-screen-states.md",
      "03-data-contract-and-lineage.md",
      "05-nextjs-component-api-design.md",
    ]) {
      const currentText = fs.readFileSync(path.join(designDir, filename), "utf8");
      const unqualified = currentText
        .split(/\r?\n/)
        .filter((line) => line.includes("product_types") && !/(Q-06|미결정|조건부|파생 불가|VS-1)/.test(line));
      if (unqualified.length) {
        errors.push(`${filename}: product_types is used as a committed contract while Q-06 is unresolved (${unqualified.length} line(s))`);
      }
    }
  }

  if (qaText.includes("승인된 이메일 소스 확보 또는 DOC-07 변경통제 완료")) {
    errors.push("06-qa-acceptance-trace.md: FG-FUN-059 mailto and copy-only change-control branches are conflated");
  }
  const reviewText = fs.readFileSync(path.join(designDir, "09-review-request.md"), "utf8");
  if (/이메일 소스[\s\S]{0,120}확보 이후 DOC-07 변경통제/.test(reviewText)) {
    errors.push("09-review-request.md: approved email source does not itself require DOC-07 change control");
  }
  if (!/복사 전용[\s\S]{0,180}(ADM-08|변경등록)[\s\S]{0,100}DOC-07/.test(reviewText)) {
    errors.push("09-review-request.md: copy-only FG-FUN-059 branch lacks ADM-08 and new DOC-07 revision requirement");
  }

  const globalClaudeSettings = path.join(os.homedir(), ".claude", "settings.json");
  if (fs.existsSync(globalClaudeSettings)) {
    const globalSettingsText = fs.readFileSync(globalClaudeSettings, "utf8");
    for (const hookName of ["sync-phase-quality-gate.sh", "handle-stop-goal.sh"]) {
      const localHookPath = path.join(root, ".claude", "hooks", "moai", hookName);
      if (globalSettingsText.includes(hookName) && !fs.existsSync(localHookPath)) {
        errors.push(`Claude/MoAI harness: global Stop hook target is missing in project: ${hookName}`);
      }
    }
  }

  // Item 1: VS-5 in 09-review-request.md must not reference FG-FUN-012
  if (/VS-5[^\n]{0,300}FG-FUN-012|FG-FUN-012[^\n]{0,300}VS-5/.test(reviewText)) {
    errors.push("09-review-request.md: VS-5 must not reference FG-FUN-012 (pagination belongs in VS-3)");
  }

  // Item 2: VS-2 in 08-implementation-slices.md must list 7 tables (6 public + private.data_lineage)
  if (!/\| VS-2 \|[^\n]*7개 테이블/.test(slicesText)) {
    errors.push("08-implementation-slices.md: VS-2 must list 7 tables (6 public + private.data_lineage)");
  }

  // Item 3: ingredient_name_match — standard_food_id nullable, input_name sole PK, no 'none' in CHECK
  const matchTableMatch = schemaText.match(/CREATE TABLE public\.ingredient_name_match\s*\([\s\S]*?\);/);
  if (matchTableMatch) {
    const matchDDL = matchTableMatch[0];
    if (/standard_food_id\s+TEXT\s+NOT NULL/.test(matchDDL)) {
      errors.push("04-supabase-schema-migration-rls.md: ingredient_name_match.standard_food_id must be nullable (unmatched rows need NULL)");
    }
    if (!/input_name\s+TEXT\s+PRIMARY KEY/.test(matchDDL)) {
      errors.push("04-supabase-schema-migration-rls.md: ingredient_name_match must use input_name TEXT PRIMARY KEY as sole key");
    }
    if (/'none'/.test(matchDDL)) {
      errors.push("04-supabase-schema-migration-rls.md: ingredient_name_match match_type must use 'unmatched' not 'none'");
    }
    if (!/'unmatched'/.test(matchDDL)) {
      errors.push("04-supabase-schema-migration-rls.md: ingredient_name_match CHECK constraint must include 'unmatched'");
    }
  } else {
    errors.push("04-supabase-schema-migration-rls.md: CREATE TABLE public.ingredient_name_match block not found for schema validation");
  }

  // Item 4: private schema DDL must appear before any public table DDL
  const privateSchemaPos = schemaText.indexOf("CREATE SCHEMA IF NOT EXISTS private");
  const firstPublicTablePos = schemaText.search(/CREATE TABLE public\.\w/);
  if (privateSchemaPos === -1) {
    errors.push("04-supabase-schema-migration-rls.md: CREATE SCHEMA IF NOT EXISTS private is missing");
  } else if (firstPublicTablePos !== -1 && privateSchemaPos > firstPublicTablePos) {
    errors.push("04-supabase-schema-migration-rls.md: private schema DDL must precede public table DDL");
  }
}

if (errors.length) {
  console.error(`G3-07 ${mode} validation: FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`G3-07 ${mode} validation: PASS (${expected.length} files)`);
