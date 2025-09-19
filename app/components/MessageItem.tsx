import { Message } from '../../lib/types/api'

interface MessageItemProps {
  message: Message
  index: number
  isLoading: boolean
  isLastMessage: boolean
}

export default function MessageItem({ message, index, isLoading, isLastMessage }: MessageItemProps) {
  return (
    <div key={index} className={`message ${message.type}`}>
      <strong>
        {message.type === 'user' ? 'You' : 'Claude Code'}:
        {isLoading && message.type === 'assistant' && isLastMessage && (
          <span className="streaming-indicator">实时响应中</span>
        )}
      </strong>

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

      {message.content && (
        <div style={{ marginTop: '0.5rem' }}>
          <pre>{message.content}</pre>
        </div>
      )}

      {isLoading && message.type === 'assistant' && !message.content && isLastMessage && (
        <div style={{ marginTop: '0.5rem', color: '#888', fontStyle: 'italic' }}>
          等待 Claude Code 响应...
        </div>
      )}

      <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <span>{message.timestamp.toLocaleTimeString()}</span>

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
  )
}