'use client'

import React, { useState } from 'react'

interface UploadedImage {
  id: string
  data: string
  mimeType: string
  name: string
  size: number
  preview: string
}

interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

interface Message {
  type: 'user' | 'assistant'
  content: string
  images?: UploadedImage[]
  timestamp: Date
  usage?: TokenUsage
  cost?: number
}

interface ClaudeMessage {
  type: string
  message?: any
  result?: string
  [key: string]: any
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [continueConversation, setContinueConversation] = useState(true)
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'>('bypassPermissions')
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [totalTokens, setTotalTokens] = useState({
    input: 0,
    output: 0,
    total: 0
  })
  const [totalCost, setTotalCost] = useState(0)

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

    const userMessage: Message = {
      type: 'user',
      content: input,
      images: uploadedImages.length > 0 ? uploadedImages : undefined,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setUploadedImages([]) // 清空上传的图片
    setIsLoading(true)

    // 创建一个空的助手消息用于流式更新
    const assistantMessageIndex = messages.length + 1;
    const assistantMessage: Message = {
      type: 'assistant',
      content: '',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/claude-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input,
          images: uploadedImages.length > 0 ? uploadedImages : undefined,
          continue: continueConversation,
          sessionId: sessionId,
          permissionMode: permissionMode
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6) // 移除 'data: ' 前缀
              if (jsonStr.trim()) {
                const data = JSON.parse(jsonStr)

                if (data.type === 'stream_error') {
                  throw new Error(data.error)
                }

                if (data.type === 'stream_end') {
                  // 处理最终的元数据
                  if (data.sessionId) {
                    setSessionId(data.sessionId)
                  }

                  if (data.usage) {
                    setTotalTokens(prev => ({
                      input: prev.input + (data.usage.input_tokens || 0),
                      output: prev.output + (data.usage.output_tokens || 0),
                      total: prev.total + (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
                    }));

                    // 更新消息的使用统计
                    setMessages(prev => prev.map((msg, idx) =>
                      idx === assistantMessageIndex ? {
                        ...msg,
                        usage: data.usage,
                        cost: data.totalCost
                      } : msg
                    ))
                  }

                  if (data.totalCost) {
                    setTotalCost(prev => prev + data.totalCost);
                  }

                  continue
                }

                // 处理 Claude Code 消息
                if (data.type === 'assistant' && data.message?.content) {
                  if (Array.isArray(data.message.content)) {
                    data.message.content.forEach((content: any) => {
                      if (content.type === 'text') {
                        assistantContent += content.text + '\n'
                      }
                    })
                  }
                } else if (data.type === 'result' && data.result) {
                  assistantContent += `Result: ${data.result}\n`
                }

                // 实时更新助手消息内容
                setMessages(prev => prev.map((msg, idx) =>
                  idx === assistantMessageIndex ? {
                    ...msg,
                    content: assistantContent || '正在思考...'
                  } : msg
                ))
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', parseError)
            }
          }
        }
      }

      // 如果没有内容，显示调试信息
      if (!assistantContent.trim()) {
        setMessages(prev => prev.map((msg, idx) =>
          idx === assistantMessageIndex ? {
            ...msg,
            content: 'No response received from Claude Code'
          } : msg
        ))
      }

    } catch (error) {
      console.error('Streaming error:', error)
      setMessages(prev => prev.map((msg, idx) =>
        idx === assistantMessageIndex ? {
          ...msg,
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        } : msg
      ))
    } finally {
      setIsLoading(false)
    }
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
  }

  return (
    <div className="container">
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '2rem' }}>
        Claude Code Web Interface
      </h1>

      {/* 会话控制面板 */}
      <div style={{
        marginBottom: '1rem',
        padding: '1rem',
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={continueConversation}
                onChange={(e) => setContinueConversation(e.target.checked)}
              />
              继续对话上下文
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              权限模式:
              <select
                value={permissionMode}
                onChange={(e) => setPermissionMode(e.target.value as any)}
                style={{
                  background: '#000',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '0.25rem'
                }}
              >
                <option value="bypassPermissions">完全权限 (可修改任何文件)</option>
                <option value="acceptEdits">自动接受编辑</option>
                <option value="default">默认权限</option>
                <option value="plan">仅规划 (不执行)</option>
              </select>
            </label>
          </div>

          <div style={{ fontSize: '0.9rem', color: '#888' }}>
            会话ID: {sessionId ? sessionId.slice(0, 8) + '...' : '无'}
          </div>

          {/* Token 统计显示 */}
          {totalTokens.total > 0 && (
            <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(37, 99, 235, 0.1)',
                padding: '2px 6px',
                borderRadius: '3px',
                color: '#60A5FA'
              }}>
                总输入: {totalTokens.input.toLocaleString()}
              </span>
              <span style={{
                background: 'rgba(34, 197, 94, 0.1)',
                padding: '2px 6px',
                borderRadius: '3px',
                color: '#4ADE80'
              }}>
                总输出: {totalTokens.output.toLocaleString()}
              </span>
              <span style={{
                background: 'rgba(156, 163, 175, 0.1)',
                padding: '2px 6px',
                borderRadius: '3px',
                color: '#9CA3AF',
                fontWeight: 'bold'
              }}>
                总计: {totalTokens.total.toLocaleString()} tokens
              </span>
              {totalCost > 0 && (
                <span style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  color: '#FBBF24'
                }}>
                  总成本: ${totalCost.toFixed(4)}
                </span>
              )}
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>
            💡 可通过📎按钮或Ctrl+V粘贴图片
          </div>

          <button
            onClick={clearSession}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            清除会话
          </button>
        </div>
      </div>

      <div className="chat-interface">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              Welcome! Enter a prompt to start interacting with Claude Code.
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={`message ${message.type}`}>
                <strong>
                  {message.type === 'user' ? 'You' : 'Claude Code'}:
                  {/* 流式响应指示器 */}
                  {isLoading && message.type === 'assistant' && index === messages.length - 1 && (
                    <span className="streaming-indicator">实时响应中</span>
                  )}
                </strong>

                {/* 显示图片（如果有） */}
                {message.images && message.images.length > 0 && (
                  <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {message.images.map((image) => (
                        <img
                          key={image.id}
                          src={image.preview}
                          alt={image.name}
                          style={{
                            maxWidth: '200px',
                            maxHeight: '200px',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            border: '1px solid #444'
                          }}
                          title={image.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 显示文本内容（如果有） */}
                {message.content && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <pre>{message.content}</pre>
                  </div>
                )}

                {/* 如果正在加载且内容为空，显示占位符 */}
                {isLoading && message.type === 'assistant' && !message.content && index === messages.length - 1 && (
                  <div style={{ marginTop: '0.5rem', color: '#888', fontStyle: 'italic' }}>
                    等待 Claude Code 响应...
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                  <span>{message.timestamp.toLocaleTimeString()}</span>

                  {/* 显示 token 使用信息 */}
                  {message.usage && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                      <span style={{
                        background: 'rgba(37, 99, 235, 0.2)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        color: '#60A5FA'
                      }}>
                        输入: {message.usage.input_tokens?.toLocaleString()} tokens
                      </span>
                      <span style={{
                        background: 'rgba(34, 197, 94, 0.2)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        color: '#4ADE80'
                      }}>
                        输出: {message.usage.output_tokens?.toLocaleString()} tokens
                      </span>
                      {message.usage.cache_read_input_tokens && (
                        <span style={{
                          background: 'rgba(168, 85, 247, 0.2)',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          color: '#A78BFA'
                        }}>
                          缓存: {message.usage.cache_read_input_tokens?.toLocaleString()} tokens
                        </span>
                      )}
                      <span style={{
                        background: 'rgba(156, 163, 175, 0.2)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        color: '#9CA3AF',
                        fontWeight: 'bold'
                      }}>
                        总计: {((message.usage.input_tokens || 0) + (message.usage.output_tokens || 0)).toLocaleString()} tokens
                      </span>
                    </div>
                  )}

                  {/* 显示成本信息 */}
                  {message.cost && (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      color: '#FBBF24',
                      fontSize: '0.75rem'
                    }}>
                      成本: ${message.cost.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="message assistant">
              <div className="loading">Claude Code is thinking...</div>
            </div>
          )}
        </div>

        {/* 图片预览区域 */}
        {uploadedImages.length > 0 && (
          <div style={{
            padding: '1rem',
            border: '1px solid #333',
            borderRadius: '8px',
            marginBottom: '1rem',
            background: '#1a1a1a'
          }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#888' }}>
              已上传的图片 ({uploadedImages.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {uploadedImages.map((image) => (
                <div key={image.id} style={{ position: 'relative' }}>
                  <img
                    src={image.preview}
                    alt={image.name}
                    style={{
                      width: '80px',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      border: '1px solid #444'
                    }}
                  />
                  <button
                    onClick={() => removeImage(image.id)}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#666',
                    marginTop: '2px',
                    textAlign: 'center',
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {image.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 固定在底部的输入区域 */}
      <div className="input-container">
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            className="prompt-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            onPaste={handlePaste}
            placeholder="Enter your prompt for Claude Code (Ctrl+V to paste images)..."
            rows={3}
            disabled={isLoading}
            style={{ paddingRight: '50px' }}
          />
          <label
            htmlFor="image-upload"
            style={{
              position: 'absolute',
              right: '10px',
              bottom: '10px',
              background: '#374151',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              color: '#fff',
              transition: 'background 0.2s'
            }}
            title="Upload images"
          >
            📎
          </label>
          <input
            id="image-upload"
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
            disabled={isLoading}
          />
        </div>
        <button
          className="send-button"
          onClick={sendMessage}
          disabled={isLoading || (!input.trim() && uploadedImages.length === 0)}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}