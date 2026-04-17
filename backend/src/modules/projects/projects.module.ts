import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { IngestionModule } from '../ingestion/ingestion.module';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [IngestionModule, GithubModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
