import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import appConfig from './config/app.config';
import { PrismaModule } from './db/prisma.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ChatsModule } from './modules/chats/chats.module';
import { GithubModule } from './modules/github/github.module';
import { HealthModule } from './modules/health/health.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { IndexingModule } from './modules/indexing/indexing.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    SettingsModule,
    ProvidersModule,
    GithubModule,
    ProjectsModule,
    IngestionModule,
    IndexingModule,
    RetrievalModule,
    AgentsModule,
    ChatsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
