import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { computeItemMetrics } from "./metrics/index.ts";
import { MATCH_THRESHOLD } from "./metrics/match.ts";
import type { ConversionResult, CorpusItem } from "./types.ts";

const CORPUS_DIR = fileURLToPath(new URL("./corpus", import.meta.url));

// Sensitivity analysis: recomputes the content metrics of a saved run file with the matching threshold
// given in MATCH_THRESHOLD (default 0.5) and writes a new run file in the same format, which
// `npm run aggregate -- <file>` then summarises. Profile conformance is copied from the original record
// (it does not depend on the threshold). Usage: MATCH_THRESHOLD=0.4 npm run rescore -- results/<run>.jsonl
const main = async () => {
  const input = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!input) throw new Error("Pass a harness-run-*.jsonl file.");

  const corpus = new Map<string, CorpusItem>();
  for (const file of (await readdir(CORPUS_DIR)).filter((f) => f.endsWith(".json"))) {
    const item = JSON.parse(await readFile(`${CORPUS_DIR}/${file}`, "utf-8")) as CorpusItem;
    corpus.set(item.id, item);
  }

  const records = (await readFile(input, "utf-8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const runsByKey = new Map<string, ConversionResult["parsed"][]>();
  records.forEach((r) => {
    const key = `${r.item}::${r.converter}`;
    runsByKey.set(key, [...(runsByKey.get(key) ?? []), r.result.parsed]);
  });

  const out: string[] = [];
  for (const record of records) {
    const repeatedRuns = (runsByKey.get(`${record.item}::${record.converter}`) ?? []).filter(
      (policy): policy is NonNullable<typeof policy> => !!policy
    );
    const metrics = await computeItemMetrics({
      corpusItemId: record.item,
      converter: record.converter,
      result: record.result,
      reference: corpus.get(record.item)?.referenceOdrl,
      repeatedRuns,
      validateProfile: async () => record.metrics.profileConformance,
    });
    out.push(JSON.stringify({ ...record, metrics }));
  }

  const outputPath = input.replace(/([^/]+)$/, `rescored-${MATCH_THRESHOLD}-$1`); // not harness-run-*, so the default aggregate ignores it
  await writeFile(outputPath, out.join("\n") + "\n");
  console.log(`threshold ${MATCH_THRESHOLD}: wrote ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
