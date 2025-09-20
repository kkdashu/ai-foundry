import { Trash2, Image, Hash } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
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
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="continue-conversation"
              checked={continueConversation}
              onCheckedChange={setContinueConversation}
            />
            <label
              htmlFor="continue-conversation"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              继续对话上下文
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">权限模式:</label>
            <Select value={permissionMode} onValueChange={setPermissionMode}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bypassPermissions">完全权限 (可修改任何文件)</SelectItem>
                <SelectItem value="acceptEdits">自动接受编辑</SelectItem>
                <SelectItem value="default">默认权限</SelectItem>
                <SelectItem value="plan">仅规划 (不执行)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Hash className="h-3 w-3" />
            会话ID: {sessionId ? sessionId.slice(0, 8) + '...' : '无'}
          </div>

          {totalTokens.total > 0 && (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                总输入: {totalTokens.input.toLocaleString()}
              </Badge>
              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                总输出: {totalTokens.output.toLocaleString()}
              </Badge>
              <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
                总计: {totalTokens.total.toLocaleString()} tokens
              </Badge>
              {totalCost > 0 && (
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                  总成本: ${totalCost.toFixed(4)}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground italic">
            <Image className="h-3 w-3" />
            可通过📎按钮或Ctrl+V粘贴图片
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={onClearSession}
            className="ml-auto"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            清除会话
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}