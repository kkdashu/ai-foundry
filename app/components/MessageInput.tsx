import React from 'react'
import { Paperclip, Send } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { UploadedImage } from '../../lib/types/api'

interface MessageInputProps {
  input: string
  setInput: (value: string) => void
  isLoading: boolean
  uploadedImages: UploadedImage[]
  onSendMessage: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  onPaste: (e: React.ClipboardEvent) => void
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function MessageInput({
  input,
  setInput,
  isLoading,
  uploadedImages,
  onSendMessage,
  onKeyPress,
  onPaste,
  onImageUpload
}: MessageInputProps) {
  return (
    <div className="flex gap-4 p-4 border-t bg-background/80 backdrop-blur-sm">
      <div className="flex-1 relative">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyPress}
          onPaste={onPaste}
          placeholder="Enter your prompt for Claude Code (Ctrl+V to paste images)..."
          className="min-h-[100px] pr-12 resize-none"
          disabled={isLoading}
        />
        <label
          htmlFor="image-upload"
          className="absolute right-3 bottom-3 cursor-pointer hover:bg-muted rounded-md p-2 transition-colors"
          title="Upload images"
        >
          <Paperclip className="h-4 w-4" />
        </label>
        <input
          id="image-upload"
          type="file"
          multiple
          accept="image/*"
          onChange={onImageUpload}
          className="hidden"
          disabled={isLoading}
        />
      </div>
      <Button
        onClick={onSendMessage}
        disabled={isLoading || (!input.trim() && uploadedImages.length === 0)}
        className="self-end"
      >
        {isLoading ? (
          'Sending...'
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Send
          </>
        )}
      </Button>
    </div>
  )
}