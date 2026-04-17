import { Injectable, Logger } from '@nestjs/common';
import { ProjectStatus, SyncRunStatus } from '@repo-intel/shared';
import { randomUUID } from 'node:crypto';
import { insertRepositoryChunk } from '../../db/insert-repository-chunk';
import { PrismaService } from '../../db/prisma.service';
import { GithubService } from '../github/github.service';
import { IndexingService } from '../indexing/indexing.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly indexingService: IndexingService,
  ) {}

  async runProjectSync(
    projectId: string,
    reason: 'manual' | 'scheduled' | 'initial',
  ) {
    await this.prisma.projectSyncRun.updateMany({
      where: { projectId, status: SyncRunStatus.RUNNING },
      data: {
        status: SyncRunStatus.FAILED,
        finishedAt: new Date(),
        errorText: 'Cancelled due to a new sync request.',
      },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new Error('Project not found');
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status:
          reason === 'manual'
            ? ProjectStatus.REFRESHING
            : ProjectStatus.SYNCING,
        lastCheckedAt: new Date(),
      },
    });

    const run = await this.prisma.projectSyncRun.create({
      data: {
        projectId,
        status: SyncRunStatus.RUNNING,
        summaryJson: { reason },
      },
    });

    try {
      await this.updateSyncProgress(run.id, {
        phase: 'start',
        percent: 2,
        message: 'Starting repository sync…',
        appendLog: true,
      });

      const metadata = await this.githubService.fetchRepoMetadata(
        project.repoOwner,
        project.repoName,
      );
      await this.updateSyncProgress(run.id, {
        phase: 'metadata',
        percent: 8,
        message: `Loaded metadata for ${project.repoOwner}/${project.repoName}`,
        appendLog: false,
      });
      const defaultBranch = project.defaultBranch || metadata.default_branch;
      await this.updateSyncProgress(run.id, {
        phase: 'fetch_remote',
        percent: 12,
        message: `Fetching tree, issues, PRs, discussions, commits (branch: ${defaultBranch})…`,
        appendLog: false,
      });
      const [tree, issues, prs, discussions, commits] = await Promise.all([
        this.githubService.fetchRepoTree(
          project.repoOwner,
          project.repoName,
          defaultBranch,
        ),
        this.githubService.fetchIssues(project.repoOwner, project.repoName),
        this.githubService.fetchPullRequests(
          project.repoOwner,
          project.repoName,
        ),
        this.githubService.fetchDiscussions(
          project.repoOwner,
          project.repoName,
        ),
        this.githubService.fetchCommits(
          project.repoOwner,
          project.repoName,
          defaultBranch,
        ),
      ]);

      await this.updateSyncProgress(run.id, {
        phase: 'history',
        percent: 35,
        message: `Saving ${issues.length} issues, ${prs.length} PRs, ${discussions.length} discussions, ${commits.length} commits…`,
        appendLog: true,
      });
      await this.persistHistory(projectId, issues, prs, discussions, commits);
      await this.updateSyncProgress(run.id, {
        phase: 'files',
        percent: 40,
        message: 'Fetching and storing repository files…',
        appendLog: false,
      });
      await this.persistTree(
        projectId,
        project.repoOwner,
        project.repoName,
        defaultBranch,
        tree,
        run.id,
      );

      await this.updateSyncProgress(run.id, {
        phase: 'indexing',
        percent: 82,
        message: 'Indexing symbols and code chunks…',
        appendLog: true,
      });
      await this.indexingService.indexProject(projectId);

      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.READY,
          defaultBranch,
          lastSyncedAt: new Date(),
          lastCheckedAt: new Date(),
        },
      });

      await this.prisma.projectSyncRun.update({
        where: { id: run.id },
        data: {
          status: SyncRunStatus.SUCCESS,
          finishedAt: new Date(),
          summaryJson: {
            reason,
            phase: 'done',
            percent: 100,
            message: 'Sync finished successfully.',
            fileCount: tree.filter((node) => node.type === 'blob').length,
            issueCount: issues.length,
            prCount: prs.length,
            discussionCount: discussions.length,
            commitCount: commits.length,
          },
        },
      });

      return { status: 'ok', runId: run.id };
    } catch (error) {
      this.logger.error(error);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.ERROR, lastCheckedAt: new Date() },
      });
      await this.prisma.projectSyncRun.update({
        where: { id: run.id },
        data: {
          status: SyncRunStatus.FAILED,
          finishedAt: new Date(),
          errorText: String(error),
        },
      });
      throw error;
    }
  }

  private async updateSyncProgress(
    runId: string,
    patch: {
      phase: string;
      percent: number;
      message: string;
      appendLog?: boolean;
    },
  ) {
    const run = await this.prisma.projectSyncRun.findUnique({
      where: { id: runId },
      select: { summaryJson: true },
    });
    const prev = (run?.summaryJson as Record<string, unknown>) ?? {};
    const logs = Array.isArray(prev.logs) ? [...(prev.logs as string[])] : [];
    if (patch.appendLog === true) {
      const line = `${new Date().toISOString().slice(11, 19)} ${patch.message}`;
      logs.push(line);
      while (logs.length > 40) {
        logs.shift();
      }
    }
    await this.prisma.projectSyncRun.update({
      where: { id: runId },
      data: {
        summaryJson: {
          ...prev,
          phase: patch.phase,
          percent: Math.min(100, Math.max(0, Math.round(patch.percent))),
          message: patch.message,
          logs,
        },
      },
    });
  }

  private async persistTree(
    projectId: string,
    owner: string,
    repo: string,
    branch: string,
    tree: Array<{ path?: string; sha?: string; type?: string; size?: number }>,
    syncRunId?: string,
  ) {
    const blobs = tree.filter(
      (node) => node.type === 'blob' && node.path && node.sha,
    );
    const docPattern = /(readme|docs\/|\.md$|\.mdx$|\.txt$|\.yaml$|\.yml$)/i;
    const includePattern =
      /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|cs|cpp|c|h|hpp|php|rb|md|mdx|txt|json|yml|yaml|toml|ini|env|sh|ps1|sql)$/i;
    const maxFileSizeBytes = 250_000;
    const candidates = blobs
      .filter((node) => includePattern.test(node.path!))
      .filter((node) => (node.size ?? 0) <= maxFileSizeBytes)
      .slice(0, 250);

    const total = candidates.length || 1;
    let completed = 0;

    await forEachWithConcurrency(candidates, 8, async (node) => {
      const path = node.path!;
      const text = await this.githubService.fetchFileContent(
        owner,
        repo,
        path,
        branch,
      );
      if (!text) {
        completed += 1;
        if (syncRunId && (completed % 12 === 0 || completed === total)) {
          const pct = 40 + Math.round((completed / total) * 38);
          await this.updateSyncProgress(syncRunId, {
            phase: 'files',
            percent: pct,
            message: `Files ${completed}/${total}`,
            appendLog: completed === total || completed % 36 === 0,
          });
        }
        return;
      }
      const upserted = await this.prisma.repositoryFile.upsert({
        where: { projectId_path: { projectId, path } },
        update: {
          sha: node.sha!,
          sizeBytes: node.size ?? text.length,
          contentText: text,
          language: inferLanguage(path),
        },
        create: {
          projectId,
          path,
          sha: node.sha!,
          sizeBytes: node.size ?? text.length,
          contentText: text,
          language: inferLanguage(path),
          lastSeenCommitSha: node.sha!,
        },
      });

      if (docPattern.test(path)) {
        await insertRepositoryChunk(this.prisma, {
          id: randomUUID(),
          projectId,
          fileId: upserted.id,
          sourceType: 'doc',
          path,
          chunkText: text.slice(0, 5000),
        });
      }

      completed += 1;
      if (syncRunId && (completed % 8 === 0 || completed === total)) {
        const pct = 40 + Math.round((completed / total) * 38);
        await this.updateSyncProgress(syncRunId, {
          phase: 'files',
          percent: pct,
          message: `Stored ${completed}/${total} files`,
          appendLog: completed === total || completed % 32 === 0,
        });
      }
    });

    if (syncRunId && candidates.length === 0) {
      await this.updateSyncProgress(syncRunId, {
        phase: 'files',
        percent: 78,
        message: 'No matching source files found in tree (filters may exclude assets).',
        appendLog: true,
      });
    }
  }

  private async persistHistory(
    projectId: string,
    issues: any[],
    prs: any[],
    discussions: any[],
    commits: any[],
  ) {
    for (const issue of issues) {
      await this.prisma.repositoryIssue.upsert({
        where: {
          projectId_githubIssueNumber: {
            projectId,
            githubIssueNumber: issue.number,
          },
        },
        update: {
          title: issue.title,
          body: issue.body,
          state: issue.state,
          author: issue.user?.login,
          labelsJson: issue.labels,
          updatedAt: new Date(issue.updated_at),
        },
        create: {
          projectId,
          githubIssueNumber: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          author: issue.user?.login,
          labelsJson: issue.labels,
          updatedAt: new Date(issue.updated_at),
        },
      });
    }

    for (const pr of prs) {
      await this.prisma.repositoryPullRequest.upsert({
        where: {
          projectId_githubPrNumber: { projectId, githubPrNumber: pr.number },
        },
        update: {
          title: pr.title,
          body: pr.body,
          state: pr.state,
          author: pr.user?.login,
          updatedAt: new Date(pr.updated_at),
        },
        create: {
          projectId,
          githubPrNumber: pr.number,
          title: pr.title,
          body: pr.body,
          state: pr.state,
          author: pr.user?.login,
          updatedAt: new Date(pr.updated_at),
        },
      });
    }

    for (const discussion of discussions) {
      await this.prisma.repositoryDiscussion.upsert({
        where: {
          projectId_githubDiscussionNumber: {
            projectId,
            githubDiscussionNumber: discussion.number,
          },
        },
        update: {
          title: discussion.title,
          body: discussion.body,
          category: discussion.category?.name,
          updatedAt: new Date(discussion.updatedAt),
        },
        create: {
          projectId,
          githubDiscussionNumber: discussion.number,
          title: discussion.title,
          body: discussion.body,
          category: discussion.category?.name,
          updatedAt: new Date(discussion.updatedAt),
        },
      });
    }

    for (const commit of commits) {
      await this.prisma.repositoryCommit.upsert({
        where: {
          projectId_commitSha: { projectId, commitSha: commit.sha },
        },
        update: {
          message: commit.commit.message,
          author: commit.commit.author?.name ?? commit.author?.login,
          committedAt: new Date(
            commit.commit.author?.date ?? commit.commit.committer?.date,
          ),
        },
        create: {
          projectId,
          commitSha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author?.name ?? commit.author?.login,
          committedAt: new Date(
            commit.commit.author?.date ?? commit.commit.committer?.date,
          ),
        },
      });
    }
  }
}

function inferLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext) {
    return 'text';
  }
  return ext;
}

async function forEachWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        continue;
      }
      await fn(item);
    }
  });
  await Promise.all(workers);
}
