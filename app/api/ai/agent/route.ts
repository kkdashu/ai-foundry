import '@/lib/undici-proxy'
import { google } from '@ai-sdk/google'
import { streamText, type UIMessage, convertToModelMessages, stepCountIs } from 'ai'
import { claudeCodeTool } from '@/lib/agent/tools/claude-code'
import { createProjectTool, deleteProjectTool, listProjectsTool } from '@/lib/agent/tools/projects'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing GOOGLE_GENERATIVE_AI_API_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { messages }: { messages: UIMessage[] } = await req.json()

    const result = streamText<any>({
      model: google('gemini-2.5-flash'),
      system:
        '你是一个多步智能体（Agent）。\n' +
        '- 创建项目：当用户请求时调用 createProject 工具（缺少描述可自动生成）。\n' +
        '- 列出项目：当用户请求查看项目、或删除时需要确认 ID，可调用 listProjects 工具（可按名称过滤，按创建时间排序）。\n' +
        '- 删除项目：当用户请求时调用 deleteProject 工具；如果按名称删除且匹配到多个同名项目，先展示候选项目的 ID/名称/创建时间，向用户确认具体要删除的 ID，再执行删除；不要在歧义情况下直接删除。\n' +
        '- 当需要读取/修改代码、执行命令或进行复杂项目操作时，才调用 claudeCode 工具；否则直接回答。\n' +
        '- 调用工具前先规划步骤并简述意图，返回清晰结果与后续建议。',
      messages: convertToModelMessages(messages),
      // @ts-ignore
      tools: {
        claudeCode: claudeCodeTool,
        createProject: createProjectTool,
        deleteProject: deleteProjectTool,
        listProjects: listProjectsTool,
      },
      // // 允许多步：模型可多次调用工具，直到满足停止条件
      stopWhen: stepCountIs(5),
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    const err = error as any
    const payload = {
      error: 'Agent API error',
      name: err?.name,
      message: err?.message ?? 'Unknown error',
      code: err?.code,
      status: err?.status,
      cause: err?.cause ? String(err.cause) : undefined,
      stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
    }
    console.error('Agent error:', payload)
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
