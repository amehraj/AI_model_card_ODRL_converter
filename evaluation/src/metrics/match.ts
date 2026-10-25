import type { ConstraintAtom } from "./extractAtoms.ts";

// Clauses in model cards are natural language, so atoms and descriptive values are matched by
// token overlap, not by exact string. Two texts match when the Dice coefficient of their
// normalised word sets is at least MATCH_THRESHOLD. The threshold is reported in the paper.
// MATCH_THRESHOLD in the environment overrides it, for the sensitivity analysis (src/rescore.ts only).
export const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD ?? 0.5);

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "by", "as", "at", "is", "are", "be", "this", "that", "it", "its",
]);

const tokens = (text: string): Set<string> =>
  new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => !STOP_WORDS.has(token)));

export const textSimilarity = (a: string, b: string): number => {
  const setA = tokens(a);
  const setB = tokens(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  setA.forEach((token) => {
    if (setB.has(token)) shared += 1;
  });
  return (2 * shared) / (setA.size + setB.size);
};

export interface AtomMatch {
  generated: ConstraintAtom;
  reference: ConstraintAtom;
  similarity: number;
}

// One-to-one matching of generated atoms to reference atoms on rightOperand text alone (rule
// type and left operand are judged afterwards, on the matched pairs). Highest similarity first.
export const matchAtoms = (generated: ConstraintAtom[], reference: ConstraintAtom[]): AtomMatch[] => {
  const candidates: (AtomMatch & { g: number; r: number })[] = [];
  generated.forEach((g, gi) =>
    reference.forEach((r, ri) => {
      const similarity = textSimilarity(g.rightOperand, r.rightOperand);
      if (similarity >= MATCH_THRESHOLD) candidates.push({ generated: g, reference: r, similarity, g: gi, r: ri });
    })
  );
  candidates.sort((x, y) => y.similarity - x.similarity);

  const usedGenerated = new Set<number>();
  const usedReference = new Set<number>();
  const matches: AtomMatch[] = [];
  candidates.forEach(({ g, r, ...match }) => {
    if (usedGenerated.has(g) || usedReference.has(r)) return;
    usedGenerated.add(g);
    usedReference.add(r);
    matches.push(match);
  });
  return matches;
};
