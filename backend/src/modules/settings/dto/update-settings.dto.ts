import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsIn(['openai', 'openai_compatible', 'ollama'])
  providerType!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  embeddingModel?: string;

  @IsOptional()
  @IsString()
  githubToken?: string;
}
