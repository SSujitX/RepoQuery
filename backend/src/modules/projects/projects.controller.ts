import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { PrismaService } from '../../db/prisma.service';
import { GithubService } from '../github/github.service';

function parseGitHubUrl(url: string) {
  try {
    const parsed = new URL(url);
    const [owner, repo] = parsed.pathname
      .replace(/^\/+/, '')
      .replace(/\.git$/, '')
      .split('/');
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly ingestionService: IngestionService,
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
  ) {}

  @Get()
  getProjects() {
    return this.projectsService.listProjects();
  }

  @Post()
  async createProject(@Body() dto: CreateProjectDto) {
    const project = await this.projectsService.createProject(dto);
    void this.ingestionService
      .runProjectSync(project.id, 'initial')
      .catch((error) => {
        this.logger.warn(
          `Auto-sync failed for project ${project.id}: ${String(error)}`,
        );
      });
    return project;
  }

  @Get('repo-preview')
  async previewRepo(@Query('repoUrl') repoUrl: string) {
    if (!repoUrl) {
      throw new BadRequestException('repoUrl is required');
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      throw new BadRequestException('Invalid GitHub repo URL');
    }

    const [metadata, branches] = await Promise.all([
      this.githubService.fetchRepoMetadata(parsed.owner, parsed.repo),
      this.githubService.fetchRepoBranches(parsed.owner, parsed.repo),
    ]);

    return {
      owner: parsed.owner,
      repo: parsed.repo,
      fullName: `${parsed.owner}/${parsed.repo}`,
      defaultBranch: metadata.default_branch,
      branches,
    };
  }

  @Delete(':id')
  deleteProject(@Param('id') projectId: string) {
    return this.projectsService.deleteProject(projectId);
  }

  @Get(':id')
  getProject(@Param('id') projectId: string) {
    return this.projectsService.getProject(projectId);
  }

  @Post(':id/sync')
  syncProject(@Param('id') projectId: string) {
    return this.ingestionService.runProjectSync(projectId, 'manual');
  }

  @Get(':id/status')
  getProjectStatus(@Param('id') projectId: string) {
    return this.projectsService.getProjectStatus(projectId);
  }

  @Get(':id/chats')
  getProjectChats(@Param('id') projectId: string) {
    return this.projectsService.getProjectChats(projectId);
  }

  @Get(':id/sync-runs')
  getSyncRuns(@Param('id') projectId: string) {
    return this.prisma.projectSyncRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
    });
  }

  @Get(':id/sources')
  async getProjectSources(@Param('id') projectId: string) {
    const [files, docs, issues, prs, discussions, commits] = await Promise.all([
      this.prisma.repositoryFile.findMany({
        where: { projectId },
        select: {
          id: true,
          path: true,
          sha: true,
          language: true,
          sizeBytes: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
      this.prisma.repositoryChunk.findMany({
        where: { projectId, sourceType: 'doc' },
        distinct: ['path'],
        select: {
          id: true,
          path: true,
          sourceType: true,
          updatedAt: true,
          chunkText: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
      this.prisma.repositoryIssue.findMany({
        where: { projectId },
        select: {
          githubIssueNumber: true,
          title: true,
          body: true,
          state: true,
          author: true,
          labelsJson: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.repositoryPullRequest.findMany({
        where: { projectId },
        select: {
          githubPrNumber: true,
          title: true,
          body: true,
          state: true,
          author: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.repositoryDiscussion.findMany({
        where: { projectId },
        select: {
          githubDiscussionNumber: true,
          title: true,
          body: true,
          category: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.repositoryCommit.findMany({
        where: { projectId },
        select: {
          commitSha: true,
          message: true,
          author: true,
          committedAt: true,
        },
        orderBy: { committedAt: 'desc' },
        take: 100,
      }),
    ]);

    return { files, docs, issues, prs, discussions, commits };
  }
}
