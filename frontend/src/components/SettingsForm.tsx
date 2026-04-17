import { useEffect, useMemo, useState } from "react";
import type { ProviderType, SettingsModel } from "../types/app";
import { ProviderSelector } from "./ProviderSelector";

type Props = {
  initialValue?: SettingsModel | null;
  aiStatus?: { aiConfigured: boolean; reason?: string } | null;
  onSubmit: (value: SettingsModel) => Promise<void>;
};

const defaultSettings: SettingsModel = {
  providerType: "openai",
  apiKey: "",
  baseUrl: "",
  modelName: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  githubToken: "",
};

const providerDefaults: Record<ProviderType, { baseUrl: string; modelName: string; embeddingModel: string }> = {
  openai: {
    baseUrl: "",
    modelName: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
  },
  openai_compatible: {
    baseUrl: "https://openrouter.ai/api/v1",
    modelName: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    modelName: "llama3.1:8b",
    embeddingModel: "nomic-embed-text",
  },
};

function getProviderConfigFromSettings(settings: SettingsModel | null | undefined, providerType: ProviderType) {
  const fromProfiles = settings?.providerProfiles?.[providerType];
  const defaults = providerDefaults[providerType];
  return {
    apiKey: fromProfiles?.apiKey ?? "",
    baseUrl: fromProfiles?.baseUrl ?? defaults.baseUrl,
    modelName: fromProfiles?.modelName ?? defaults.modelName,
    embeddingModel: fromProfiles?.embeddingModel ?? defaults.embeddingModel,
  };
}

function buildFormState(initialValue: SettingsModel | null | undefined): SettingsModel {
  if (!initialValue) {
    return defaultSettings;
  }

  const selectedProvider = initialValue.providerType;
  const selectedConfig = getProviderConfigFromSettings(initialValue, selectedProvider);
  return {
    ...defaultSettings,
    providerType: selectedProvider,
    apiKey: initialValue.apiKey ?? selectedConfig.apiKey ?? "",
    baseUrl: initialValue.baseUrl ?? selectedConfig.baseUrl ?? "",
    modelName: initialValue.modelName || selectedConfig.modelName,
    embeddingModel: initialValue.embeddingModel || selectedConfig.embeddingModel,
    githubToken: initialValue.githubToken ?? "",
    providerProfiles: initialValue.providerProfiles,
  };
}

