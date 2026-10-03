import { inject, InjectionToken } from '@angular/core';
import { AiProvider } from './ai-provider';
import { ClaudeProvider } from './claude-provider';
import { GeminiProvider } from './gemini-provider';
import { OpenAiProvider } from './openai-provider';

/** Every vendor the user can pick, in the order the studio shows them. A new one only goes here. */
export const AI_PROVIDERS = new InjectionToken<readonly AiProvider[]>('AI_PROVIDERS', {
  providedIn: 'root',
  factory: () => [inject(ClaudeProvider), inject(GeminiProvider), inject(OpenAiProvider)],
});
