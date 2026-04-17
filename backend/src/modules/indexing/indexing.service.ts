import { Injectable } from '@nestjs/common';
import { SourceType } from '@repo-intel/shared';
import { randomUUID } from 'node:crypto';
import { insertRepositoryChunk } from '../../db/insert-repository-chunk';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class IndexingService {
  constructor(private readonly prisma: PrismaService) {}

  async indexProject(projectId: string) {
    const files = await this.prisma.repositoryFile.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      take: 120,
    });
    await this.prisma.repositorySymbol.deleteMany({ where: { projectId } });

    for (const file of files) {
      const symbolMatches = Array.from(
        file.contentText.matchAll(
          /(export\s+)?(function|class|interface|const)\s+([A-Za-z0-9_]+)/g,
        ),
      );

      for (const symbol of symbolMatches) {
        const linesBefore = file.contentText.slice(0, symbol.index ?? 0);
        const startLine = linesBefore.split('\n').length;
        await this.prisma.repositorySymbol.create({
          data: {
            projectId,
            fileId: file.id,
            symbolName: symbol[3],
            symbolType: symbol[2],
            startLine,
            endLine: Math.min(
              startLine + 20,
              file.contentText.split('\n').length,
            ),
          },
        });
      }
    }

    await this.prisma.repositoryChunk.deleteMany({
      where: { projectId, sourceType: SourceType.CODE },
    });
    for (const file of files) {
      const chunks = chunkText(file.contentText, 1200);
      const cappedChunks = chunks.slice(0, 20);
      for (let index = 0; index < cappedChunks.length; index += 1) {
        await insertRepositoryChunk(this.prisma, {
          id: randomUUID(),
          projectId,
          fileId: file.id,
          sourceType: SourceType.CODE,
          path: file.path,
          chunkText: cappedChunks[index],
        });
      }
    }
  }
}

function chunkText(content: string, chunkSize: number) {
  const normalized = content.trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  for (let cursor = 0; cursor < normalized.length; cursor += chunkSize) {
    chunks.push(normalized.slice(cursor, cursor + chunkSize));
  }
  return chunks;
}
