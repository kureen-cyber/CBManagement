"use client";

/** Category field: dropdown of company categories (plus optional free-text legacy). */
export function CategoryInput({
  name = "category",
  defaultValue = "",
  suggestions = [],
  placeholder = "Select a category",
  required = true,
  listId = "category-suggestions",
  allowCustom = false,
}: {
  name?: string;
  defaultValue?: string;
  suggestions?: string[];
  placeholder?: string;
  required?: boolean;
  listId?: string;
  /** When true, keep datalist free-text; otherwise use a select dropdown. */
  allowCustom?: boolean;
}) {
  const unique = [...new Set(suggestions.map((s) => s.trim()).filter(Boolean))];
  const initial = defaultValue || unique[0] || "General";

  if (!allowCustom && unique.length > 0) {
    const options = unique.includes(initial) ? unique : [initial, ...unique];
    return (
      <select name={name} defaultValue={initial} required={required}>
        {!required ? <option value="">{placeholder}</option> : null}
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    );
  }

  return (
    <>
      <input
        name={name}
        type="text"
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        list={listId}
        autoComplete="off"
      />
      <datalist id={listId}>
        {unique.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
