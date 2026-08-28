import type { StandardFood } from "@/lib/substitutes";

interface NutritionTableProps {
  source: StandardFood;
  candidate: StandardFood;
}

interface NutritionRow {
  label: string;
  unit: string;
  sourceValue: number | null;
  candidateValue: number | null;
}

function fmt(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

function diffClass(src: number | null, cand: number | null): string {
  if (src == null || cand == null) return "";
  const diff = cand - src;
  if (Math.abs(diff) < 0.5) return "";
  return diff > 0 ? "nutrition-cell--up" : "nutrition-cell--down";
}

export default function NutritionTable({ source, candidate }: NutritionTableProps) {
  const rows: NutritionRow[] = [
    { label: "에너지", unit: "kcal", sourceValue: source.energy_kcal, candidateValue: candidate.energy_kcal },
    { label: "수분", unit: "g", sourceValue: source.water_g, candidateValue: candidate.water_g },
    { label: "단백질", unit: "g", sourceValue: source.protein_g, candidateValue: candidate.protein_g },
    { label: "지방", unit: "g", sourceValue: source.fat_g, candidateValue: candidate.fat_g },
    { label: "탄수화물", unit: "g", sourceValue: source.carbohydrate_g, candidateValue: candidate.carbohydrate_g },
    { label: "회분", unit: "g", sourceValue: source.ash_g, candidateValue: candidate.ash_g },
  ];

  return (
    <div className="nutrition-table-wrap" aria-label="영양성분 비교 (100g 기준)">
      <table className="nutrition-table">
        <caption className="nutrition-caption">영양성분 비교 (100g 기준)</caption>
        <thead>
          <tr>
            <th scope="col">성분</th>
            <th scope="col" className="nutrition-cell--source">{source.name}</th>
            <th scope="col" className="nutrition-cell--candidate">{candidate.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="nutrition-label">
                {row.label}
                <span className="nutrition-unit"> ({row.unit})</span>
              </td>
              <td className="nutrition-cell">{fmt(row.sourceValue)}</td>
              <td className={`nutrition-cell ${diffClass(row.sourceValue, row.candidateValue)}`}>
                {fmt(row.candidateValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
