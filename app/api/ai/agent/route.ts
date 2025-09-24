import '@/lib/undici-proxy'
import { google } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { streamText, type UIMessage, convertToModelMessages, stepCountIs } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { makeClaudeCodeTool } from '@/lib/agent/tools/claude-code'
import { getLocalPath } from '@/lib/local/registry'
import { createProjectTool, deleteProjectTool, listProjectsTool } from '@/lib/agent/tools/projects'

export const maxDuration = 60

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    try {
      if (value && typeof (value as any).forEach === 'function') {
        const obj: Record<string, any> = {}
        ;(value as any).forEach((v: any, k: string) => (obj[k] = v))
        return JSON.stringify(obj, null, 2)
      }
    } catch {}
    return String(value)
  }
}

export async function POST(req: Request) {
  try {
    const provider = (process.env.AI_AGENT_PROVIDER || 'google').toLowerCase()
    const modelId =
      process.env.AI_AGENT_MODEL ||
      (provider === 'google'
        ? 'gemini-2.5-flash'
        : provider === 'openrouter'
        ? 'openai/gpt-4o-mini'
        : 'gpt-4o-mini')

    // Basic env validation per provider
    if (provider === 'google') {
      console.log('use google provider');
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Missing GOOGLE_GENERATIVE_AI_API_KEY' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } else if (provider === 'openai-compatible') {
      console.log('use openai-compatible provider');
      // baseURL is needed for most OpenAI-compatible providers
      if (!process.env.OPENAI_COMPATIBLE_BASE_URL) {
        return new Response(
          JSON.stringify({ error: 'Missing OPENAI_COMPATIBLE_BASE_URL' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
      // apiKey is optional for some local providers (e.g., LM Studio), so we don't hard-require it
    } else if (provider === 'openrouter') {
      console.log('use openrouter provider');
      if (!process.env.OPENROUTER_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Missing OPENROUTER_API_KEY' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    const { messages }: { messages: UIMessage[] } = await req.json()

    // Resolve per-request cwd from header (project page passes X-Project-Id)
    const url = new URL(req.url)
    const projectIdFromQuery = url.searchParams.get('projectId') || undefined
    const projectId = req.headers.get('x-project-id') || projectIdFromQuery || undefined
    const ccSessionFromHeader = req.headers.get('x-cc-session') || url.searchParams.get('ccSession') || undefined
    const cwd = projectId ? await getLocalPath(projectId) : undefined

    // Debug logs
    const messagesPreview = messages.map((m) => ({
      role: (m as any).role,
      parts: (m as any).parts?.map((p: any) => (p?.type === 'text' ? (p.text?.slice(0, 200) || '') : `[${p?.type}]`)) || [],
    }))
    console.log('[agent] Incoming chat', {
      projectId,
      cwd,
      messages: messagesPreview,
    })

    // Resolve model by provider
    const model = (() => {
      if (provider === 'google') {
        return google(modelId)
      }
      if (provider === 'openai-compatible') {
        const oc = createOpenAICompatible({
          name: 'models/gemini-2.5-pro', //process.env.OPENAI_COMPATIBLE_PROVIDER_NAME || 'custom',
          apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
          baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL || '',
          includeUsage: true,
        })
        return oc.completionModel(modelId)
      }
      if (provider === 'openrouter') {
        const openrouter = createOpenRouter({
          apiKey: process.env.OPENROUTER_API_KEY!,
        })
        return openrouter.chat(modelId)
      }
      // Fallback to google if unknown value provided
      return google(modelId)
    })()

    const result = streamText<any>({
      model,
      system:
        '你是一个多步智能体（Agent）。\n' +
        '- 创建项目：当用户请求时调用 createProject 工具（缺少描述可自动生成）。\n' +
        '- 列出项目：当用户请求查看项目、或删除时需要确认 ID，可调用 listProjects 工具（可按名称过滤，按创建时间排序）。\n' +
        '- 删除项目：当用户请求时调用 deleteProject 工具；如果按名称删除且匹配到多个同名项目，先展示候选项目的 ID/名称/创建时间，向用户确认具体要删除的 ID，再执行删除；不要在歧义情况下直接删除。\n' +
        '- 当需要读取/修改代码、执行命令或进行复杂项目操作时，才调用 claudeCode 工具；否则直接回答。\n' +
        '- 调用工具前先规划步骤并简述意图，返回清晰结果与后续建议。' +
        (cwd
          ? `\n[项目上下文] 你正在本地项目目录下工作：${cwd}。所有文件和命令操作必须限定在此目录及其子目录内，使用相对路径优先。`
          : '') +
        (ccSessionFromHeader
          ? `\n[会话上下文] 如需继续之前的 Claude Code 会话，请在调用 claudeCode 工具时包含 { continueConversation: true, sessionId: '${ccSessionFromHeader}' }。`
          : ''),
      messages: convertToModelMessages(messages),
      // @ts-ignore
      tools: {
        claudeCode: makeClaudeCodeTool({ cwd: cwd || undefined, defaultSessionId: ccSessionFromHeader || undefined, alwaysContinue: true }),
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
      status: err?.status ?? err?.statusCode,
      cause: err?.cause ? String(err.cause) : undefined,
      url: err?.url,
      statusCode: err?.statusCode,
      responseBody: err?.responseBody,
      responseHeaders: err?.responseHeaders,
      data: err?.data,
      stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
    }
    console.error('Agent error:', payload)
    if (err?.responseHeaders || err?.data) {
      console.error('[agent] Upstream responseHeaders:', safeJson(err?.responseHeaders))
      console.error('[agent] Upstream data:', safeJson(err?.data))
    }
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
