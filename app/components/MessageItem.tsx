import { User, Bot, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'
import { Message } from '../../lib/types/api'

interface MessageItemProps {
  message: Message
  index: number
  isLoading: boolean
  isLastMessage: boolean
}

export default function MessageItem({ message, index, isLoading, isLastMessage }: MessageItemProps) {
  const isUser = message.type === 'user'

  return (
    <div className={cn(
      "mb-4",
      isUser ? "ml-8" : "mr-8"
    )}>
      <Card className={cn(
        "overflow-hidden",
        isUser ? "bg-primary text-primary-foreground" : "bg-card"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {isUser ? (
              <User className="h-4 w-4" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            <span className="font-semibold">
              {isUser ? 'You' : 'Claude Code'}
            </span>
            {isLoading && !isUser && isLastMessage && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">实时响应中</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {message.images && message.images.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {message.images.map((image) => (
                  <img
                    key={image.id}
                    src={image.preview}
                    alt={image.name}
                    className="max-w-[200px] max-h-[200px] object-contain rounded border"
                    title={image.name}
                  />
                ))}
              </div>
            </div>
          )}

          {message.content && (
            <div className="mb-3">
              <pre className="whitespace-pre-wrap text-sm">{message.content}</pre>
            </div>
          )}

          {isLoading && !isUser && !message.content && isLastMessage && (
            <div className="text-muted-foreground italic">
              等待 Claude Code 响应...
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground mt-3">
            <span>{message.timestamp.toLocaleTimeString()}</span>

            {message.usage && (
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400">
                  输入: {message.usage.input_tokens?.toLocaleString()}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">
                  输出: {message.usage.output_tokens?.toLocaleString()}
                </Badge>
                {message.usage.cache_read_input_tokens && (
                  <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-400">
                    缓存: {message.usage.cache_read_input_tokens?.toLocaleString()}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs bg-gray-500/20 text-gray-400">
                  总计: {((message.usage.input_tokens || 0) + (message.usage.output_tokens || 0)).toLocaleString()}
                </Badge>
              </div>
            )}

            {message.cost && (
              <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-400">
                成本: ${message.cost.toFixed(4)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}