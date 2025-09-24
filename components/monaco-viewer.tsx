"use client"

import dynamic from 'next/dynamic'
import * as React from 'react'

const MonacoEditor = dynamic(() => import('react-monaco-editor'), { ssr: false }) as any

function guessLanguage(filePath: string): string | undefined {
  const m = /\.([^.]+)$/.exec(filePath || '')
  const ext = (m?.[1] || '').toLowerCase()
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    json: 'json',
    md: 'markdown', markdown: 'markdown',
    css: 'css', scss: 'scss', less: 'less',
    html: 'html', htm: 'html',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    yml: 'yaml', yaml: 'yaml',
    toml: 'toml', ini: 'ini', conf: 'ini',
    sql: 'sql',
    py: 'python', rb: 'ruby', php: 'php',
    go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
    c: 'c', h: 'c', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', cc: 'cpp',
    cs: 'csharp',
    xml: 'xml',
    vue: 'vue', svelte: 'svelte',
    txt: 'plaintext', env: 'plaintext',
  }
  return map[ext] || 'plaintext'
}

export function MonacoViewer(props: { path: string; content: string; height?: number | string }) {
  const language = React.useMemo(() => guessLanguage(props.path), [props.path])
  const height = props.height ?? '100%'
  return (
    <div style={{ height, width: '100%', borderLeft: '1px solid #e5e7eb' }}>
      {/* @ts-ignore - runtime loaded */}
      <MonacoEditor
        width="100%"
        height={typeof height === 'number' ? String(height) : height}
        language={language}
        theme="vs-dark"
        value={props.content}
        options={{ readOnly: true, wordWrap: 'on', minimap: { enabled: false }, scrollBeyondLastLine: false }}
      />
    </div>
  )
}

export default MonacoViewer

