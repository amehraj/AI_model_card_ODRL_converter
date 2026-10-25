import { extractDescriptiveProperties } from "./extractAtoms.ts";
import { textSimilarity, MATCH_THRESHOLD } from "./match.ts";
import type { OdrlPolicy } from "../types.ts";

export interface DescriptiveRecallResult {
  recall: number;
  precision: number;
  referenceCount: number;
  generatedCount: number;
  recovered: number;
}

// Metric 4b: descriptive-property recall/precision — the flat "ex:" properties on the target
// asset (metrics, limitations, bias, ...) carry most of the descriptive content, so they are
// scored per property: recovered when the generated policy has the same key and a value whose
// text matches the reference value (fuzzy, see match.ts).
export const computeDescriptiveRecall = (generated: OdrlPolicy, reference: OdrlPolicy): DescriptiveRecallResult => {
  const generatedProps = extractDescriptiveProperties(generated);
  const referenceProps = extractDescriptiveProperties(reference);
  const referenceKeys = Object.keys(referenceProps);
  const generatedKeys = Object.keys(generatedProps);

  const recovered = referenceKeys.filter(
    (key) => key in generatedProps && textSimilarity(generatedProps[key], referenceProps[key]) >= MATCH_THRESHOLD
  ).length;

  return {
    recall: referenceKeys.length ? recovered / referenceKeys.length : 0,
    precision: generatedKeys.length ? recovered / generatedKeys.length : 0,
    referenceCount: referenceKeys.length,
    generatedCount: generatedKeys.length,
    recovered,
  };
};
