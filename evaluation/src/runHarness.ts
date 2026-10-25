import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config();

import { convertWithLlm, loadModels } from "./converter/llmConverter.ts";
import { convertWithRuleBasedExtractor } from "./baselines/ruleBasedExtractor.ts";
import { validatePolicyAgainstProfile } from "./validation/validateShacl.ts";
import { computeItemMetrics } from "./metrics/index.ts";
import type { ConversionResult, CorpusItem } from "./types.ts";

const CORPUS_DIR = fileURLToPath(new URL("./corpus", import.meta.url));
const RESULTS_DIR = fileURLToPath(new URL("../results", import.meta.url));

// Optional filters: --models=a,b  --items=id1,id2  --runs=N (default 3)
const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const list = (name: string): string[] | undefined => arg(name)?.split(",");

const loadCorpus = async (): Promise<CorpusItem[]> => {
  const wanted = list("items");
  const files = (await readdir(CORPUS_DIR)).filter((file) => file.endsWith(".json"));
  const items = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(`${CORPUS_DIR}/${file}`, "utf-8")) as CorpusItem)
  );
  return wanted ? items.filter((item) => wanted.includes(item.id)) : items;
};

// Runs every selected language model (models.json) N times and the rule-based baseline once on
// every corpus item, computes metrics 1-5 per run, and appends one JSON line per run to
// evaluation/results/harness-run-<timestamp>.jsonl as soon as it finishes, so a long run keeps
// its results if it is interrupted. Reference-dependent metrics only run for items that carry
// a `referenceOdrl`. Semantic fidelity is not measured automatically (it needs human raters).
const main = async () => {
  const corpus = await loadCorpus();
  if (corpus.length === 0) {
    console.log(`No corpus items found in ${CORPUS_DIR} (check --items).`);
    return;
  }
  const wantedModels = list("models");
  const models = loadModels().filter((model) => !wantedModels || wantedModels.includes(model.name));
  const runs = Number(arg("runs") ?? 3);

  await mkdir(RESULTS_DIR, { recursive: true });
  const outputPath = `${RESULTS_DIR}/harness-run-${Date.now()}.jsonl`;
  console.log(`Models: ${models.map((m) => m.name).join(", ") || "(none)"}; runs per card: ${runs}; output: ${outputPath}`);

  for (const item of corpus) {
    const resultsByConverter: Record<string, ConversionResult[]> = {
      "rule-based": [convertWithRuleBasedExtractor(item.modelCardContent, item.id)], // deterministic: one run
    };
    for (const model of models) {
      resultsByConverter[model.name] = [];
      for (let run = 0; run < runs; run += 1) {
        try {
          resultsByConverter[model.name].push(await convertWithLlm(model, item.modelCardContent, item.id, run));
        } catch (error) {
          console.error(`${item.id} ${model.name} run ${run} failed: ${error instanceof Error ? error.message : error}`);
        }
      }
    }

    for (const [converter, results] of Object.entries(resultsByConverter)) {
      const repeatedRuns = results.map((r) => r.parsed).filter((policy): policy is NonNullable<typeof policy> => !!policy);
      for (const result of results) {
        const metrics = await computeItemMetrics({
          corpusItemId: item.id,
          converter,
          result,
          reference: item.referenceOdrl,
          repeatedRuns,
          validateProfile: validatePolicyAgainstProfile,
        });
        await appendFile(outputPath, JSON.stringify({ item: item.id, converter, runIndex: result.runIndex, result, metrics }) + "\n");
      }
    }
    console.log(`done: ${item.id}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
