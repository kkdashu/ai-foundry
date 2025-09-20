'use client'

import { useEffect, useRef, useState, forwardRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { MessageCircleIcon, X } from 'lucide-react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Response } from '@/components/ai-elements/response'
import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputActionAddAttachments,
  PromptInputTextarea,
  usePromptInputAttachments,
  } from '@/components/ai-elements/prompt-input'

type ChatBoxProps = {
  variant?: 'floating' | 'embedded'
  title?: string
  className?: string
}

export function ChatBox({ variant = 'floating', title = 'AI 助手', className }: ChatBoxProps) {
  const [open, setOpen] = useState(variant === 'embedded')
  const [localInput, setLocalInput] = useState('')
  const inputRefObj = useRef<HTMLTextAreaElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // image preview state
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragCounter = useRef(0)
  const { toast } = useToast()

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' })
  })
  const isLoading = status === 'submitted' || status === 'streaming'
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    if (error) console.error('ChatBox error:', error)
  }, [error])

  // auto focus after stream completes or when opened/reset
  useEffect(() => {
    if (status === 'ready') {
      setTimeout(() => inputRefObj.current?.focus?.(), 0)
    }
  }, [status])
  useEffect(() => {
    setTimeout(() => inputRefObj.current?.focus?.(), 0)
  }, [open, resetKey])

  // preview keyboard shortcuts: Space/Escape close
  useEffect(() => {
    if (!previewSrc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault()
        setPreviewSrc(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [previewSrc])

  const handleDragEnter: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      dragCounter.current += 1
      setDragActive(true)
    }
  }
  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      setDragActive(true)
    }
  }
  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setDragActive(false)
  }
  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    dragCounter.current = 0
    setDragActive(false)
    // do not preventDefault here; underlying form handles drop
  }

  const showToast = (msg: string) => toast({ description: msg })

  async function convertFilePartsToDataUrls(parts: any[]): Promise<any[]> {
    const results: any[] = []
    for (const p of parts || []) {
      if (p?.type === 'file' && typeof p.url === 'string' && p.url.startsWith('blob:')) {
        try {
          const resp = await fetch(p.url)
          const blob = await resp.blob()
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          results.push({ ...p, url: dataUrl })
        } catch (err) {
          console.error('Failed to convert blob URL to data URL', err)
          results.push(p) // fallback to original; server may ignore
        }
      } else {
        results.push(p)
      }
    }
    return results
  }

  const submitPrompt = async (
    message: { text?: string; files?: any[] },
    _event: React.FormEvent<HTMLFormElement>
  ) => {
    const text = message.text?.trim() ?? ''
    const files = await convertFilePartsToDataUrls(message.files ?? [])
    if (!text && files.length === 0) return
    setLocalInput('')
    try {
      await sendMessage({
        role: 'user',
        parts: [
          ...(text ? [{ type: 'text', text } as const] : []),
          ...files,
        ],
      })
      // Re-mount PromptInput to clear client-side attachments after success
      setResetKey((k) => k + 1)
    } catch (err) {
      console.error('sendMessage failed:', err)
    }
  }

  const panel = (
    <Card
      className={`relative h-full flex flex-col ${className ?? ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={containerRef}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {variant === 'floating' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-6 w-6"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>支持文本与图片消息</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <Conversation>
          <ConversationContent>
            {error && (
              <div className="text-red-500 text-sm">出错了：{error.message}</div>
            )}
            {messages.length === 0 ? (
              <ConversationEmptyState title="开始对话" description="输入消息或选择图片进行对话" />
            ) : (
              messages.map((m) => (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.parts.map((p: any, idx: number) => {
                    if (p.type === 'text') return <Response key={idx}>{p.text}</Response>
                    if (p.type === 'file' && p.mediaType?.startsWith('image/')) {
                      return (
                        <img
                          key={idx}
                          src={p.url}
                          alt={`attachment-${idx}`}
                          className="mt-2 max-w-full max-h-80 object-contain rounded cursor-zoom-in"
                          onClick={() => setPreviewSrc(p.url)}
                        />
                      )
                    }
                    if (p.type === 'file') {
                      return (
                        <a
                          key={idx}
                          href={p.url}
                          download={p.filename || 'download'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 underline text-blue-600 mt-2"
                        >
                          📎 {p.filename || p.mediaType}
                        </a>
                      )
                    }
                    return null
                  })}
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <div className="rounded-xl border-2 border-dashed border-primary/60 bg-background/80 px-6 py-3 text-sm text-muted-foreground">
              松开以上传文件
            </div>
          </div>
        )}

        <div className="p-4 border-t">
          <PromptInput
            key={resetKey}
            // accept any kind of files (images + other)
            accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/json,application/octet-stream"
            multiple
            dropTargetRef={containerRef}
            maxFiles={10}
            maxFileSize={10 * 1024 * 1024}
            onError={(err: any) => {
              const code = (err && typeof err === 'object' && 'code' in err) ? (err as any).code : undefined
              if (code === 'max_files') showToast('超出最大上传数量')
              else if (code === 'max_file_size') showToast('有文件超出大小限制 (10MB)')
              else if (code === 'accept') showToast('文件类型不被接受')
            }}
            onSubmit={(msg, e) => {
              submitPrompt({ text: localInput || msg.text, files: msg.files }, e)
            }}
            className="flex flex-col gap-2"
          >
            <PromptInputAttachments>
              {(file) => <PromptInputAttachment data={file} />}
            </PromptInputAttachments>
            <div className="flex items-center gap-2">
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PasteAwareTextarea
                ref={inputRefObj as any}
                className="flex-1"
                placeholder="输入消息..."
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
              />
              <PromptInputSubmit status={status} />
            </div>
          </PromptInput>
        </div>
        <Dialog open={!!previewSrc} onOpenChange={(v) => !v && setPreviewSrc(null)}>
          <DialogContent className="max-w-[90vw] p-0" onDoubleClick={() => setPreviewSrc(null)}>
            {previewSrc && (
              <img src={previewSrc} alt="preview" className="max-h-[90vh] w-auto object-contain" />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )

  if (variant === 'embedded') return panel

  return (
    <>
      {/* 浮动聊天按钮 */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setOpen(!open)}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
          size="icon"
          aria-label="Open chat"
        >
          <MessageCircleIcon className="h-6 w-6" />
        </Button>
      </div>

      {/* 聊天窗口 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-background border rounded-lg shadow-xl">
          {panel}
        </div>
      )}
    </>
  )
}

export default ChatBox

// Textarea that adds pasted files into PromptInput attachments
const PasteAwareTextarea = forwardRef<HTMLTextAreaElement, React.ComponentProps<typeof PromptInputTextarea>>(function PasteAwareTextarea(
  { onPaste, ...props },
  ref
) {
  const attachments = usePromptInputAttachments()
  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    const items = e.clipboardData?.items
    const files: File[] = []
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file') {
          const f = it.getAsFile()
          if (f) files.push(f)
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      attachments.add(files)
    }
    onPaste?.(e)
  }
  return <PromptInputTextarea ref={ref} onPaste={handlePaste} {...props} />
})
