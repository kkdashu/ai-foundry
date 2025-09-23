import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { z } from 'zod'
import { makeClaudeCodeTool } from '@/lib/agent/tools/claude-code'
import { getLocalPath } from '@/lib/local/registry'
import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages, stepCountIs } from 'ai'

const ClaudeCodeInput = z.object({
  task: z.string().min(1),
  permissionMode: z.enum(['bypassPermissions', 'default', 'acceptEdits', 'plan']).optional(),
  continueConversation: z.boolean().optional(),
  sessionId: z.string().optional(),
  projectId: z.string().uuid().optional(),
})

export const aiRouter = createTRPCRouter({
  // Run a Claude Code session non-streaming and return a textual summary.
  claudeCodeRun: publicProcedure
    .input(ClaudeCodeInput)
    .output(z.object({ sessionId: z.string().optional(), summary: z.string(), usage: z.any().optional(), totalCost: z.number().optional() }))
    .mutation(async ({ input }) => {
      const cwd = input.projectId ? await getLocalPath(input.projectId) : undefined
      const tool = makeClaudeCodeTool({ cwd: cwd || undefined, defaultSessionId: input.sessionId })
      const result = await (tool as any).execute({
        task: input.task,
        permissionMode: (input.permissionMode as any) || 'bypassPermissions',
        continueConversation: input.continueConversation,
        sessionId: input.sessionId,
      } as any, {} as any)
      return result as any
    }),

  // Simple agent wrapper (non-streaming). Note: For full streaming chat with tools, use REST /api/ai/agent.
  agentSimple: publicProcedure
    .input(z.object({ prompt: z.string().min(1), projectId: z.string().uuid().optional(), ccSession: z.string().optional() }))
    .output(z.object({ text: z.string(), sessionId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const cwd = input.projectId ? await getLocalPath(input.projectId) : undefined
      const tools = { claudeCode: makeClaudeCodeTool({ cwd: cwd || undefined, defaultSessionId: input.ccSession || undefined, alwaysContinue: true }) }

      const system =
        '你是一个多步智能体（Agent）。\n' +
        '- 仅在需要读取/修改代码、执行命令时调用 claudeCode 工具；否则直接回答。\n' +
        (cwd ? `\n[项目上下文] 你正在本地项目目录下工作：${cwd}。所有文件和命令操作必须限定在此目录及其子目录内。` : '')

      // Build minimal UI messages
      const messages = convertToModelMessages([{ id: 'user', role: 'user', content: [{ type: 'text', text: input.prompt }] } as any])
      const run = streamText<any>({ model: google('gemini-2.5-flash'), system, messages, tools, stopWhen: stepCountIs(3) })

      let currentSessionId: string | undefined
      let lastText = ''
      for await (const m of run as any) {
        if ((m as any)?.session_id) currentSessionId = (m as any).session_id
        if ((m as any)?.type === 'assistant' && (m as any)?.message?.content) {
          const parts = (m as any).message.content
          const textParts = parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
          if (textParts) lastText = textParts
        }
        if ((m as any)?.type === 'result' && (m as any)?.result) {
          lastText = (m as any).result
        }
      }
      return { text: lastText || '任务已完成。', sessionId: currentSessionId }
    }),
})
