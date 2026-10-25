import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ItemMetrics } from "./metrics/index.ts";

const RESULTS_DIR = fileURLToPath(new URL("../results", import.meta.url));

interface HarnessRecord {
  item: string;
  converter: string;
  runIndex: number;
  metrics: ItemMetrics;
}

interface ConverterSummary {
  converter: string;
  runs: number;
  syntacticParseRate: number;
  syntacticRequiredKeysRate: number;
  shaclConformRate: number;
  meanStability: number | null;
  extraction: { precision: number; recall: number; f1: number } | null;
  ruleTypeAccuracy: number | null;
  constraintOperatorAccuracy: number | null;
  constraintLeftOperandAccuracy: number | null;
  descriptive: { recall: number; precision: number } | null;
  // Mean over cards of the standard deviation (across the runs of one card) of extraction F1 and
  // descriptive recall: how much the output varies between repeated runs. 0 at temperature 0.
  withinCardSd: { f1: number; descriptiveRecall: number } | null;
  // 95% percentile bootstrap interval of the mean over cards (cards resampled with replacement) of the
  // per-card mean extraction F1 and descriptive recall; the card is the unit of analysis, not the run.
  ci95: { f1: [number, number]; descriptiveRecall: [number, number] } | null;
}

const sd = (values: number[]): number => {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
};

// Small seeded generator (mulberry32) so that the intervals are reproducible.
const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const bootstrapCi = (perCard: number[], resamples = 10000): [number, number] => {
  const random = seededRandom(12345);
  const means: number[] = [];
  for (let i = 0; i < resamples; i += 1) {
    let sum = 0;
    for (let j = 0; j < perCard.length; j += 1) sum += perCard[Math.floor(random() * perCard.length)];
    means.push(sum / perCard.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * resamples)], means[Math.floor(0.975 * resamples)]];
};

const mean = (values: number[]): number => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

// Resolves which result files to aggregate: explicit paths passed as CLI args, or (default)
// every harness-run-*.jsonl found in evaluation/results/.
const resolveInputFiles = async (): Promise<string[]> => {
  const explicitArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (explicitArgs.length > 0) return explicitArgs;

  const files = await readdir(RESULTS_DIR);
  return files.filter((file) => file.startsWith("harness-run-") && file.endsWith(".jsonl")).map((file) => `${RESULTS_DIR}/${file}`);
};

// Turns raw per-run harness output into one summary row per converter. Stability is computed
// once per (item, converter) by the harness but duplicated onto every run's metrics record, so
// it is deduplicated here before averaging across items.
const summarizeByConverter = (records: HarnessRecord[]): ConverterSummary[] => {
  const converters = [...new Set(records.map((r) => r.converter))];

  return converters.map((converter) => {
    const converterRecords = records.filter((r) => r.converter === converter);
    const runs = converterRecords.length;

    const syntacticParseRate = mean(converterRecords.map((r) => (r.metrics.syntacticValidity.parses ? 1 : 0)));
    const syntacticRequiredKeysRate = mean(
      converterRecords.map((r) => (r.metrics.syntacticValidity.hasRequiredKeys ? 1 : 0))
    );

    const withProfileConformance = converterRecords.filter((r) => r.metrics.profileConformance);
    const shaclConformRate = withProfileConformance.length
      ? mean(withProfileConformance.map((r) => (r.metrics.profileConformance!.conforms ? 1 : 0)))
      : 0;

    const stabilityByItem = new Map<string, number>();
    converterRecords.forEach((r) => {
      if (r.metrics.stability) stabilityByItem.set(r.item, r.metrics.stability.meanJaccard);
    });
    const meanStability = stabilityByItem.size ? mean([...stabilityByItem.values()]) : null;

    const withExtraction = converterRecords.filter((r) => r.metrics.extractionCompleteness);
    const extraction = withExtraction.length
      ? {
          precision: mean(withExtraction.map((r) => r.metrics.extractionCompleteness!.precision)),
          recall: mean(withExtraction.map((r) => r.metrics.extractionCompleteness!.recall)),
          f1: mean(withExtraction.map((r) => r.metrics.extractionCompleteness!.f1)),
        }
      : null;

    const withRuleType = converterRecords.filter((r) => r.metrics.ruleTypeConfusion);
    const ruleTypeAccuracy = withRuleType.length
      ? mean(withRuleType.map((r) => r.metrics.ruleTypeConfusion!.accuracy))
      : null;

    const withConstraint = converterRecords.filter((r) => r.metrics.constraintAccuracy);
    const constraintOperatorAccuracy = withConstraint.length
      ? mean(withConstraint.map((r) => r.metrics.constraintAccuracy!.operatorAccuracy))
      : null;

    const withDescriptive = converterRecords.filter((r) => r.metrics.descriptiveRecall);
    const descriptive = withDescriptive.length
      ? {
          recall: mean(withDescriptive.map((r) => r.metrics.descriptiveRecall!.recall)),
          precision: mean(withDescriptive.map((r) => r.metrics.descriptiveRecall!.precision)),
        }
      : null;
    const constraintLeftOperandAccuracy = withConstraint.length
      ? mean(withConstraint.map((r) => r.metrics.constraintAccuracy!.leftOperandAccuracy))
      : null;

    const itemsWithRuns = [...new Set(withDescriptive.map((r) => r.item))].filter(
      (item) => withDescriptive.filter((r) => r.item === item).length > 1
    );
    const withinCardSd = itemsWithRuns.length
      ? {
          f1: mean(itemsWithRuns.map((item) => sd(withExtraction.filter((r) => r.item === item).map((r) => r.metrics.extractionCompleteness!.f1)))),
          descriptiveRecall: mean(
            itemsWithRuns.map((item) => sd(withDescriptive.filter((r) => r.item === item).map((r) => r.metrics.descriptiveRecall!.recall)))
          ),
        }
      : null;

    const cardMeans = (records: HarnessRecord[], pick: (r: HarnessRecord) => number): number[] =>
      [...new Set(records.map((r) => r.item))].map((item) => mean(records.filter((r) => r.item === item).map(pick)));
    const ci95 =
      withExtraction.length && withDescriptive.length
        ? {
            f1: bootstrapCi(cardMeans(withExtraction, (r) => r.metrics.extractionCompleteness!.f1)),
            descriptiveRecall: bootstrapCi(cardMeans(withDescriptive, (r) => r.metrics.descriptiveRecall!.recall)),
          }
        : null;

    return {
      converter,
      runs,
      syntacticParseRate,
      syntacticRequiredKeysRate,
      shaclConformRate,
      meanStability,
      extraction,
      ruleTypeAccuracy,
      constraintOperatorAccuracy,
      constraintLeftOperandAccuracy,
      descriptive,
      withinCardSd,
      ci95,
    };
  });
};

