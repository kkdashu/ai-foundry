import { NextRequest, NextResponse } from 'next/server';
import { query, Options } from '@anthropic-ai/claude-code';
import {
  ClaudeCodeRequest,
  ClaudeCodeStreamResponse,
  StreamEndMessage,
  StreamErrorMessage,
  SessionIdUpdateMessage,
  ApiErrorResponse
} from '../../../lib/types/api';

export async function POST(request: NextRequest) {
  try {
    const body: ClaudeCodeRequest = await request.json();
    const { prompt, images, continue: continueConversation, sessionId, permissionMode } = body;

    if (!prompt && (!images || images.length === 0)) {
      const errorResponse: ApiErrorResponse = { error: 'Prompt or images are required' };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const options: Options = {
      permissionMode: permissionMode || 'bypassPermissions', // 使用用户选择的权限模式
    };

    // 支持上下文共享
    if (continueConversation) {
      options.continue = true;
    }

    if (sessionId) {
      options.resume = sessionId;
    }

    // 构建消息内容
    let messageContent: any;

    if (images && images.length > 0) {
      // 多模态消息：构建为 AsyncIterable<SDKUserMessage> 格式
      const contentBlocks: any[] = [];

      // 添加文本内容（如果有）
      if (prompt) {
        contentBlocks.push({
          type: 'text',
          text: prompt
        });
      }

      // 添加图片内容
      images.forEach((image: any) => {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mimeType,
            data: image.data
          }
        });
      });

      // 构建 AsyncIterable 格式的消息
      messageContent = (async function* () {
        yield {
          type: 'user' as const,
          session_id: sessionId || '',
          message: {
            role: 'user' as const,
            content: contentBlocks
          },
          parent_tool_use_id: null
        };
      })();
    } else {
      // 纯文本消息
      messageContent = prompt;
    }

    const claudeQuery = query({
      prompt: messageContent,
      options: options
    });

    // 创建流式响应
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let currentSessionId: string | null = null;
        let totalUsage: any = null;
        let totalCost: number = 0;

        try {
          for await (const message of claudeQuery) {
            // 发送流式数据
            const streamMessage: ClaudeCodeStreamResponse = message as ClaudeCodeStreamResponse;
            const chunk = encoder.encode(`data: ${JSON.stringify(streamMessage)}\n\n`);
            controller.enqueue(chunk);

            // 检查并立即发送 session ID 更新
            if (message.session_id && message.session_id !== currentSessionId) {
              currentSessionId = message.session_id;

              // 立即发送 sessionId 更新消息
              const sessionUpdateMessage: SessionIdUpdateMessage = {
                type: 'session_update',
                sessionId: currentSessionId
              };
              const sessionChunk = encoder.encode(`data: ${JSON.stringify(sessionUpdateMessage)}\n\n`);
              controller.enqueue(sessionChunk);
            }

            // 提取 token 使用情况和成本信息
            if (message.type === 'result') {
              if (message.usage) {
                totalUsage = message.usage;
              }
              if (message.total_cost_usd) {
                totalCost = message.total_cost_usd;
              }
            }
          }

          // 发送最终的元数据
          const finalData: StreamEndMessage = {
            type: 'stream_end',
            sessionId: currentSessionId,
            usage: totalUsage,
            totalCost: totalCost
          };

          const finalChunk = encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`);
          controller.enqueue(finalChunk);

        } catch (error) {
          console.error('Stream processing error:', error);
          const errorData: StreamErrorMessage = {
            type: 'stream_error',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };
          const errorChunk = encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`);
          controller.enqueue(errorChunk);
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Claude Code API error:', error);
    const errorResponse: ApiErrorResponse = {
      error: 'Failed to process request with Claude Code'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
