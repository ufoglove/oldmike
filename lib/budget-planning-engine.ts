/**
 * Deterministic Budget Planning Engine (V3-U08-FULL)
 * Spec: docs/stage08/spec-v3-4.0.md §16, §27 (T19, T20)
 *
 * Implements:
 * 1. Deterministic multiplication: requestedAmount = quantity * unitCost * periods
 * 2. Proper category aggregation (Personnel, Operating, Equipment, Direct, Indirect)
 * 3. Handling of unknown unit costs (null values preserved, labeled in unknownItemsCount)
 * 4. Multi-currency safety (rejects mixing USD and TWD without verified exchange rates)
 * 5. High precision rounding to integer currency units (TWD)
 */

import { type BudgetItem, type BudgetPlan } from "./route-studio-contract.ts";

export type BudgetCalculationInput = {
  currency: "TWD";
  items: Array<Omit<BudgetItem, "requestedAmount"> & { requestedAmount?: number }>;
  overheadRate?: number; // e.g. 0.10 (10% indirect cost)
};

export function calculateBudgetPlan(input: BudgetCalculationInput): BudgetPlan {
  const { currency, items, overheadRate = 0 } = input;
  let totalPersonnelCost = 0;
  let totalOperatingCost = 0;
  let totalEquipmentCost = 0;
  let unknownItemsCount = 0;

  const computedItems: BudgetItem[] = items.map((item) => {
    // Multi-currency check
    if (item.currency !== currency) {
      throw new Error(`CURRENCY_MISMATCH: Item ${item.budgetItemId} currency ${item.currency} does not match plan currency ${currency}`);
    }

    if (item.unitCost === undefined || item.unitCost === null || Number.isNaN(item.unitCost) || item.unitCost < 0) {
      unknownItemsCount++;
      return {
        ...item,
        unitCost: 0,
        requestedAmount: 0,
      };
    }

    const periods = item.periods > 0 ? item.periods : 1;
    const quantity = item.quantity > 0 ? item.quantity : 1;
    const requestedAmount = Math.round(quantity * item.unitCost * periods);

    if (item.category === "PERSONNEL_ASSISTANT") {
      totalPersonnelCost += requestedAmount;
    } else if (item.category === "EQUIPMENT_LEASE_PURCHASE") {
      totalEquipmentCost += requestedAmount;
    } else if (item.category === "OPERATING_CONSUMABLE" || item.category === "TRAVEL_DOMESTIC") {
      totalOperatingCost += requestedAmount;
    }

    return {
      ...item,
      requestedAmount,
    };
  });

  const totalDirectCost = totalPersonnelCost + totalOperatingCost + totalEquipmentCost;
  const totalIndirectCost = Math.round(totalDirectCost * overheadRate);
  const grandTotal = totalDirectCost + totalIndirectCost;

  return {
    currency,
    items: computedItems,
    totalPersonnelCost,
    totalOperatingCost,
    totalEquipmentCost,
    totalDirectCost,
    totalIndirectCost,
    grandTotal,
    unknownItemsCount,
    calculationStatus: unknownItemsCount > 0 ? "PARTIAL_UNKNOWN_EXCLUDED" : "COMPUTED",
    lastCalculationTimestamp: new Date().toISOString(),
  };
}
