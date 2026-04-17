import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

type ProviderType = 'openai' | 'openai_compatible' | 'ollama';

type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  embeddingModel: string;
};

const PROVIDER_DEFAULTS: Record<ProviderType, Omit<ProviderConfig, 'apiKey'>> = {
  openai: {
    baseUrl: '',
    modelName: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
  },
  openai_compatible: {
    baseUrl: 'https://openrouter.ai/api/v1',
    modelName: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    modelName: 'llama3.1:8b',
    embeddingModel: 'nomic-embed-text',
  },
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeProviderType(value: string | undefined): ProviderType {
    if (value === 'openai_compatible' || value === 'ollama') {
      return value;
    }
    return 'openai';
  }

  private getProviderDefaults(providerType: ProviderType): ProviderConfig {
    return {
      apiKey: '',
      ...PROVIDER_DEFAULTS[providerType],
    };
  }

  private profileToConfig(
    profile: {
      apiKeyEncrypted: string | null;
      baseUrl: string | null;
      modelName: string;
      embeddingModel: string;
    } | null,
    providerType: ProviderType,
  ): ProviderConfig {
    const defaults = this.getProviderDefaults(providerType);
    if (!profile) {
      return defaults;
    }
    return {
      apiKey: profile.apiKeyEncrypted ?? '',
      baseUrl: profile.baseUrl ?? defaults.baseUrl,
      modelName: profile.modelName || defaults.modelName,
      embeddingModel: profile.embeddingModel || defaults.embeddingModel,
    };
  }

  private async getBaseSettingsRow() {
    return this.prisma.settings.findFirst({
      orderBy: { createdAt: 'asc' },
    });
  }

  private async ensureBaseSettingsRow(providerType: ProviderType) {
    const existing = await this.getBaseSettingsRow();
    if (existing) {
      return existing;
    }

    const defaults = this.getProviderDefaults(providerType);
    return this.prisma.settings.create({
      data: {
        providerType,
        apiKeyEncrypted: '',
        baseUrl: defaults.baseUrl,
        modelName: defaults.modelName,
        embeddingModel: defaults.embeddingModel,
        githubTokenEncrypted: '',
      },
    });
  }

  async getSettings() {
    const settings = await this.getBaseSettingsRow();

    if (!settings) {
      return null;
    }

    const selectedProvider = this.normalizeProviderType(settings.providerType);
    const profiles = await this.prisma.providerProfile.findMany();
    const profileMap = new Map(profiles.map((profile) => [profile.providerType, profile]));

    const openai = this.profileToConfig(
      profileMap.get('openai') ?? null,
      'openai',
    );
    const openaiCompatible = this.profileToConfig(
      profileMap.get('openai_compatible') ?? null,
      'openai_compatible',
    );
    const ollama = this.profileToConfig(
      profileMap.get('ollama') ?? null,
      'ollama',
    );
    const selectedConfig =
      selectedProvider === 'openai_compatible'
        ? openaiCompatible
        : selectedProvider === 'ollama'
          ? ollama
          : openai;

    return {
      id: settings.id,
      providerType: selectedProvider,
      apiKey: selectedConfig.apiKey,
      baseUrl: selectedConfig.baseUrl,
      modelName: selectedConfig.modelName,
      embeddingModel: selectedConfig.embeddingModel,
      githubToken: settings.githubTokenEncrypted ?? '',
      providerProfiles: {
        openai,
        openai_compatible: openaiCompatible,
        ollama,
      },
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  async upsertSettings(dto: UpdateSettingsDto) {
    const providerType = this.normalizeProviderType(dto.providerType);
    const defaults = this.getProviderDefaults(providerType);
    const normalizedModelName = (dto.modelName ?? '').trim() || defaults.modelName;
    const normalizedEmbeddingModel =
      (dto.embeddingModel ?? '').trim() || defaults.embeddingModel;
    const normalizedBaseUrl =
      (dto.baseUrl ?? '').trim() ||
      (providerType === 'openai' ? '' : defaults.baseUrl);

    const baseSettings = await this.ensureBaseSettingsRow(providerType);

    await this.prisma.providerProfile.upsert({
      where: { providerType },
      create: {
        providerType,
        apiKeyEncrypted: dto.apiKey ?? '',
        baseUrl: normalizedBaseUrl,
        modelName: normalizedModelName,
        embeddingModel: normalizedEmbeddingModel,
      },
      update: {
        apiKeyEncrypted: dto.apiKey ?? '',
        baseUrl: normalizedBaseUrl,
        modelName: normalizedModelName,
        embeddingModel: normalizedEmbeddingModel,
      },
    });

    await this.prisma.settings.update({
      where: { id: baseSettings.id },
      data: {
        providerType,
        // Keep these fields mirrored for backward compatibility.
        apiKeyEncrypted: dto.apiKey ?? '',
        baseUrl: normalizedBaseUrl,
        modelName: normalizedModelName,
        embeddingModel: normalizedEmbeddingModel,
        githubTokenEncrypted: dto.githubToken ?? baseSettings.githubTokenEncrypted ?? '',
      },
    });

    return this.getSettings();
  }

  async validateAiConfiguration() {
    const settings = await this.getSettings();
    if (!settings) {
      return {
        ok: false,
        reason: 'AI provider is not configured. Please connect AI in Settings.',
      };
    }

    if (
      !settings.providerType ||
      !settings.modelName ||
      !settings.embeddingModel
    ) {
      return {
        ok: false,
        reason: 'AI provider is not configured. Please connect AI in Settings.',
      };
    }

    const requiresApiKey = settings.providerType !== 'ollama';
    if (
      requiresApiKey &&
      (!settings.apiKey || settings.apiKey.trim().length === 0)
    ) {
      return {
        ok: false,
        reason:
          'AI API key is missing. Please connect AI in Settings before chatting.',
      };
    }

    if (
      settings.providerType === 'openai_compatible' &&
      (!settings.baseUrl || settings.baseUrl.trim().length === 0)
    ) {
      return {
        ok: false,
        reason:
          'Base URL is required for OpenAI-compatible provider in Settings.',
      };
    }

    if (
      settings.providerType === 'ollama' &&
      (!settings.baseUrl || settings.baseUrl.trim().length === 0)
    ) {
      return {
        ok: false,
        reason: 'Base URL is required for Ollama provider in Settings.',
      };
    }

    return { ok: true as const };
  }
}
