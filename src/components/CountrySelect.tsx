import { COUNTRIES } from "@/lib/countries";

export function CountrySelect({
  name = "country",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string | null;
}) {
  const current = String(defaultValue || "").trim();
  const extra = current && !COUNTRIES.includes(current) ? current : null;

  return (
    <select name={name} defaultValue={current}>
      <option value="">Select country</option>
      {extra ? <option value={extra}>{extra}</option> : null}
      {COUNTRIES.map((country) => (
        <option key={country} value={country}>
          {country}
        </option>
      ))}
    </select>
  );
}
