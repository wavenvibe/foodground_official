/**
 * Source-system test rows that must not cross the public catalog boundary.
 *
 * Keep this list identifier-based. Product or maker name pattern matching can
 * hide legitimate records that happen to contain words such as "TEST".
 */
export const PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS = [
  "11111111111001",
  "11111111112001",
  "11111111113001",
] as const;

const PUBLIC_EXCLUDED_PRODUCT_REPORT_NO_SET = new Set<string>(
  PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS,
);

export const PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS_POSTGREST =
  `(${PUBLIC_EXCLUDED_PRODUCT_REPORT_NOS.join(",")})`;

export function isPublicProductExcluded(reportNo: string): boolean {
  return PUBLIC_EXCLUDED_PRODUCT_REPORT_NO_SET.has(reportNo);
}
