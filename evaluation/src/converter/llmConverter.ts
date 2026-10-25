import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { MODEL_CARD_TO_ODRL_SYSTEM_PROMPT } from "../../../server/prompts/modelCardToOdrl.prompt.ts";
import type { ConversionResult, ModelCardContent } from "../types.ts";

// One language model, reached through an OpenAI-compatible chat-completions endpoint (Ollama,
// a company-hosted proxy, ...). Same call as server/llm/modelCardOdrlConverter.ts.
export interface ModelConfig {
  name: string; // label used in the results
  baseURL?: string; // literal URL (local servers)
  baseURLEnv?: string; // name of the environment variable that holds the URL (hosted servers; keeps the URL out of the repository)
  model: string; // model identifier sent to the endpoint
  apiKeyEnv?: string; // name of the environment variable holding the key (never the key itself)
  temperature?: number; // default 0, like the server; set only for the variability experiment
  stream?: boolean; // read the answer as a stream: keeps the connection alive for slow (reasoning) models behind a gateway that closes idle requests after about 90 s; same request otherwise
  promptVariant?: "without-rule-10"; // ablation: the prompt without the worked example and the omit-empty rule (rule 10)
}

const DEFAULT_TEMPERATURE = 0;
const TIMEOUT_MS = 40 * 60 * 1000; // hosted models need 6-17 minutes per card
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
export const PROMPT_SHA256 = sha256(MODEL_CARD_TO_ODRL_SYSTEM_PROMPT);

// Ablation variant: the production prompt without rule 10 (worked example and omit-empty rule), with the
// final rule renumbered. Used only to measure what rule 10 contributes.
const PROMPT_WITHOUT_RULE_10 = (() => {
  const start = MODEL_CARD_TO_ODRL_SYSTEM_PROMPT.indexOf("10. **Worked example");
  const end = MODEL_CARD_TO_ODRL_SYSTEM_PROMPT.indexOf("11. **Final Output**");
  if (start < 0 || end < 0) throw new Error("Rule 10 not found in the prompt; update the ablation variant.");
  return (
    MODEL_CARD_TO_ODRL_SYSTEM_PROMPT.slice(0, start) +
    MODEL_CARD_TO_ODRL_SYSTEM_PROMPT.slice(end).replace("11. **Final Output**", "10. **Final Output**")
  );
})();

export const loadModels = (): ModelConfig[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL("../../models.json", import.meta.url)), "utf-8"));

export const convertWithLlm = async (
  config: ModelConfig,
  modelCardContent: ModelCardContent,
  corpusItemId: string,
  runIndex: number
): Promise<ConversionResult> => {
  const baseURL = config.baseURLEnv ? process.env[config.baseURLEnv] : config.baseURL;
  if (!baseURL) throw new Error(`No base URL for model "${config.name}" (set ${config.baseURLEnv ?? "baseURL"}).`);
  const client = new OpenAI({
    baseURL,
    apiKey: (config.apiKeyEnv && process.env[config.apiKeyEnv]) || "not-needed", // Ollama ignores the key
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });

  const temperature = config.temperature ?? DEFAULT_TEMPERATURE;
  const prompt = config.promptVariant === "without-rule-10" ? PROMPT_WITHOUT_RULE_10 : MODEL_CARD_TO_ODRL_SYSTEM_PROMPT;
  const started = Date.now();
  const request = {
    model: config.model,
    messages: [
      { role: "system" as const, content: prompt },
      { role: "user" as const, content: JSON.stringify(modelCardContent) },
    ],
    response_format: { type: "json_object" as const },
    temperature,
  };
  let raw = "";
  if (config.stream) {
    const stream = await client.chat.completions.create({ ...request, stream: true });
    for await (const chunk of stream) raw += chunk.choices[0]?.delta?.content ?? "";
  } else {
    const completion = await client.chat.completions.create(request);
    raw = completion.choices[0]?.message?.content ?? "";
  }
  return {
    ...parseConversionResult(config.name, corpusItemId, runIndex, raw),
    meta: {
      model: config.model,
      temperature,
      promptSha256: sha256(prompt),
      promptVariant: config.promptVariant,
      date: new Date().toISOString(),
      durationMs: Date.now() - started,
    },
  };
};

export const parseConversionResult = (
  converter: ConversionResult["converter"],
  corpusItemId: string,
  runIndex: number,
  raw: string
): ConversionResult => {
  try {
    return { converter, corpusItemId, runIndex, raw, parsed: JSON.parse(raw) };
  } catch (err) {
    return {
      converter,
      corpusItemId,
      runIndex,
      raw,
      parsed: null,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
};
