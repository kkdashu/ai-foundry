'use client'

import React, { useState, useEffect } from 'react'
import SessionControlPanel from './components/SessionControlPanel'
import MessageItem from './components/MessageItem'
import ImagePreview from './components/ImagePreview'
import MessageInput from './components/MessageInput'
import { ClaudeCodeAPI } from '../lib/api/claude-code'
import {
  UploadedImage,
  TokenUsage,
  Message,
  PermissionMode,
  SessionState,
  isStreamEndMessage,
  isStreamErrorMessage,
  isSessionIdUpdateMessage,
  isClaudeCodeStreamMessage
} from '../lib/types/api'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(() => {
    // 从localStorage读取保存的sessionId
    if (typeof window !== 'undefined') {
      return localStorage.getItem('claude-code-session-id')
    }
    return null
  })
  const [continueConversation, setContinueConversation] = useState(true)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('bypassPermissions')
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [totalTokens, setTotalTokens] = useState({
    input: 0,
    output: 0,
    total: 0
  })
  const [totalCost, setTotalCost] = useState(0)

  // 保存sessionId到localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('claude-code-session-id', sessionId)
    }
  }, [sessionId])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件')
        return
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('图片大小不能超过10MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        const base64Data = result.split(',')[1] // Remove data:image/...;base64, prefix

        const newImage: UploadedImage = {
          id: Math.random().toString(36).substr(2, 9),
          data: base64Data,
          mimeType: file.type,
          name: file.name,
          size: file.size,
          preview: result
        }

        setUploadedImages(prev => [...prev, newImage])
      }
      reader.readAsDataURL(file)
    })

    // Reset file input
    event.target.value = ''
  }

  const removeImage = (imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId))
  }

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (item.type.startsWith('image/')) {
        event.preventDefault() // 阻止默认粘贴行为

        const file = item.getAsFile()
        if (!file) continue

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          alert('图片大小不能超过10MB')
          continue
        }

        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          const base64Data = result.split(',')[1] // Remove data:image/...;base64, prefix

          const newImage: UploadedImage = {
            id: Math.random().toString(36).substr(2, 9),
            data: base64Data,
            mimeType: file.type,
            name: file.name || `pasted-image-${Date.now()}.${file.type.split('/')[1]}`,
            size: file.size,
            preview: result
          }

          setUploadedImages(prev => [...prev, newImage])

          // 显示成功提示
          const toast = document.createElement('div')
          toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #22c55e;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          `
          toast.textContent = '图片已从剪贴板添加'
          document.body.appendChild(toast)

          setTimeout(() => {
            document.body.removeChild(toast)
          }, 3000)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const sendMessage = async () => {
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return

    // Validate request
    const request = ClaudeCodeAPI.createRequest(
      input,
      uploadedImages,
      continueConversation,
      sessionId,
      permissionMode
    )

    const validationError = ClaudeCodeAPI.validateRequest(request)
    if (validationError) {
      alert(validationError)
      return
    }

    const userMessage: Message = {
      type: 'user',
      content: input,
      images: uploadedImages.length > 0 ? uploadedImages : undefined,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setUploadedImages([])
    setIsLoading(true)

    const assistantMessageIndex = messages.length + 1;
    const assistantMessage: Message = {
      type: 'assistant',
      content: '',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantMessage])

    let assistantContent = ''

    await ClaudeCodeAPI.sendMessage(
      request,
      (message) => {
        if (isSessionIdUpdateMessage(message)) {
          // Handle immediate session ID update
          console.log('Received sessionId update:', message.sessionId)
          setSessionId(message.sessionId)
        } else if (isStreamEndMessage(message)) {
          // Handle stream end
          if (message.sessionId) {
            setSessionId(message.sessionId)
          }

          if (message.usage) {
            setTotalTokens(prev => ({
              input: prev.input + (message.usage!.input_tokens || 0),
              output: prev.output + (message.usage!.output_tokens || 0),
              total: prev.total + (message.usage!.input_tokens || 0) + (message.usage!.output_tokens || 0)
            }))

            setMessages(prev => prev.map((msg, idx) =>
              idx === assistantMessageIndex ? {
                ...msg,
                usage: message.usage!,
                cost: message.totalCost
              } : msg
            ))
          }

          if (message.totalCost) {
            setTotalCost(prev => prev + message.totalCost)
          }
        } else if (isClaudeCodeStreamMessage(message)) {
          // Handle Claude Code messages
          if (message.type === 'assistant' && message.message?.content) {
            if (Array.isArray(message.message.content)) {
              message.message.content.forEach((content: any) => {
                if (content.type === 'text') {
                  assistantContent += content.text + '\n'
                }
              })
            }
          } else if (message.type === 'result' && message.result) {
            assistantContent += `Result: ${message.result}\n`
          }

          // Update assistant message content
          setMessages(prev => prev.map((msg, idx) =>
            idx === assistantMessageIndex ? {
              ...msg,
              content: assistantContent || '正在思考...'
            } : msg
          ))
        }
      },
      (error) => {
        console.error('API Error:', error)
        setMessages(prev => prev.map((msg, idx) =>
          idx === assistantMessageIndex ? {
            ...msg,
            content: `Error: ${error}`
          } : msg
        ))
        setIsLoading(false)
      }
    )

    // Handle empty content case
    if (!assistantContent.trim()) {
      setMessages(prev => prev.map((msg, idx) =>
        idx === assistantMessageIndex ? {
          ...msg,
          content: 'No response received from Claude Code'
        } : msg
      ))
    }

    setIsLoading(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearSession = () => {
    setMessages([])
    setSessionId(null)
    setContinueConversation(true)
    setUploadedImages([])
    setTotalTokens({
      input: 0,
      output: 0,
      total: 0
    })
    setTotalCost(0)
    // 清除localStorage中的sessionId
    localStorage.removeItem('claude-code-session-id')
  }

  return (
    <div className="container">
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '2rem' }}>
        Claude Code Web Interface
      </h1>

      <SessionControlPanel
        continueConversation={continueConversation}
        setContinueConversation={setContinueConversation}
        permissionMode={permissionMode}
        setPermissionMode={setPermissionMode}
        sessionId={sessionId}
        totalTokens={totalTokens}
        totalCost={totalCost}
        onClearSession={clearSession}
      />

      <div className="chat-interface">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              Welcome! Enter a prompt to start interacting with Claude Code.
            </div>
          ) : (
            messages.map((message, index) => (
              <MessageItem
                key={index}
                message={message}
                index={index}
                isLoading={isLoading}
                isLastMessage={index === messages.length - 1}
              />
            ))
          )}
          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="message assistant">
              <div className="loading">Claude Code is thinking...</div>
            </div>
          )}
        </div>

        <ImagePreview
          uploadedImages={uploadedImages}
          onRemoveImage={removeImage}
        />
      </div>

      <MessageInput
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        uploadedImages={uploadedImages}
        onSendMessage={sendMessage}
        onKeyPress={handleKeyPress}
        onPaste={handlePaste}
        onImageUpload={handleImageUpload}
      />
    </div>
  )
}