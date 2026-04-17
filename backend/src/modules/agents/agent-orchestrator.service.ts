import { Injectable } from '@nestjs/common';
import { QuestionType, SourceType } from '@repo-intel/shared';
import { ProvidersService } from '../providers/providers.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { getSearchAgentPrompt } from '../../prompts/search-agent.prompt';
import { getVerifyAgentPrompt } from '../../prompts/verify-agent.prompt';

interface RoutingDecision {
  questionType: QuestionType;
  sources: SourceType[];
  reason: string;
}

import OpenAI from 'openai';

@Injectable()
export class AgentOrchestratorService {
  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly providersService: ProvidersService,
  ) {}

  async answerQuestion(
    projectId: string,
    question: string,
    history: { role: string; content: string }[] = [],
    onProgress?: (text: string) => void,
  ) {
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'searchCodebase',
          description: 'Search repository files, symbols, and indexed code chunks for a keyword.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'searchHistory',
          description: 'Search issues, pull requests, discussions, and commit messages.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'viewFile',
          description: 'View the full content of a specific file by its exactly matched file path.',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'finishAnswer',
          description: 'Provide the final answer and structural evidence once you have enough insight.',
          parameters: {
            type: 'object',
            properties: {
              answer: { type: 'string', description: 'The exact answer text. You MUST include applicable code snippets if the user is asking how to use something or requires implementation details.' },
              evidenceList: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of specific file paths, symbols, or issue links supporting the answer.',
              },
            },
            required: ['answer', 'evidenceList'],
          },
        },
      },
    ];

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: getSearchAgentPrompt(),
      },
      ...(history as any[]),
      {
        role: 'user',
        content: `Question: ${question}`,
      },
    ];

    let loopCount = 0;
    while (loopCount < 10) {
      if (onProgress) onProgress("Synthesizing next steps...");
      loopCount++;
      const message = await this.providersService.completeWithTools(messages, tools);
      if (!message) throw new Error('Provider returned null');

      messages.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          const fn = (toolCall as any).function;
          let toolResult = '';

          if (fn.name === 'finishAnswer') {
            if (onProgress) onProgress("Verifying QA quality of generated answer...");
            try {
              const args = JSON.parse(fn.arguments);

              const checkPrompt = getVerifyAgentPrompt(question, args.answer);

              const verifyResult = await this.providersService.complete([{ role: 'user', content: checkPrompt }]);
              const cleanResult = verifyResult.trim();

              if (cleanResult.toUpperCase().startsWith('VALID')) {
                return {
                  routing: { questionType: 'MIXED', sources: [], reason: 'Iterative tool execution' },
                  evidence: {},
                  answer: `Answer:\n${args.answer}\n\nEvidence:\n${(args.evidenceList ?? []).map((e: string) => `- ${e}`).join('\n')}`,
                  evidenceList: args.evidenceList ?? [],
                };
              } else {
                toolResult = `Verification failed. Reason: ${cleanResult.slice(0, 500)}\nPlease correct the issue, find more code if needed, and try finishAnswer again.`;
              }
            } catch (e) {
              toolResult = 'Error parsing finishAnswer arguments. Provide valid JSON.';
            }
          } else {
            try {
              const args = JSON.parse(fn.arguments);
              if (fn.name === 'searchCodebase') {
                if (onProgress) onProgress(`Searching codebase for: "${args.query}"`);
                const res = await this.retrievalService.searchCodebase(projectId, args.query);
                toolResult = JSON.stringify(res).slice(0, 8000);
              } else if (fn.name === 'searchHistory') {
                if (onProgress) onProgress(`Checking history for issue context...`);
                const res = await this.retrievalService.searchHistory(projectId, args.query);
                toolResult = JSON.stringify(res).slice(0, 8000);
              } else if (fn.name === 'viewFile') {
                const parts = args.path.split('/');
                const shortPath = parts.slice(Math.max(parts.length - 2, 0)).join('/');
                if (onProgress) onProgress(`Analyzing specific file: ${shortPath}`);
                const res = await this.retrievalService.viewFile(projectId, args.path);
                toolResult = res ? (res.contentText ?? '').slice(0, 15000) : 'File not found.';
              } else {
                toolResult = 'Unknown tool.';
              }
            } catch (err: any) {
            toolResult = `Error executing tool: ${err.message}`;
            }
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      } else {
        return {
          routing: { questionType: 'MIXED', sources: [], reason: 'Direct response generated' },
          evidence: {},
          answer: message.content ?? 'No output generated.',
          evidenceList: [],
        };
      }
    }

    return {
      routing: { questionType: 'MIXED', sources: [], reason: 'Exceeded loop limit' },
      evidence: {},
      answer: 'Agent stopped after too many tool execution steps.',
      evidenceList: [],
    };
  }
}
