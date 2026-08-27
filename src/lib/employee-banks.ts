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

export const EMPLOYMENT_BASIS_OPTIONS = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
] as const;

export type EmploymentBasis = (typeof EMPLOYMENT_BASIS_OPTIONS)[number]["value"];

export const PRONOUN_OPTIONS = [
  { value: "he", label: "He / Him" },
  { value: "she", label: "She / Her" },
  { value: "they", label: "They / Them" },
] as const;

export type EmployeePronoun = (typeof PRONOUN_OPTIONS)[number]["value"];
