import { extractConstraintAtoms, type RuleType } from "./extractAtoms.ts";
import { matchAtoms } from "./match.ts";
import type { OdrlPolicy } from "../types.ts";

export type RuleTypeConfusionMatrix = Record<RuleType, Record<RuleType, number>>;

const RULE_TYPES: RuleType[] = ["permission", "prohibition", "duty"];

const emptyMatrix = (): RuleTypeConfusionMatrix =>
  Object.fromEntries(
    RULE_TYPES.map((actual) => [actual, Object.fromEntries(RULE_TYPES.map((predicted) => [predicted, 0]))])
  ) as RuleTypeConfusionMatrix;

// Metric 3: rule-type classification accuracy — for every recovered clause (matched to a
// reference clause by text), is the generated rule type (permission/prohibition/duty) the same
// as the reference's? Rows = reference type, columns = generated type. Unrecovered clauses are
// counted by extraction recall instead.
export const computeRuleTypeConfusionMatrix = (
  generated: OdrlPolicy,
  reference: OdrlPolicy
): { matrix: RuleTypeConfusionMatrix; accuracy: number } => {
  const matches = matchAtoms(extractConstraintAtoms(generated), extractConstraintAtoms(reference));
  const matrix = emptyMatrix();
  let correct = 0;

  matches.forEach(({ generated: g, reference: r }) => {
    matrix[r.ruleType][g.ruleType] += 1;
    if (g.ruleType === r.ruleType) correct += 1;
  });

  return { matrix, accuracy: matches.length ? correct / matches.length : 0 };
};
