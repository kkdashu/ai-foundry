import { google } from '@ai-sdk/google'
import { streamText, type UIMessage, convertToModelMessages } from 'ai'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // validate API key early to provide helpful error
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing GOOGLE_GENERATIVE_AI_API_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { messages }: { messages: UIMessage[] } = await req.json()

    const result = streamText({
      model: google('gemini-2.5-flash'),
      messages: convertToModelMessages(messages),
      system: '你是一个有用的AI助手，可以帮助用户解答问题和处理图片。请用中文回复。'
    })

    // Return a UIMessage stream response compatible with useChat
    return result.toUIMessageStreamResponse()
  } catch (error) {
    // Print detailed error for debugging and return structured JSON
    const err = error as any
    const payload = {
      error: 'Chat API error',
      name: err?.name,
      message: err?.message ?? 'Unknown error',
      code: err?.code,
      status: err?.status,
      cause: err?.cause ? String(err.cause) : undefined,
      stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined
    }
    console.error('Chat error:', payload)
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
