export type AiProviderId = 'claude' | 'gemini' | 'openai';

/** One prompt and one text answer — all the skin studio needs from a model. */
export interface AiRequest {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  /** Upper bound for the answer; providers that don't require one ignore it. */
  maxTokens: number;
  signal?: AbortSignal;
}

/** What the user picked in the studio. Keys stay in this browser unless `remember` is off. */
export interface AiSettings {
  provider: AiProviderId;
  remember: boolean;
  keys: Partial<Record<AiProviderId, string>>;
  models: Partial<Record<AiProviderId, string>>;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'claude',
  remember: true,
  keys: {},
  models: {},
};

/** A failed call to a model; the message is meant for the user. */
export class AiError extends Error {}
