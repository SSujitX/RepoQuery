import { Body, Controller, Delete, Get, Param, Post, Req, Sse } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller()
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post('projects/:id/chats')
  createChat(@Param('id') projectId: string, @Body() dto: CreateChatDto) {
    return this.chatsService.createChat(projectId, dto.title);
  }

  @Delete('projects/:id/chats')
  deleteAllChatsInProject(@Param('id') projectId: string) {
    return this.chatsService.deleteAllChatsInProject(projectId);
  }

  @Get('chats/:chatId')
  getChat(@Param('chatId') chatId: string) {
    return this.chatsService.getChatById(chatId);
  }

  @Get('chats/:chatId/messages')
  getChatMessages(@Param('chatId') chatId: string) {
    return this.chatsService.getMessages(chatId);
  }

  @Post('chats/:chatId/messages')
  createMessage(
    @Param('chatId') chatId: string,
    @Body() dto: CreateMessageDto,
    @Req() req: Request,
  ) {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    req.on('close', onAbort);
    req.on('aborted', onAbort);
    /** Client disconnect: persist "stopped" row even if the handler promise is late vs. fetch abort. */
    req.once('close', () => {
      void this.chatsService.ensureStoppedAssistantIfPendingUser(chatId);
    });
    if (req.aborted) {
      ac.abort();
    }
    return this.chatsService
      .createMessage(chatId, dto.content, ac.signal)
      .finally(() => {
        req.removeListener('close', onAbort);
        req.removeListener('aborted', onAbort);
      });
  }

  @Delete('projects/:id/chats/:chatId')
  deleteChat(@Param('id') projectId: string, @Param('chatId') chatId: string) {
    return this.chatsService.deleteChat(projectId, chatId);
  }

  @Post('chats/:chatId/stop')
  stopChatGeneration(@Param('chatId') chatId: string) {
    return this.chatsService.stopGeneration(chatId);
  }

  @Sse('chats/:chatId/thoughts')
  streamThoughts(@Param('chatId') chatId: string): Observable<{ data: { text: string } }> {
    return this.chatsService.getThoughtStream(chatId).pipe(
      map(payload => ({ data: { text: payload.data } }))
    );
  }
}
