import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { AgentOrchestratorService } from './agent-orchestrator.service';

@Module({
  imports: [RetrievalModule, ProvidersModule],
  providers: [AgentOrchestratorService],
  exports: [AgentOrchestratorService],
})
export class AgentsModule {}
