import { checkSyntacticValidity, type SyntacticValidityResult } from "./syntacticValidity.ts";
import { computeExtractionCompleteness, type ExtractionCompletenessResult } from "./extractionCompleteness.ts";
import { computeRuleTypeConfusionMatrix, type RuleTypeConfusionMatrix } from "./ruleTypeAccuracy.ts";
import { computeConstraintAccuracy, type ConstraintAccuracyResult } from "./constraintAccuracy.ts";
import { computeDescriptiveRecall, type DescriptiveRecallResult } from "./descriptiveProperties.ts";
import { computeStability, type StabilityResult } from "./stability.ts";
import type { ConversionResult, OdrlPolicy } from "../types.ts";
import type { ShaclValidationResult } from "../validation/validateShacl.ts";

export interface ItemMetrics {
  corpusItemId: string;
  converter: string;
  syntacticValidity: SyntacticValidityResult;
  profileConformance?: ShaclValidationResult;
  extractionCompleteness?: ExtractionCompletenessResult;
  ruleTypeConfusion?: { matrix: RuleTypeConfusionMatrix; accuracy: number };
  constraintAccuracy?: ConstraintAccuracyResult;
  descriptiveRecall?: DescriptiveRecallResult;
  stability?: StabilityResult;
}

// Ties together metrics 1–5 (everything automatable) for a single corpus item + converter.
// `reference` is only available for the 10 ground-truth cards; `runs` are the repeated-run
// outputs (3x per the plan) used for the stability metric.
export const computeItemMetrics = async (params: {
  corpusItemId: string;
  converter: string;
  result: ConversionResult;
  reference?: OdrlPolicy;
  repeatedRuns?: OdrlPolicy[];
  validateProfile: (policy: OdrlPolicy) => Promise<ShaclValidationResult>;
}): Promise<ItemMetrics> => {
  const { corpusItemId, converter, result, reference, repeatedRuns, validateProfile } = params;

  const metrics: ItemMetrics = {
    corpusItemId,
    converter,
    syntacticValidity: checkSyntacticValidity(result.raw, result.parsed),
  };

  if (result.parsed) {
    metrics.profileConformance = await validateProfile(result.parsed);

    if (reference) {
      metrics.extractionCompleteness = computeExtractionCompleteness(result.parsed, reference);
      metrics.ruleTypeConfusion = computeRuleTypeConfusionMatrix(result.parsed, reference);
      metrics.constraintAccuracy = computeConstraintAccuracy(result.parsed, reference);
      metrics.descriptiveRecall = computeDescriptiveRecall(result.parsed, reference);
    }

    if (repeatedRuns && repeatedRuns.length > 1) {
      metrics.stability = computeStability(repeatedRuns);
    }
  }

  return metrics;
};
