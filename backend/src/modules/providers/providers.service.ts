import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ProvidersService {
  constructor(private readonly settingsService: SettingsService) {}

  async getRuntimeSettings() {
    const settings = await this.settingsService.getSettings();
    if (!settings) {
      return null;
    }
    return {
      providerType: settings.providerType,
      apiKey: settings.apiKey ?? '',
      baseUrl: settings.baseUrl ?? '',
      modelName: settings.modelName,
      embeddingModel: settings.embeddingModel,
    };
  }

  async complete(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: { signal?: AbortSignal },
  ) {
    const runtime = await this.getRuntimeSettings();
    if (!runtime) {
      return '';
    }
    const normalizedBaseUrl = normalizeBaseUrl(runtime.baseUrl || '');
    const client = new OpenAI({
      apiKey: runtime.apiKey || 'unused',
      baseURL: normalizedBaseUrl || undefined,
    });
    const model = runtime.modelName || 'gpt-4o-mini';

    // `signal` aborts the HTTP request to the provider (OpenAI, OpenAI-compatible, Ollama /v1, etc.).
    // It does not interrupt work that is already running purely inside this process without await.
    const response = await client.chat.completions.create(
      {
        model,
        messages,
        temperature: 0,
        max_tokens: 3000,
      },
      { signal: options?.signal },
    );

    return response.choices[0]?.message?.content ?? '';
  }

  async completeWithTools(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
    options?: { signal?: AbortSignal },
  ) {
    const runtime = await this.getRuntimeSettings();
    if (!runtime) {
      return null;
    }
    const normalizedBaseUrl = normalizeBaseUrl(runtime.baseUrl || '');
    const client = new OpenAI({
      apiKey: runtime.apiKey || 'unused',
      baseURL: normalizedBaseUrl || undefined,
    });
    const model = runtime.modelName || 'gpt-4o-mini';

    const response = await client.chat.completions.create(
      {
        model,
        messages,
        temperature: 0,
        max_tokens: 3000,
        tools: tools?.length ? tools : undefined,
        tool_choice: tools?.length ? 'auto' : undefined,
      },
      { signal: options?.signal },
    );

    return response.choices[0]?.message ?? null;
  }
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/g, '');
}
