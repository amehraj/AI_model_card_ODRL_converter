import { extractConstraintAtoms } from "./extractAtoms.ts";
import { matchAtoms } from "./match.ts";
import type { OdrlPolicy } from "../types.ts";

export interface ConstraintAccuracyResult {
  leftOperandAccuracy: number;
  operatorAccuracy: number;
  matchedAtoms: number;
}

// Metric 4: constraint accuracy — among recovered clauses (matched to a reference clause by
// text), how often the generated left operand and the operator equal the reference's.
// (The right operand is the matched text itself; its fidelity is the match similarity.)
export const computeConstraintAccuracy = (generated: OdrlPolicy, reference: OdrlPolicy): ConstraintAccuracyResult => {
  const matches = matchAtoms(extractConstraintAtoms(generated), extractConstraintAtoms(reference));
  const rate = (hits: number) => (matches.length ? hits / matches.length : 0);

  return {
    leftOperandAccuracy: rate(matches.filter(({ generated: g, reference: r }) => g.leftOperand === r.leftOperand).length),
    operatorAccuracy: rate(matches.filter(({ generated: g, reference: r }) => g.operator === r.operator).length),
    matchedAtoms: matches.length,
  };
};
