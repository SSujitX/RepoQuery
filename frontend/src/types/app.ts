import { ProjectStatus, SourceType } from "@repo-intel/shared";

export type ProviderType = "openai" | "openai_compatible" | "ollama";

export interface ProviderProfileModel {
  apiKey?: string;
  baseUrl?: string;
  modelName: string;
  embeddingModel: string;
}

export interface SettingsModel {
  providerType: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  modelName: string;
  embeddingModel: string;
  githubToken?: string;
  providerProfiles?: Record<ProviderType, ProviderProfileModel>;
}

export interface ProjectModel {
  id: string;
  name: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  status: ProjectStatus;
  lastSyncedAt: string | null;
  lastCheckedAt: string | null;
}

export interface ProjectSyncRunProgressDto {
  id: string;
  phase?: string;
  percent?: number;
  message?: string;
  logs: string[];
}

export interface ProjectStatusDto {
  id: string;
  status: ProjectStatus;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  syncRun: ProjectSyncRunProgressDto | null;
}

export interface ChatModel {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Latest message preview for chat list UI */
  lastPreview?: string | null;
}

export interface MessageModel {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  evidenceJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface SourceEvidence {
  type: SourceType;
  path?: string;
  symbol?: string;
  ref?: string;
  title?: string;
}
