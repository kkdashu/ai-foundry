import React from 'react'
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
    <div className="input-container">
      <div style={{ flex: 1, position: 'relative' }}>
        <textarea
          className="prompt-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyPress}
          onPaste={onPaste}
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
          onChange={onImageUpload}
          style={{ display: 'none' }}
          disabled={isLoading}
        />
      </div>
      <button
        className="send-button"
        onClick={onSendMessage}
        disabled={isLoading || (!input.trim() && uploadedImages.length === 0)}
      >
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  )
}