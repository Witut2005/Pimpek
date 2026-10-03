import { Injectable } from '@angular/core';
import { AiError, AiProviderId, AiRequest } from '../../models/ai.model';

/** Rate limits and an overloaded model usually pass after a moment. */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 529]);
const RETRY_DELAYS_MS = [2000, 6000];

/** The HTTP call a provider needs; the base class sends it. */
export interface ProviderCall {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

interface ErrorBody {
  error?: { message?: string };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * One AI vendor, called straight from the browser with the user's own key.
 * Subclasses only describe their request and response; sending, retrying and turning failures
 * into messages for the user happens here.
 */
@Injectable()
export abstract class AiProvider<TResponse = unknown> {
  abstract readonly id: AiProviderId;
  /** Model family the user recognises, e.g. "Claude". */
  abstract readonly label: string;
  abstract readonly vendor: string;
  abstract readonly defaultModel: string;
  /** Suggestions for the model field; any other id the vendor knows works too. */
  abstract readonly models: readonly string[];
  /** Where the user gets a key. */
  abstract readonly keyUrl: string;
  abstract readonly keyPlaceholder: string;

  protected abstract buildCall(request: AiRequest): ProviderCall;

  /** The answer's text, or undefined when the model sent none (blocked, empty). */
  protected abstract readText(body: TResponse): string | undefined;

  /** Gemini reports a wrong key as a plain 400, so vendors can widen this. */
  protected isKeyRejected(status: number, _detail: string): boolean {
    return status === 401 || status === 403;
  }

  async complete(request: AiRequest): Promise<string> {
    const call = this.buildCall(request);
    for (let attempt = 0; ; attempt++) {
      const response = await this.send(call, request.signal);
      if (response.ok) {
        const text = this.readText((await response.json()) as TResponse)?.trim();
        if (!text) throw new AiError(`${this.label} nie odesłał odpowiedzi. Spróbuj jeszcze raz.`);
        return text;
      }
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !RETRY_STATUSES.has(response.status)) {
        throw await this.failure(response, request.model);
      }
      await wait(delay, request.signal);
    }
  }

  private async send(call: ProviderCall, signal?: AbortSignal): Promise<Response> {
    try {
      return await fetch(call.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...call.headers },
        body: JSON.stringify(call.body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new AiError(`Nie udało się połączyć z ${this.vendor}. Sprawdź internet i spróbuj ponownie.`);
    }
  }

  private async failure(response: Response, model: string): Promise<AiError> {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    const detail = body.error?.message ?? '';
    if (this.isKeyRejected(response.status, detail)) {
      return new AiError(`${this.vendor} nie przyjął klucza API. Sprawdź, czy jest wklejony w całości.`);
    }
    if (response.status === 404) {
      return new AiError(`Model „${model}” nie istnieje albo Twój klucz nie ma do niego dostępu.`);
    }
    if (response.status === 429) {
      return new AiError(`Limit zapytań do ${this.vendor} się wyczerpał. Odczekaj chwilę albo sprawdź swój plan.`);
    }
    return new AiError(`${this.label} zgłosił błąd (${response.status})${detail ? `: ${detail}` : '.'}`);
  }
}
