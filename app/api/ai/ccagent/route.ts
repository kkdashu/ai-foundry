import '@/lib/undici-proxy'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createClaudeCode } from 'ai-sdk-provider-claude-code'
import { getLocalPath } from '@/lib/local/registry'
import path from 'path'

export const maxDuration = 60

function extractLastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => (m as any).role === 'user') as any
  if (!last) return ''
  const parts = (last.parts || []) as any[]
  const texts = parts.filter((p) => p?.type === 'text').map((p) => p.text)
  return texts.join('\n')
}

function isPathLike(str: string) {
  if (typeof str !== 'string') return false
  return str.includes('/') || str.includes('\\')
}

function transformAndValidatePaths(input: any, allowedRoots: string[]) {
  // Returns updatedInput and whether paths are all inside allowed roots
  const transform = (val: any): any => {
    if (!val) return val
    if (typeof val === 'string') {
      if (!isPathLike(val)) return val
      return val
    }
    if (Array.isArray(val)) return val.map(transform)
    if (typeof val === 'object') {
      const out: Record<string, any> = {}
      for (const [k, v] of Object.entries(val)) out[k] = transform(v)
      return out
    }
    return val
  }
  const updated = transform(input)

  const within = (p: string) => {
    try {
      const abs = path.isAbsolute(p) ? p : path.resolve(allowedRoots[0], p)
      const real = path.resolve(abs)
      return allowedRoots.some((root) => real === root || real.startsWith(root + path.sep))
    } catch {
      return false
    }
  }

  const validate = (val: any): boolean => {
    if (!val) return true
    if (typeof val === 'string') {
      if (!isPathLike(val)) return true
      return within(val)
    }
    if (Array.isArray(val)) return val.every(validate)
    if (typeof val === 'object') return Object.values(val).every(validate)
    return true
  }

  return { updatedInput: updated, ok: validate(updated) }
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json()
    const url = new URL(req.url)
    const projectIdFromQuery = url.searchParams.get('projectId') || undefined
    const projectId = req.headers.get('x-project-id') || projectIdFromQuery || undefined
    const ccSessionFromHeader = req.headers.get('x-cc-session') || url.searchParams.get('ccSession') || undefined
    const readonlyFlag = (req.headers.get('x-cc-readonly') || url.searchParams.get('readonly'))?.toString()
    const readonly = readonlyFlag === '1' || readonlyFlag === 'true'

    const cwd = projectId ? await getLocalPath(projectId) : undefined
    const baseCwd = cwd ? path.resolve(cwd) : process.cwd()

    // Provider factory
    const factory = createClaudeCode({ defaultSettings: { logger: false } })

    // Model with sandbox + read-only controls
    const model = factory('sonnet', {
      ...(ccSessionFromHeader ? { resume: ccSessionFromHeader } : {}),
      permissionMode: readonly ? 'plan' : 'bypassPermissions',
      ...(readonly ? { allowedTools: ['Read', 'LS', 'Grep'] } : {}),
      cwd: baseCwd,
      canUseTool: async (_name: string, input: any) => {
        const allowedRoots = [baseCwd]
        const { updatedInput, ok } = transformAndValidatePaths(input, allowedRoots)
        if (!ok) return { behavior: 'deny', message: '路径越界，已拒绝（仅允许项目目录内）' } as any
        return { behavior: 'allow', updatedInput } as any
      },
      
      //env: { CWD: baseCwd },
    })

    const system = '你是 Claude Code，作为只读代码分析与检索助手（除非另有授权）。' +
      (cwd ? `\n[项目上下文] 工作目录：${baseCwd}。所有路径操作需限定在该目录及其子目录内。` : '')

    const result = streamText({
      model,
      system,
      messages: convertToModelMessages(messages),
      onError: ({ error }) => console.error('ccagent stream error:', error),
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    const err = error as any
    const payload = {
      error: 'ccagent API error',
      name: err?.name,
      message: err?.message ?? 'Unknown error',
      code: err?.code,
      status: err?.status ?? err?.statusCode,
      cause: err?.cause ? String(err.cause) : undefined,
      stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
    }
    console.error('ccagent error:', payload)
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
