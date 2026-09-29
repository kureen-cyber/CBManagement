import { unitSelectOptions } from "@/lib/constants";

export function UnitSelect({
  name,
  defaultValue = "each",
  required,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const value = String(defaultValue || "each").trim() || "each";
  const options = unitSelectOptions(value);
  return (
    <select name={name} defaultValue={value} required={required}>
      {options.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}
