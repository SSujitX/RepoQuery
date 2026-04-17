import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsUrl()
  repoUrl!: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
