import { computeExtractionCompleteness } from "./metrics/extractionCompleteness.ts";
import { computeRuleTypeConfusionMatrix } from "./metrics/ruleTypeAccuracy.ts";
import { computeConstraintAccuracy } from "./metrics/constraintAccuracy.ts";
import { computeDescriptiveRecall } from "./metrics/descriptiveProperties.ts";
import { computeStability } from "./metrics/stability.ts";
import type { OdrlPolicy } from "./types.ts";

// Unit test of metrics 2-5 on a hand-built reference/generated pair (no LLM, no shapes).
const policy = (target: Record<string, string>, rules: { type: string; left: string; op: string; text: string }[]): OdrlPolicy => {
  const out: Record<string, unknown> = { "@type": "odrl:Policy", target };
  for (const rule of rules) {
    ((out[rule.type] ??= []) as unknown[]).push({
      constraint: [{ leftOperand: rule.left, operator: rule.op, rightOperand: rule.text }],
    });
  }
  return out as unknown as OdrlPolicy;
};

const reference = policy({ "ex:limitations": "Struggles with occluded faces", "ex:typeOfBias": "Trained on posed emotion", "ex:riskFactors": "Misclassification in low light" }, [
  { type: "permission", left: "ex:intendedUseCase", op: "odrl:eq", text: "Detect human emotion from photos and videos" },
  { type: "prohibition", left: "ex:misuseCase", op: "odrl:eq", text: "Covert surveillance" },
  { type: "duty", left: "ex:biasMitigation", op: "odrl:eq", text: "Developers should consider algorithmic bias before deployment" },
  { type: "duty", left: "ex:safetyMeasures", op: "odrl:eq", text: "Model is evaluated on held-out images" },
]);

const generated = policy({ "ex:limitations": "Struggles with occluded faces and unstable landmarks", "ex:typeOfBias": "Gender balance unknown", "ex:hardware": "T4 GPU" }, [
  { type: "permission", left: "ex:intendedUseCase", op: "odrl:eq", text: "Detect human emotion from photos and videos using landmarks" }, // matches, right type
  { type: "duty", left: "ex:misuseCase", op: "odrl:neq", text: "Covert surveillance" }, // matches, wrong type, wrong operator
  { type: "duty", left: "ex:biasMitigation", op: "odrl:eq", text: "Consider algorithmic bias before deployment" }, // matches
  { type: "duty", left: "ex:hardwareNote", op: "odrl:eq", text: "Runs on a T4 GPU" }, // extra
]);

let failures = 0;
const check = (name: string, actual: number, expected: number) => {
  const ok = Math.abs(actual - expected) < 1e-9;
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${actual.toFixed(3)} (expected ${expected.toFixed(3)})`);
};

const extraction = computeExtractionCompleteness(generated, reference);
check("extraction precision (3 of 4 generated match)", extraction.precision, 3 / 4);
check("extraction recall (3 of 4 reference found)", extraction.recall, 3 / 4);
check("rule-type accuracy (2 of 3 matched)", computeRuleTypeConfusionMatrix(generated, reference).accuracy, 2 / 3);
const constraint = computeConstraintAccuracy(generated, reference);
check("operator accuracy (2 of 3)", constraint.operatorAccuracy, 2 / 3);
check("left-operand accuracy (3 of 3)", constraint.leftOperandAccuracy, 1);
const descriptive = computeDescriptiveRecall(generated, reference);
check("descriptive recall (limitations only, 1 of 3)", descriptive.recall, 1 / 3);
check("descriptive precision (1 of 3 generated)", descriptive.precision, 1 / 3);
check("stability of identical runs", computeStability([reference, reference, reference]).meanJaccard, 1);
check("stability of disjoint runs", computeStability([reference, policy({}, [{ type: "duty", left: "ex:x", op: "odrl:eq", text: "zebra quartz" }])]).meanJaccard, 0);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exitCode = failures ? 1 : 0;
