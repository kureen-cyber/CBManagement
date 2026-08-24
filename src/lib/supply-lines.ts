export type PersistedSupplyLine = {
  supplierItemId?: string;
  name: string;
  supplierName?: string;
  qty: number;
  unit: string;
  unitCost: number;
  lineCost: number;
  supplyType: string;
};

export function parseSupplyLinesJson(raw: string | null | undefined): PersistedSupplyLine[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as PersistedSupplyLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l) =>
        l &&
        typeof l.name === "string" &&
        typeof l.lineCost === "number" &&
        l.lineCost > 0 &&
        typeof l.supplyType === "string",
    );
  } catch {
    return [];
  }
}

/** Pre-markup equipment purchase vs rental amounts for auto-expenses on quote conversion. */
export function equipmentExpenseBreakdown(
  equipmentCost: number,
  supplyLines: PersistedSupplyLine[],
): { equipment: number; rental: number } {
  const fromSupplyEquipment = supplyLines
    .filter((l) => l.supplyType === "EQUIPMENT")
    .reduce((s, l) => s + l.lineCost, 0);
  const fromSupplyRental = supplyLines
    .filter((l) => l.supplyType === "EQUIPMENT_RENTAL")
    .reduce((s, l) => s + l.lineCost, 0);
  const manualEquipment = Math.max(0, equipmentCost - fromSupplyEquipment - fromSupplyRental);
  return {
    equipment: fromSupplyEquipment + manualEquipment,
    rental: fromSupplyRental,
  };
}
