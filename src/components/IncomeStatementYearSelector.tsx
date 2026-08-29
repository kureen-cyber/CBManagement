"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function IncomeStatementYearSelector({
  year,
  years,
}: {
  year: number;
  years: number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="field" style={{ maxWidth: 180, margin: 0 }}>
      Statement year
      <select
        value={year}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("year", e.target.value);
          if (!params.get("section")) params.set("section", "income");
          router.replace(`/financial-reports?${params.toString()}`);
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
