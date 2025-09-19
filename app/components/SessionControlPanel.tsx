import { PermissionMode } from '../../lib/types/api'

interface SessionControlPanelProps {
  continueConversation: boolean
  setContinueConversation: (value: boolean) => void
  permissionMode: PermissionMode
  setPermissionMode: (value: PermissionMode) => void
  sessionId: string | null
  totalTokens: {
    input: number
    output: number
    total: number
  }
  totalCost: number
  onClearSession: () => void
}

export default function SessionControlPanel({
  continueConversation,
  setContinueConversation,
  permissionMode,
  setPermissionMode,
  sessionId,
  totalTokens,
  totalCost,
  onClearSession
}: SessionControlPanelProps) {
  return (
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
          onClick={onClearSession}
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
  )
}