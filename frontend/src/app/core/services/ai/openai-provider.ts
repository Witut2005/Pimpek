import { Injectable } from '@angular/core';
import { AiRequest } from '../../models/ai.model';
import { AiProvider, ProviderCall } from './ai-provider';

interface OpenAiResponse {
  choices?: { message?: { content?: string | null } }[];
}

/** OpenAI Chat Completions API. */
@Injectable({ providedIn: 'root' })
export class OpenAiProvider extends AiProvider<OpenAiResponse> {
  readonly id = 'openai';
  readonly label = 'ChatGPT';
  readonly vendor = 'OpenAI';
  readonly defaultModel = 'gpt-5';
  readonly models = ['gpt-5', 'gpt-5-mini'];
  readonly keyUrl = 'https://platform.openai.com/api-keys';
  readonly keyPlaceholder = 'sk-…';

  protected buildCall({ apiKey, model, system, prompt }: AiRequest): ProviderCall {
    // No token limit: reasoning models count their thinking in it and would cut the SVG short.
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { authorization: `Bearer ${apiKey}` },
      body: {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      },
    };
  }

  protected readText(body: OpenAiResponse): string | undefined {
    return body.choices?.[0]?.message?.content ?? undefined;
  }
}
