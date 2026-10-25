import { extractConstraintAtoms } from "./extractAtoms.ts";
import { matchAtoms } from "./match.ts";
import type { OdrlPolicy } from "../types.ts";

export interface StabilityResult {
  pairwiseJaccard: number[];
  meanJaccard: number;
}

// Agreement of two runs: matched clauses / union of clauses (Jaccard with fuzzy matching).
const agreement = (a: OdrlPolicy, b: OdrlPolicy): number => {
  const atomsA = extractConstraintAtoms(a);
  const atomsB = extractConstraintAtoms(b);
  const shared = matchAtoms(atomsA, atomsB).length;
  const union = atomsA.length + atomsB.length - shared;
  return union ? shared / union : 1;
};

// Metric 5: stability — pairwise Jaccard agreement of extracted atom sets across N
// repeated runs of the same converter on the same model card. Report variance, not just
// a mean: a single averaged number can hide a converter that is stable on easy cards and
// wildly inconsistent on hard ones.
export const computeStability = (runs: OdrlPolicy[]): StabilityResult => {
  const pairwiseJaccard: number[] = [];

  for (let i = 0; i < runs.length; i += 1) {
    for (let j = i + 1; j < runs.length; j += 1) {
      pairwiseJaccard.push(agreement(runs[i], runs[j]));
    }
  }

  const meanJaccard = pairwiseJaccard.length
    ? pairwiseJaccard.reduce((sum, value) => sum + value, 0) / pairwiseJaccard.length
    : 1;

  return { pairwiseJaccard, meanJaccard };
};
