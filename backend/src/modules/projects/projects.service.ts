import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectStatus, SyncRunStatus } from '@repo-intel/shared';
import { PrismaService } from '../../db/prisma.service';
import { GithubService } from '../github/github.service';
import { CreateProjectDto } from './dto/create-project.dto';

function parseGitHubUrl(url: string) {
  const parsed = new URL(url);
  const [owner, repo] = parsed.pathname
    .replace(/^\/+/, '')
    .replace(/\.git$/, '')
    .split('/');
  return { owner, repo };
}

function previewOneLine(content: string | null): string | null {
  if (!content) {
    return null;
  }
  const single = content.replace(/\s+/g, ' ').trim();
  if (!single) {
    return null;
  }
  const max = 160;
  return single.length > max ? `${single.slice(0, max)}…` : single;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
  ) {}

  listProjects() {
    return this.prisma.project.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async getProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async createProject(dto: CreateProjectDto) {
    const { owner, repo } = parseGitHubUrl(dto.repoUrl);
    let defaultBranch = dto.branch ?? 'main';
    if (!dto.branch) {
      try {
        const metadata = await this.githubService.fetchRepoMetadata(
          owner,
          repo,
        );
        defaultBranch = metadata.default_branch || defaultBranch;
      } catch {
        defaultBranch = 'main';
      }
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        repoUrl: dto.repoUrl,
        repoOwner: owner,
        repoName: repo,
        defaultBranch,
        status: ProjectStatus.SYNCING,
      },
    });
  }

  async getProjectStatus(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        lastCheckedAt: true,
        lastSyncedAt: true,
      },
    });
    if (!project) {
      return null;
    }

    const latestRun = await this.prisma.projectSyncRun.findFirst({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, summaryJson: true },
    });

    const summary = latestRun?.summaryJson as Record<string, unknown> | null;
    const isLive = latestRun?.status === SyncRunStatus.RUNNING;

    return {
      ...project,
      syncRun: isLive
        ? {
            id: latestRun.id,
            phase: typeof summary?.phase === 'string' ? summary.phase : undefined,
            percent:
              typeof summary?.percent === 'number' ? summary.percent : undefined,
            message:
              typeof summary?.message === 'string' ? summary.message : undefined,
            logs: Array.isArray(summary?.logs)
              ? (summary.logs as string[]).slice(-40)
              : [],
          }
        : null,
    };
  }

  async updateProjectStatus(projectId: string, status: ProjectStatus) {
    await this.getProject(projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        status,
        ...(status === ProjectStatus.READY ? { lastSyncedAt: new Date() } : {}),
      },
    });
  }

  async getProjectChats(projectId: string) {
    await this.getProject(projectId);
    const rows = await this.prisma.chat.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true },
        },
      },
    });
    return rows.map(({ messages, ...chat }) => ({
      ...chat,
      lastPreview: previewOneLine(messages[0]?.content ?? null),
    }));
  }

  async deleteProject(projectId: string) {
    await this.getProject(projectId);
    await this.prisma.project.delete({
      where: { id: projectId },
    });
    return { ok: true };
  }
}
