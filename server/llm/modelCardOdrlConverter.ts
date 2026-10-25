import OpenAI from "openai";
import { MODEL_CARD_TO_ODRL_SYSTEM_PROMPT } from "../prompts/modelCardToOdrl.prompt.ts";

// Works with any OpenAI-compatible chat-completions endpoint: a local Ollama server (the default)
// or a company-hosted model behind a URL and API key. Switch by changing the LLM_* variables in
// server/.env and restarting the server.
//
// The client is built on first use, not at import time, because dotenv.config() runs after the
// route modules are imported.
let client: OpenAI | undefined;

const getClient = () => {
  client ??= new OpenAI({
    baseURL: process.env.LLM_BASE_URL ?? "http://localhost:11434/v1",
    // Ollama ignores the key, but the SDK rejects an empty one.
    apiKey: process.env.LLM_API_KEY || "not-needed",
  });
  return client;
};

export const convertModelCardToOdrl = async (modelCardJson: string): Promise<string> => {
  const completion = await getClient().chat.completions.create({
    model: process.env.LLM_MODEL ?? "qwen2.5:7b-instruct",
    messages: [
      { role: "system", content: MODEL_CARD_TO_ODRL_SYSTEM_PROMPT },
      { role: "user", content: modelCardJson },
    ],
    response_format: { type: "json_object" },
    // Deterministic decoding: less run-to-run variation in the generated policy.
    temperature: 0,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("The language model returned an empty response.");
  }
  return content;
};
