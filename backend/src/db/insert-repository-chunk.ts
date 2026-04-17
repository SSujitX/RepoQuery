import { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';

/** Placeholder 3-dim vector until real embeddings are written. */
const placeholderEmbedding = Prisma.raw(`'[0.0,0.0,0.0]'::vector`);

/**
 * Inserts a repository_chunks row with proper parameter binding.
 * Do not use $executeRawUnsafe for chunk_text — source code breaks Prisma's JSON parameter encoding.
 */
export function insertRepositoryChunk(
  prisma: PrismaService,
  row: {
    id: string;
    projectId: string;
    fileId: string;
    sourceType: string;
    path: string;
    chunkText: string;
  },
) {
  return prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO repository_chunks
        (id, project_id, file_id, source_type, path, symbol_name, start_line, end_line, chunk_text, embedding, updated_at)
      VALUES
        (
          ${row.id},
          ${row.projectId},
          ${row.fileId},
          ${row.sourceType},
          ${row.path},
          NULL,
          NULL,
          NULL,
          ${row.chunkText},
          ${placeholderEmbedding},
          NOW()
        )
    `,
  );
}
