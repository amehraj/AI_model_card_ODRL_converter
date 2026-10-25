import { extractConstraintAtoms } from "./extractAtoms.ts";
import { matchAtoms } from "./match.ts";
import type { OdrlPolicy } from "../types.ts";

export interface ExtractionCompletenessResult {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

// Metric 2: extraction completeness — precision/recall/F1 of constraint atoms recovered vs. the
// hand-authored reference policy. An atom is recovered when its clause text matches a reference
// clause (fuzzy, see match.ts), whatever its rule type or left operand; those are scored by
// metrics 3 and 4. Requires a reference.
export const computeExtractionCompleteness = (
  generated: OdrlPolicy,
  reference: OdrlPolicy
): ExtractionCompletenessResult => {
  const generatedAtoms = extractConstraintAtoms(generated);
  const referenceAtoms = extractConstraintAtoms(reference);
  const truePositives = matchAtoms(generatedAtoms, referenceAtoms).length;

  const falsePositives = generatedAtoms.length - truePositives;
  const falseNegatives = referenceAtoms.length - truePositives;
  const precision = generatedAtoms.length ? truePositives / generatedAtoms.length : 0;
  const recall = referenceAtoms.length ? truePositives / referenceAtoms.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return { precision, recall, f1, truePositives, falsePositives, falseNegatives };
};
