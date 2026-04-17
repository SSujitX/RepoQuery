import { ProjectStatus } from "../enums/project-status.enum";
import { SourceType } from "../enums/source-type.enum";

export type ProviderType = "openai" | "openai_compatible" | "ollama";

export interface SettingsDto {
  providerType: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  modelName: string;
  embeddingModel: string;
  githubToken?: string;
}

export interface ProjectDto {
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

export interface EvidenceRef {
  type: SourceType;
  path?: string;
  symbol?: string;
  ref?: string;
  title?: string;
}
