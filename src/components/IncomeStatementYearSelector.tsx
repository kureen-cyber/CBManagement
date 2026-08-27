"use client";

import { useRouter } from "next/navigation";

export function IncomeStatementYearSelector({
  year,
  years,
}: {
  year: number;
  years: number[];
}) {
  const router = useRouter();
  return (
    <label className="field" style={{ maxWidth: 180, margin: 0 }}>
      Statement year
      <select
        value={year}
        onChange={(e) => {
          const next = e.target.value;
          router.replace(`/financial-reports?year=${next}`);
        }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
