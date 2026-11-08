/**
 * Access to the Gemini API.
 *
 * Saved credentials take priority over the process environment. Settings
 * changes apply to the next request. Development .env changes require restart.
 * Missing credentials are a normal state; naming offers a local fallback.
 */
import { GoogleGenAI, type GenerateContentConfig, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { readSavedKey } from "./apiKey";

/** Fast, cheap, and multimodal — the right trade-off for filename suggestions. */
export const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Google's rolling alias for the newest Flash model. Used only when the pinned
 * model is retired (the API answers 404), so the app keeps working after a
 * shutdown without a new release.
 */
const FALLBACK_MODEL = "gemini-flash-latest";

/**
 * Models to try, in order. `TIDY_GEMINI_MODEL` lets a developer or tester pin a
 * different model without a code change.
 */
const MODELS = [...new Set([process.env.TIDY_GEMINI_MODEL?.trim(), GEMINI_MODEL, FALLBACK_MODEL].filter((model): model is string => !!model))];

/** Index of the first model that has answered; retired models are not retried. */
let activeModel = 0;

export function getApiKey(): string | undefined {
  const key = readSavedKey() ?? process.env.GEMINI_API_KEY?.trim();
  return key || undefined;
}

/** A configured client, or `null` when no API key is set. */
export function createClient(): GoogleGenAI | null {
  const apiKey = getApiKey();
  return apiKey ? new GoogleGenAI({ apiKey, httpOptions: { timeout: 30000 } }) : null;
}

/**
 * The rolling alias may point at a newer model family with different thinking
 * controls, so the 2.5-specific budget is dropped for it.
 */
function configFor(model: string, config: GenerateContentConfig | undefined): GenerateContentConfig | undefined {
  if (model !== FALLBACK_MODEL || !config?.thinkingConfig) return config;
  const { thinkingConfig: _thinking, ...rest } = config;
  return rest;
}

/**
 * Send a request to the first model that is still available, moving to the next
 * one only when the API reports the model as not found.
 */
export async function generateContent(
  client: GoogleGenAI,
  request: Omit<GenerateContentParameters, "model">,
): Promise<GenerateContentResponse> {
  for (let index = activeModel; ; index += 1) {
    const model = MODELS[index];
    try {
      const response = await client.models.generateContent({ ...request, model, config: configFor(model, request.config) });
      activeModel = index;
      return response;
    } catch (error) {
      const notFound = (error as { status?: number } | null)?.status === 404;
      if (!notFound || index >= MODELS.length - 1) throw error;
    }
  }
}

/** Provider responses can contain request metadata. Never return or log raw errors. */
export function aiErrorMessage(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 400 || status === 401 || status === 403) return "Gemini could not authorize this request. Check your API key and its API access in Settings.";
  if (status === 429) return "Gemini's usage limit was reached. Check your Google API quota or try again later.";
  if (status === 404) return "No supported Gemini model is available for this API project.";
  return "Gemini could not complete the request. Check your connection and API key, then try again.";
}