export function SettingsForm({ initialValue, aiStatus, onSubmit }: Props) {
  const [form, setForm] = useState<SettingsModel>(() => buildFormState(initialValue));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(initialValue));
  }, [initialValue]);

  const requiresApiKey = form.providerType !== "ollama";
  const requiresBaseUrl =
    form.providerType === "openai_compatible" || form.providerType === "ollama";
  const localAiConfigured =
    Boolean(form.providerType) &&
    Boolean(form.modelName.trim()) &&
    Boolean(form.embeddingModel.trim()) &&
    (!requiresApiKey || Boolean((form.apiKey ?? "").trim())) &&
    (!requiresBaseUrl || Boolean((form.baseUrl ?? "").trim()));
  const aiConfigured = aiStatus?.aiConfigured ?? localAiConfigured;
  const providerHints = useMemo(() => providerDefaults[form.providerType], [form.providerType]);

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setLocalError(null);
        setLocalSuccess(null);
        const normalized: SettingsModel = {
          ...form,
          modelName: form.modelName.trim() || providerHints.modelName,
          embeddingModel: form.embeddingModel.trim() || providerHints.embeddingModel,
          baseUrl:
            (form.baseUrl ?? "").trim() ||
            (requiresBaseUrl ? providerHints.baseUrl : ""),
        };

        if (requiresBaseUrl && !(normalized.baseUrl ?? "").trim()) {
          setLocalError("Base URL is required for this provider.");
          return;
        }
        setSaving(true);
        try {
          await onSubmit(normalized);
          setForm((prev) => ({ ...prev, ...normalized }));
          setLocalSuccess("Settings saved.");
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim()
              ? error.message
              : "Failed to save settings. Check backend logs and try again.";
          setLocalError(message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <section className="settings-card">
        <div className="settings-card-head">
          <h3>AI Provider</h3>
          <span className={`settings-pill ${aiConfigured ? "settings-pill-ok" : "settings-pill-warn"}`}>
            {aiConfigured ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="muted settings-help">
          Chat requires AI provider configuration. Connect OpenAI, compatible endpoint, or Ollama.
        </p>
        {!aiConfigured && aiStatus?.reason ? (
          <p className="error-text">{aiStatus.reason}</p>
        ) : null}
        <ProviderSelector
          value={form.providerType}
          onChange={(providerType) => {
            setLocalError(null);
            setLocalSuccess(null);
            const nextConfig = getProviderConfigFromSettings(initialValue ?? form, providerType);
            setForm((prev) => ({
              ...prev,
              providerType,
              apiKey: nextConfig.apiKey,
              baseUrl: nextConfig.baseUrl,
              modelName: nextConfig.modelName,
              embeddingModel: nextConfig.embeddingModel,
            }));
          }}
        />
        <label className="field">
          API Key {requiresApiKey ? "" : "(optional for Ollama)"}
          <input
            type="password"
            autoComplete="new-password"
            placeholder={requiresApiKey ? "sk-..." : "optional"}
            value={form.apiKey ?? ""}
            onChange={(event) => {
              setLocalError(null);
              setLocalSuccess(null);
              setForm((prev) => ({ ...prev, apiKey: event.target.value }));
            }}
          />
        </label>
        <label className="field">
          Base URL {requiresBaseUrl ? "" : "(optional)"}
          <input
            placeholder={
              form.providerType === "ollama"
                ? "http://localhost:11434/v1"
                : form.providerType === "openai_compatible"
                  ? "https://openrouter.ai/api/v1"
                  : "optional (leave empty for OpenAI default)"
            }
            value={form.baseUrl ?? ""}
            onChange={(event) => {
              setLocalError(null);
              setLocalSuccess(null);
              setForm((prev) => ({ ...prev, baseUrl: event.target.value }));
            }}
          />
        </label>
        <label className="field">
          Chat Model Name
          <input
            placeholder={providerHints.modelName}
            value={form.modelName}
            onChange={(event) => {
              setLocalError(null);
              setLocalSuccess(null);
              setForm((prev) => ({ ...prev, modelName: event.target.value }));
            }}
          />
        </label>
        <label className="field">
          Embedding Model
          <input
            placeholder={providerHints.embeddingModel}
            value={form.embeddingModel}
            onChange={(event) => {
              setLocalError(null);
              setLocalSuccess(null);
              setForm((prev) => ({ ...prev, embeddingModel: event.target.value }));
            }}
          />
        </label>
        <p className="muted settings-help">No separate embedding URL is needed, only embedding model name.</p>
        {localError ? <p className="error-text">{localError}</p> : null}
        {localSuccess ? <p className="muted">{localSuccess}</p> : null}
      </section>

      <section className="settings-card">
        <div className="settings-card-head">
          <h3>GitHub Integration</h3>
          <span className={`settings-pill ${(form.githubToken ?? "").trim() ? "settings-pill-ok" : ""}`}>
            {(form.githubToken ?? "").trim() ? "Token added" : "Public repos mode"}
          </span>
        </div>
        <p className="muted settings-help">
          GitHub token is optional for public repositories but helps with higher rate limits.
        </p>
        <label className="field">
          GitHub Token (optional)
          <input
            type="password"
            autoComplete="new-password"
            placeholder="ghp_..."
            value={form.githubToken ?? ""}
            onChange={(event) => {
              setLocalError(null);
              setLocalSuccess(null);
              setForm((prev) => ({ ...prev, githubToken: event.target.value }));
            }}
          />
        </label>
      </section>

      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
