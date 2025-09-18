import { NextRequest, NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-code';

export async function POST(request: NextRequest) {
  try {
    const { prompt, images, continue: continueConversation, sessionId, permissionMode } = await request.json();

    if (!prompt && (!images || images.length === 0)) {
      return NextResponse.json({ error: 'Prompt or images are required' }, { status: 400 });
    }

    const options: any = {
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
            const chunk = encoder.encode(`data: ${JSON.stringify(message)}\n\n`);
            controller.enqueue(chunk);

            // 保存 session ID 用于后续对话
            if (message.session_id) {
              currentSessionId = message.session_id;
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
          const finalData = {
            type: 'stream_end',
            sessionId: currentSessionId,
            usage: totalUsage,
            totalCost: totalCost
          };

          const finalChunk = encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`);
          controller.enqueue(finalChunk);

        } catch (error) {
          console.error('Stream processing error:', error);
          const errorData = {
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
    return NextResponse.json(
      { error: 'Failed to process request with Claude Code' },
      { status: 500 }
    );
  }
}