import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { IndexingModule } from '../indexing/indexing.module';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [GithubModule, IndexingModule],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
