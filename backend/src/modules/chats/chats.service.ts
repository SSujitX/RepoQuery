import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { Subject, Observable } from 'rxjs';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly settingsService: SettingsService,
  ) {}

  private thoughtStreams = new Map<string, Subject<{ data: string }>>();

  getThoughtStream(chatId: string): Observable<{ data: string }> {
    if (!this.thoughtStreams.has(chatId)) {
      this.thoughtStreams.set(chatId, new Subject<{ data: string }>());
    }
    return this.thoughtStreams.get(chatId)!.asObservable();
  }

  emitThought(chatId: string, text: string) {
    if (!this.thoughtStreams.has(chatId)) {
      this.thoughtStreams.set(chatId, new Subject<{ data: string }>());
    }
    this.thoughtStreams.get(chatId)!.next({ data: text });
  }

  async createChat(projectId: string, title: string) {
    const aiCheck = await this.settingsService.validateAiConfiguration();
    if (!aiCheck.ok) {
      throw new BadRequestException(aiCheck.reason);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.chat.create({
      data: { projectId, title },
    });
  }

  async getChatById(chatId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    return chat;
  }

  /** Ensures the chat exists and belongs to the project (prevents cross-project deletes). */
  private async requireChatInProject(projectId: string, chatId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, projectId },
    });
    if (!chat) {
      throw new NotFoundException('Chat not found for this project');
    }
    return chat;
  }

  async deleteChat(projectId: string, chatId: string) {
    await this.requireChatInProject(projectId, chatId);
    await this.prisma.chat.delete({ where: { id: chatId } });
    return { ok: true as const };
  }

  /** Delete every chat in the project (messages cascade). */
  async deleteAllChatsInProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.prisma.chat.deleteMany({ where: { projectId } });
    return { ok: true as const };
  }

  async getMessages(chatId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    return this.prisma.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(chatId: string, content: string) {
    const aiCheck = await this.settingsService.validateAiConfiguration();
    if (!aiCheck.ok) {
      throw new BadRequestException(aiCheck.reason);
    }

    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    await this.prisma.chatMessage.create({
      data: { chatId, role: 'user', content },
    });

    const chatHistory = await this.prisma.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const compressedHistory = chatHistory.slice(0, -1).map(m => {
      let text = m.content;
      if (m.role === 'assistant') {
        const evidenceIndex = text.indexOf('\n\nEvidence:');
        if (evidenceIndex !== -1) {
          text = text.substring(0, evidenceIndex);
        }
        if (text.length > 500) {
          text = text.substring(0, 500) + '... [truncated for token efficiency]';
        }
      }
      return { role: m.role, content: text };
    });

    const response = await this.orchestrator.answerQuestion(
      chat.projectId,
      content,
      compressedHistory,
      (text: string) => this.emitThought(chatId, text)
    );
    const evidenceList = Array.isArray((response as { evidenceList?: unknown }).evidenceList)
      ? ((response as { evidenceList: string[] }).evidenceList ?? []).filter((s) => typeof s === 'string')
      : [];
    const evidencePayload = {
      ...(typeof response.evidence === 'object' && response.evidence !== null && !Array.isArray(response.evidence)
        ? (response.evidence as Record<string, unknown>)
        : {}),
      evidenceList,
    };
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        chatId,
        role: 'assistant',
        content: response.answer,
        evidenceJson: evidencePayload,
      },
    });

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return assistantMessage;
  }
}
