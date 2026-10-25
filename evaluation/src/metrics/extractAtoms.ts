import type { OdrlPolicy } from "../types.ts";

export type RuleType = "permission" | "prohibition" | "duty";

export interface ConstraintAtom {
  ruleType: RuleType;
  leftOperand: string;
  operator: string;
  rightOperand: string;
}

const CONSTRAINT_GROUP_KEYS = ["odrl:and", "odrl:or", "odrl:xor"] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Recursively walks a constraint (which may be a single object, an array, or nested
// odrl:and/or/xor groups) and flattens it into leaf leftOperand/operator/rightOperand atoms.
const flattenConstraint = (constraint: unknown, ruleType: RuleType, atoms: ConstraintAtom[]): void => {
  if (Array.isArray(constraint)) {
    constraint.forEach((entry) => flattenConstraint(entry, ruleType, atoms));
    return;
  }
  if (!isPlainObject(constraint)) return;

  for (const groupKey of CONSTRAINT_GROUP_KEYS) {
    if (groupKey in constraint) {
      flattenConstraint(constraint[groupKey], ruleType, atoms);
      return;
    }
  }

  if (typeof constraint.leftOperand === "string") {
    atoms.push({
      ruleType,
      leftOperand: String(constraint.leftOperand),
      operator: String(constraint.operator ?? "odrl:eq"),
      rightOperand: String(constraint.rightOperand ?? ""),
    });
  }
};

// Extracts every (ruleType, leftOperand, operator, rightOperand) atom from a policy's
// permission/prohibition/duty rules. Used as the common unit of comparison by every
// extraction/constraint/rule-type metric below.
export const extractConstraintAtoms = (policy: OdrlPolicy): ConstraintAtom[] => {
  const atoms: ConstraintAtom[] = [];
  (["permission", "prohibition", "duty"] as const).forEach((ruleType) => {
    const rules = policy[ruleType];
    if (!Array.isArray(rules)) return;
    rules.forEach((rule) => {
      const constraint = (rule as Record<string, unknown>).constraint;
      flattenConstraint(constraint, ruleType, atoms);
    });
  });
  return atoms;
};

// Descriptive properties: the flat "ex:" literal properties on the target asset (metrics,
// limitations, bias, ...). Scored separately from the rule atoms.
export const extractDescriptiveProperties = (policy: OdrlPolicy): Record<string, string> => {
  const target = policy.target;
  const properties: Record<string, string> = {};
  if (!isPlainObject(target)) return properties;
  Object.entries(target).forEach(([key, value]) => {
    if (key.startsWith("ex:") && typeof value === "string") properties[key] = value;
  });
  return properties;
};
