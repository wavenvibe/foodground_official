// 회수·판매중지 데이터 수집 스크립트
// 실행 전 FOODSAFETYKOREA_API_KEY 환경변수를 설정해야 한다.

import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.FOODSAFETYKOREA_API_KEY?.trim();
const SERVICE_ID = "I0490";
const PAGE_SIZE = 100;

if (!API_KEY) {
  throw new Error("FOODSAFETYKOREA_API_KEY 환경변수가 필요합니다.");
}

const BASE_URL = `http://openapi.foodsafetykorea.go.kr/api/${API_KEY}/${SERVICE_ID}/json`;
const db = new Database(join(__dirname, "../data/foodground.db"));

async function fetchPage(start, end) {
  const url = `${BASE_URL}/${start}/${end}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data = json[SERVICE_ID];
  if (!data || data.RESULT?.CODE !== "INFO-000") {
    throw new Error(`API error: ${data?.RESULT?.MSG}`);
  }
  return { rows: data.row ?? [], total: parseInt(data.total_count, 10) };
}

function toDate(str) {
  if (!str || str === "데이터없음") return null;
  // YYYY-MM-DD HH:MM:SS.xxx → YYYY-MM-DD
  return str.slice(0, 10).replace(/\./g, "-");
}

const stmtMatchReport = db.prepare(
  "SELECT facility_mgt_no FROM production_log WHERE report_no = ? LIMIT 1"
);

const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO sales_suspension
    (facility_mgt_no, product_name, maker_name, maker_addr, reason, method,
     batch_mfg_date, batch_exp_date, barcode, product_code, image_url, published_at)
  VALUES
    (@facility_mgt_no, @product_name, @maker_name, @maker_addr, @reason, @method,
     @batch_mfg_date, @batch_exp_date, @barcode, @product_code, @image_url, @published_at)
`);

function processRow(row) {
  let facility_mgt_no = null;

  if (row.PRDLST_REPORT_NO) {
    const match = stmtMatchReport.get(row.PRDLST_REPORT_NO);
    if (match?.facility_mgt_no) facility_mgt_no = match.facility_mgt_no;
  }

  stmtInsert.run({
    facility_mgt_no,
    product_name: row.PRDTNM ?? "",
    maker_name: row.BSSHNM ?? null,
    maker_addr: row.ADDR ?? null,
    reason: row.RTRVLPRVNS ?? null,
    method: row.RTRVLPLANDOC_RTRVLMTHD || null,
    batch_mfg_date: toDate(row.MNFDT),
    batch_exp_date: row.DISTBTMLMT?.slice(0, 10) ?? null,
    barcode: row.BRCDNO || null,
    product_code: row.PRDLST_REPORT_NO || null,
    image_url: row.IMG_FILE_PATH?.split(",")[0]?.trim() || null,
    published_at: toDate(row.CRET_DTM),
  });

  return facility_mgt_no;
}

async function main() {
  console.log("회수·판매중지 데이터 수집 시작");

  // 기존 데이터 초기화
  db.prepare("DELETE FROM sales_suspension").run();
  db.prepare("UPDATE facility SET suspension_count = 0").run();

  // 전체 건수 파악
  const { total } = await fetchPage(1, 1);
  console.log(`총 ${total}건`);

  let inserted = 0;
  let matched = 0;

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      const fmgtNo = processRow(row);
      inserted++;
      if (fmgtNo) matched++;
    }
  });

  for (let start = 1; start <= total; start += PAGE_SIZE) {
    const end = Math.min(start + PAGE_SIZE - 1, total);
    process.stdout.write(`\r  ${end}/${total}건 처리 중...`);
    const { rows } = await fetchPage(start, end);
    insertMany(rows);
  }

  console.log(`\n삽입 완료: ${inserted}건 (업체 매칭: ${matched}건)`);

  // suspension_count 갱신
  db.prepare(`
    UPDATE facility
    SET suspension_count = (
      SELECT COUNT(*) FROM sales_suspension
      WHERE facility_mgt_no = facility.mgt_no
    )
    WHERE mgt_no IN (SELECT DISTINCT facility_mgt_no FROM sales_suspension WHERE facility_mgt_no IS NOT NULL)
  `).run();

  const withCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM facility WHERE suspension_count > 0"
  ).get();
  console.log(`suspension_count 업데이트 완료: ${withCount.cnt}개 업체`);

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  db.prepare(`
    INSERT INTO ingest_log (dataset, started_at, finished_at, rows_inserted, status)
    VALUES ('suspension', ?, ?, ?, 'ok')
  `).run(now, now, inserted);
  console.log("ingest_log 기록 완료");

  db.close();
}

main().catch((e) => {
  console.error("오류:", e.message);
  process.exit(1);
});
