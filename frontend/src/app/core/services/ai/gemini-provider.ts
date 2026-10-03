import { Injectable } from '@angular/core';
import { AiRequest } from '../../models/ai.model';
import { AiProvider, ProviderCall } from './ai-provider';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
}

/** Google Generative Language API (Gemini). */
@Injectable({ providedIn: 'root' })
export class GeminiProvider extends AiProvider<GeminiResponse> {
  readonly id = 'gemini';
  readonly label = 'Gemini';
  readonly vendor = 'Google';
  // Same models the backend uses for food ratings.
  readonly defaultModel = 'gemini-3.8-flash';
  readonly models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
  readonly keyUrl = 'https://aistudio.google.com/apikey';
  readonly keyPlaceholder = 'AIza…';

  protected buildCall({ apiKey, model, system, prompt }: AiRequest): ProviderCall {
    // No maxOutputTokens: on thinking models it also caps the thinking and cuts the SVG short.
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'x-goog-api-key': apiKey },
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      },
    };
  }

  protected readText(body: GeminiResponse): string | undefined {
    return body.candidates?.[0]?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('');
  }

  protected override isKeyRejected(status: number, detail: string): boolean {
    return super.isKeyRejected(status, detail) || (status === 400 && /api key/i.test(detail));
  }
}
