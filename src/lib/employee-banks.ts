export const EMPLOYEE_BANKS = [
  "First Citizens Bank",
  "RBC Royal Bank",
  "Republic Bank",
  "Scotia Bank",
  "ANSA Bank",
  "JMMB Bank",
  "CIBC Caribbean Bank",
  "Citibank",
] as const;

export type EmployeeBank = (typeof EMPLOYEE_BANKS)[number];

export const PAY_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
] as const;

export type PayFrequency = (typeof PAY_FREQUENCIES)[number]["value"];
