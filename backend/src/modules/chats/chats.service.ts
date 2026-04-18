import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  /** Shown when the user stops generation; keep in sync with frontend `ASSISTANT_STOPPED_MESSAGE`. */
  static readonly ASSISTANT_STOPPED_CONTENT = 'You stopped this response.';

  private activeGenerations = new Map<string, AbortController>();

  private static isAbortError(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) {
      return true;
    }
    let cur: unknown = error;
    for (let depth = 0; depth < 6 && cur != null; depth++) {
      if (cur instanceof Error) {
        if (cur.name === 'AbortError') {
          return true;
        }
        const code = (cur as NodeJS.ErrnoException).code;
        if (code === 'ERR_CANCELED' || code === 'ABORT_ERR') {
          return true;
        }
      }
      if (typeof cur === 'object' && cur !== null && 'name' in cur) {
        const n = (cur as { name: string }).name;
        if (n === 'AbortError') {
          return true;
        }
      }
      if (typeof cur === 'object' && cur !== null && 'code' in cur) {
        const c = (cur as { code: string }).code;
        if (c === 'ERR_CANCELED' || c === 'ABORT_ERR') {
          return true;
        }
      }
      if (typeof cur === 'object' && cur !== null && 'cause' in cur) {
        cur = (cur as { cause: unknown }).cause;
        continue;
      }
      break;
    }
    return false;
  }

  private static formatProviderFailure(error: unknown): string {
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      const nested = e['error'];
      if (nested && typeof nested === 'object' && nested !== null) {
        const m = (nested as Record<string, unknown>)['message'];
        if (typeof m === 'string' && m.trim()) {
          return m.trim();
        }
      }
      const msg = e['message'];
      if (typeof msg === 'string' && msg.trim()) {
        return msg.trim();
      }
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return 'AI provider request failed.';
  }

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

  async stopGeneration(chatId: string) {
    const ac = this.activeGenerations.get(chatId);
    if (ac) {
      ac.abort();
    }
    await this.ensureStoppedAssistantIfPendingUser(chatId);
    return { ok: true as const };
  }

  /**
   * If the latest message is still the user's (assistant reply not persisted yet), append the
   * stopped assistant row. Idempotent: safe if called from both `catch` and `req.close`.
   */
  async ensureStoppedAssistantIfPendingUser(chatId: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const last = await tx.chatMessage.findFirst({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
          });
          if (!last) {
            return null;
          }
          if (last.role === 'assistant') {
            if (last.content === ChatsService.ASSISTANT_STOPPED_CONTENT) {
              return last;
            }
            return null;
          }
          const created = await tx.chatMessage.create({
            data: {
              chatId,
              role: 'assistant',
              content: ChatsService.ASSISTANT_STOPPED_CONTENT,
              evidenceJson: {},
            },
          });
          await tx.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      if (error && error.code === 'P2034') {
        const last = await this.prisma.chatMessage.findFirst({
          where: { chatId },
          orderBy: { createdAt: 'desc' },
        });
        if (last && last.role === 'assistant' && last.content === ChatsService.ASSISTANT_STOPPED_CONTENT) {
          return last;
        }
      }
      throw error;
    }
  }

  async createMessage(chatId: string, content: string, abortSignal?: AbortSignal) {
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

    const internalAc = new AbortController();
    this.activeGenerations.set(chatId, internalAc);

    const onReqAbort = () => internalAc.abort();
    if (abortSignal?.aborted) {
      internalAc.abort();
    } else if (abortSignal) {
      abortSignal.addEventListener('abort', onReqAbort);
    }

    try {
      if (internalAc.signal.aborted) {
      const row = await this.ensureStoppedAssistantIfPendingUser(chatId);
      if (row) {
        return row;
      }
      const latest = await this.prisma.chatMessage.findFirst({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
      });
      if (latest?.role === 'assistant') {
        return latest;
      }
      throw new BadGatewayException('Could not record stopped message.');
    }

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

    let response: Awaited<ReturnType<AgentOrchestratorService['answerQuestion']>>;
    try {
      response = await this.orchestrator.answerQuestion(
        chat.projectId,
        content,
        compressedHistory,
        (text: string) => this.emitThought(chatId, text),
        internalAc.signal,
      );
    } catch (err) {
      if (ChatsService.isAbortError(err, internalAc.signal)) {
        const row = await this.ensureStoppedAssistantIfPendingUser(chatId);
        if (row) {
          return row;
        }
        const latest = await this.prisma.chatMessage.findFirst({
          where: { chatId },
          orderBy: { createdAt: 'desc' },
        });
        if (latest?.role === 'assistant') {
          return latest;
        }
        throw new BadGatewayException('Could not record stopped message.');
      }
      const detail = ChatsService.formatProviderFailure(err);
      throw new BadGatewayException(
        `AI provider error: ${detail}`,
      );
    }

    // Double check abort signal before saving the final message.
    if (internalAc.signal.aborted) {
      const row = await this.ensureStoppedAssistantIfPendingUser(chatId);
      if (row) {
        return row;
      }
      const latest = await this.prisma.chatMessage.findFirst({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
      });
      if (latest?.role === 'assistant') {
        return latest;
      }
      throw new BadGatewayException('Could not record stopped message.');
    }

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
    } finally {
      if (abortSignal) {
        abortSignal.removeEventListener('abort', onReqAbort);
      }
      if (this.activeGenerations.get(chatId) === internalAc) {
        this.activeGenerations.delete(chatId);
      }
    }
  }
}
