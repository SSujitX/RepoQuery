import type {
  ChatModel,
  MessageModel,
  ProjectModel,
  ProjectStatusDto,
  SettingsModel,
} from "../types/app";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

function messageFromApiErrorBody(text: string, status: number): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `Request failed (${status})`;
  }
  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
    if (Array.isArray(parsed.message)) {
      const joined = parsed.message.map((m) => String(m)).join("; ");
      if (joined.trim()) {
        return joined.trim();
      }
    }
  } catch {
    // not JSON — use raw body
  }
  return trimmed;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(messageFromApiErrorBody(text, response.status));
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  getSettings: () => request<SettingsModel | null>("/settings"),
  getSettingsStatus: () =>
    request<{ aiConfigured: boolean; reason?: string }>("/settings/status"),
  updateSettings: (payload: SettingsModel) =>
    request<SettingsModel>("/settings", {
      method: "PUT",
      body: JSON.stringify({
        providerType: payload.providerType,
        apiKey: payload.apiKey ?? "",
        baseUrl: payload.baseUrl ?? "",
        modelName: payload.modelName,
        embeddingModel: payload.embeddingModel,
        githubToken: payload.githubToken ?? "",
      }),
    }),
  getProjects: () => request<ProjectModel[]>("/projects"),
  createProject: (payload: { name: string; repoUrl: string; branch?: string; description?: string }) =>
    request<ProjectModel>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  previewRepo: (repoUrl: string) =>
    request<{
      owner: string;
      repo: string;
      fullName: string;
      defaultBranch: string;
      branches: string[];
    }>(`/projects/repo-preview?repoUrl=${encodeURIComponent(repoUrl)}`),
  deleteProject: (projectId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}`, {
      method: "DELETE",
    }),
  getProject: (projectId: string) => request<ProjectModel>(`/projects/${projectId}`),
  syncProject: (projectId: string) =>
    request<{ status: string; runId: string }>(`/projects/${projectId}/sync`, { method: "POST" }),
  getProjectStatus: (projectId: string) =>
    request<ProjectStatusDto | null>(`/projects/${projectId}/status`),
  getProjectChats: (projectId: string) => request<ChatModel[]>(`/projects/${projectId}/chats`),
  createChat: (projectId: string, title: string) =>
    request<ChatModel>(`/projects/${projectId}/chats`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  deleteAllChats: (projectId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/chats`, {
      method: "DELETE",
    }),
  deleteChat: (projectId: string, chatId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/chats/${chatId}`, {
      method: "DELETE",
    }),
  getChat: (chatId: string) => request<ChatModel>(`/chats/${chatId}`),
  getMessages: (chatId: string) => request<MessageModel[]>(`/chats/${chatId}/messages`),
  createMessage: (chatId: string, content: string, init?: { signal?: AbortSignal }) =>
    request<MessageModel>(`/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
      signal: init?.signal,
    }),
  stopChatGeneration: (chatId: string) =>
    request<{ ok: boolean }>(`/chats/${chatId}/stop`, { method: "POST" }),
  getSyncRuns: (projectId: string) => request(`/projects/${projectId}/sync-runs`),
  getSources: (projectId: string) => request(`/projects/${projectId}/sources`),
};
