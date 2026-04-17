import { Injectable } from '@nestjs/common';
import { SourceType } from '@repo-intel/shared';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class RetrievalService {
  constructor(private readonly prisma: PrismaService) {}

  async retrieveEvidence(
    projectId: string,
    question: string,
    sourceTypes: string[],
  ) {
    const normalizedTypes = sourceTypes.length
      ? sourceTypes
      : [SourceType.CODE];
    const q = question.trim();
    const fileHint = extractLikelyPath(q);
    const symbolHint = extractLikelySymbol(q);

    const [
      fileMatches,
      symbolMatches,
      textChunks,
      issues,
      prs,
      discussions,
      commits,
    ] = await Promise.all([
      normalizedTypes.includes(SourceType.CODE) ||
      normalizedTypes.includes(SourceType.DOC)
        ? this.prisma.repositoryFile.findMany({
            where: {
              projectId,
              ...(fileHint
                ? { path: { contains: fileHint, mode: 'insensitive' } }
                : {}),
            },
            take: 8,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      normalizedTypes.includes(SourceType.CODE)
        ? this.prisma.repositorySymbol.findMany({
            where: {
              projectId,
              ...(symbolHint
                ? { symbolName: { contains: symbolHint, mode: 'insensitive' } }
                : {}),
            },
            include: { file: true },
            take: 8,
          })
        : [],
      this.prisma.repositoryChunk.findMany({
        where: {
          projectId,
          sourceType: { in: normalizedTypes },
          chunkText: {
            contains: q.split(' ').slice(0, 4).join(' '),
            mode: 'insensitive',
          },
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      normalizedTypes.includes(SourceType.ISSUE)
        ? this.prisma.repositoryIssue.findMany({
            where: {
              projectId,
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { body: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 8,
          })
        : [],
      normalizedTypes.includes(SourceType.PR)
        ? this.prisma.repositoryPullRequest.findMany({
            where: {
              projectId,
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { body: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 8,
          })
        : [],
      normalizedTypes.includes(SourceType.DISCUSSION)
        ? this.prisma.repositoryDiscussion.findMany({
            where: {
              projectId,
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { body: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 8,
          })
        : [],
      normalizedTypes.includes(SourceType.COMMIT)
        ? this.prisma.repositoryCommit.findMany({
            where: { projectId, message: { contains: q, mode: 'insensitive' } },
            take: 8,
          })
        : [],
    ]);

    return {
      fileMatches,
      symbolMatches,
      textChunks,
      issues,
      prs,
      discussions,
      commits,
    };
  }

  async searchCodebase(projectId: string, query: string) {
    const q = query.trim();
    if (!q) return { fileMatches: [], symbolMatches: [], chunkMatches: [] };
    const [fileMatches, symbolMatches, chunkMatches] = await Promise.all([
      this.prisma.repositoryFile.findMany({
        where: {
          projectId,
          path: { contains: q, mode: 'insensitive' },
        },
        select: { path: true, language: true },
        take: 10,
        orderBy: { path: 'asc' },
      }),
      this.prisma.repositorySymbol.findMany({
        where: {
          projectId,
          symbolName: { contains: q, mode: 'insensitive' },
        },
        include: { file: { select: { path: true } } },
        take: 10,
      }),
      this.prisma.repositoryChunk.findMany({
        where: {
          projectId,
          chunkText: { contains: q, mode: 'insensitive' },
          sourceType: { in: [SourceType.CODE, SourceType.DOC] },
        },
        select: { path: true, startLine: true, endLine: true, chunkText: true },
        take: 20,
      }),
    ]);
    return { fileMatches, symbolMatches, chunkMatches };
  }

  async searchHistory(projectId: string, query: string) {
    const q = query.trim();
    if (!q) return { issues: [], prs: [], discussions: [], commits: [] };
    const [issues, prs, discussions, commits] = await Promise.all([
      this.prisma.repositoryIssue.findMany({
        where: {
          projectId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { githubIssueNumber: true, title: true, state: true },
        take: 10,
      }),
      this.prisma.repositoryPullRequest.findMany({
        where: {
          projectId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { githubPrNumber: true, title: true, state: true },
        take: 10,
      }),
      this.prisma.repositoryDiscussion.findMany({
        where: {
          projectId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { githubDiscussionNumber: true, title: true, category: true },
        take: 10,
      }),
      this.prisma.repositoryCommit.findMany({
        where: {
          projectId,
          message: { contains: q, mode: 'insensitive' },
        },
        select: { commitSha: true, message: true },
        take: 10,
      }),
    ]);
    return { issues, prs, discussions, commits };
  }

  async viewFile(projectId: string, path: string) {
    const file = await this.prisma.repositoryFile.findFirst({
      where: { projectId, path },
      select: { path: true, contentText: true },
    });
    return file;
  }
}

function extractLikelyPath(question: string) {
  const pathMatch = question.match(/[A-Za-z0-9_\-/]+\.[A-Za-z0-9]+/);
  return pathMatch ? pathMatch[0] : null;
}

function extractLikelySymbol(question: string) {
  const symbolMatch = question.match(
    /\b([A-Z][A-Za-z0-9_]+|[a-z][A-Za-z0-9_]+)\b/,
  );
  return symbolMatch ? symbolMatch[1] : null;
}
