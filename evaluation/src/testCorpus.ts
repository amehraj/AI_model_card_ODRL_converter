import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validatePolicyAgainstProfile } from "./validation/validateShacl.ts";
import type { CorpusItem } from "./types.ts";

const CORPUS_DIR = fileURLToPath(new URL("./corpus", import.meta.url));

// Checks that every reference policy in the corpus conforms to the profile shapes.
const main = async () => {
  const files = (await readdir(CORPUS_DIR)).filter((file) => file.endsWith(".json"));
  let failures = 0;
  for (const file of files) {
    const item = JSON.parse(await readFile(`${CORPUS_DIR}/${file}`, "utf-8")) as CorpusItem;
    if (!item.referenceOdrl) {
      console.log(`skip ${item.id} (no reference)`);
      continue;
    }
    const result = await validatePolicyAgainstProfile(item.referenceOdrl);
    if (!result.conforms) failures += 1;
    console.log(`${result.conforms ? "ok  " : "FAIL"} ${item.id}`, result.conforms ? "" : result.violations.slice(0, 3));
  }
  process.exitCode = failures ? 1 : 0;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