const formatPct = (value: number | null): string => (value === null ? "n/a" : `${(value * 100).toFixed(0)}%`);

const main = async () => {
  const inputFiles = await resolveInputFiles();
  if (inputFiles.length === 0) {
    console.log(`No harness-run-*.jsonl files found in ${RESULTS_DIR}. Run "npm run harness" first.`);
    return;
  }

  const allRecords: HarnessRecord[] = [];
  for (const file of inputFiles) {
    const lines = (await readFile(file, "utf-8")).split("\n").filter(Boolean);
    allRecords.push(...lines.map((line) => JSON.parse(line) as HarnessRecord));
  }

  const summaries = summarizeByConverter(allRecords);

  console.log(`\nAggregated ${allRecords.length} records from ${inputFiles.length} file(s):\n`);
  console.table(
    summaries.map((s) => ({
      converter: s.converter,
      runs: s.runs,
      "parse rate": formatPct(s.syntacticParseRate),
      "required keys": formatPct(s.syntacticRequiredKeysRate),
      "SHACL conforms": formatPct(s.shaclConformRate),
      stability: s.meanStability === null ? "n/a" : s.meanStability.toFixed(2),
      "extraction P/R/F1": s.extraction
        ? `${s.extraction.precision.toFixed(2)}/${s.extraction.recall.toFixed(2)}/${s.extraction.f1.toFixed(2)}`
        : "n/a (no ground truth)",
      "rule-type acc": formatPct(s.ruleTypeAccuracy),
      "constraint left-operand acc": formatPct(s.constraintLeftOperandAccuracy),
      "constraint operator acc": formatPct(s.constraintOperatorAccuracy),
      "within-card SD (F1 / descr. recall)": s.withinCardSd
        ? `${s.withinCardSd.f1.toFixed(3)} / ${s.withinCardSd.descriptiveRecall.toFixed(3)}`
        : "n/a",
      "95% CI F1 / descr. recall": s.ci95
        ? `${s.ci95.f1[0].toFixed(2)}-${s.ci95.f1[1].toFixed(2)} / ${s.ci95.descriptiveRecall[0].toFixed(2)}-${s.ci95.descriptiveRecall[1].toFixed(2)}`
        : "n/a",
      "descriptive P/R": s.descriptive ? `${s.descriptive.precision.toFixed(2)}/${s.descriptive.recall.toFixed(2)}` : "n/a",
    }))
  );

  const outputPath = `${RESULTS_DIR}/summary-${Date.now()}.json`;
  await writeFile(outputPath, JSON.stringify(summaries, null, 2));
  console.log(`\nWrote summary to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
