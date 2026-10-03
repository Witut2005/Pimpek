import { Injectable } from '@angular/core';
import { AiRequest } from '../../models/ai.model';
import { AiProvider, ProviderCall } from './ai-provider';

interface ClaudeResponse {
  content?: { type: string; text?: string }[];
}

/** Anthropic Messages API. */
@Injectable({ providedIn: 'root' })
export class ClaudeProvider extends AiProvider<ClaudeResponse> {
  readonly id = 'claude';
  readonly label = 'Claude';
  readonly vendor = 'Anthropic';
  readonly defaultModel = 'claude-sonnet-5-5';
  readonly models = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5'];
  readonly keyUrl = 'https://console.anthropic.com/settings/keys';
  readonly keyPlaceholder = 'sk-ant-…';

  protected buildCall({ apiKey, model, system, prompt, maxTokens }: AiRequest): ProviderCall {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Anthropic refuses browser calls unless asked for explicitly; the key is the user's own.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      },
    };
  }

  protected readText(body: ClaudeResponse): string | undefined {
    return body.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
  }
}
