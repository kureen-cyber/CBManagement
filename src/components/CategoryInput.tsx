"use client";

/** Free-text category with optional suggestions (datalist). */
export function CategoryInput({
  name = "category",
  defaultValue = "",
  suggestions = [],
  placeholder = "e.g. Grocery, Personal hygiene, Gift items",
  required = true,
  listId = "category-suggestions",
}: {
  name?: string;
  defaultValue?: string;
  suggestions?: string[];
  placeholder?: string;
  required?: boolean;
  listId?: string;
}) {
  const unique = [...new Set(suggestions.map((s) => s.trim()).filter(Boolean))];

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
