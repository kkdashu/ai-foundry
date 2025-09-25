"use client"

import * as React from 'react'
import { api } from '@/lib/trpc/client'
import MonacoViewer from './monaco-viewer'
import ChatBox from '@/components/chat-box'

type DirItem = { name: string; rel: string; type: 'dir' | 'file'; size?: number; mtime?: number; hasChildren?: boolean }

function IconCaret({ open }: { open: boolean }) {
  return <span style={{ display: 'inline-block', width: 14 }}>{open ? '▼' : '▶'}</span>
}

function IconFolder() { return <span style={{ marginRight: 6 }}>📁</span> }
function IconFile() { return <span style={{ marginRight: 6 }}>📄</span> }

function DirectoryNode({ projectId, rel, name, level, onSelect, onTreeChanged, selectedRel }: {
  projectId: string
  rel: string // this directory path relative to root, '' for root
  name?: string
  level: number
  onSelect: (fileRel: string) => void
  onTreeChanged?: () => void
  selectedRel?: string | null
}) {
  const [open, setOpen] = React.useState(level === 0) // root open by default
  const listQuery = api.fs.list.useQuery({ projectId, rel }, { enabled: open })
  const utils = api.useUtils()
  const mkdirMutation = api.fs.mkdir.useMutation({
    onSuccess: () => utils.fs.list.invalidate({ projectId, rel }),
  })
  const createFileMutation = api.fs.createFile.useMutation({
    onSuccess: () => utils.fs.list.invalidate({ projectId, rel }),
  })
  const renameMutation = api.fs.rename.useMutation({
    onSuccess: () => utils.fs.list.invalidate({ projectId, rel }),
  })
  const removeMutation = api.fs.remove.useMutation({
    onSuccess: () => utils.fs.list.invalidate({ projectId, rel }),
  })
  const moveMutation = api.fs.move.useMutation({
    onSuccess: () => utils.fs.list.invalidate({ projectId, rel }),
  })
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const [target, setTarget] = React.useState<{ kind: 'dir' | 'file'; name: string; rel: string } | null>(null)
  const [dragOver, setDragOver] = React.useState(false)

  const paddingLeft = 8 + level * 12

  async function uploadFiles(files: FileList | File[], parentRel: string) {
    if (!files || (files as any).length === 0) return
    const fd = new FormData()
    Array.from(files as any).forEach((f: File) => fd.append('files', f))
    const qs = new URLSearchParams({ projectId, parentRel }).toString()
    const res = await fetch(`/api/fs/upload?${qs}`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')
    await utils.fs.list.invalidate({ projectId, rel: parentRel })
    setOpen(true)
  }

  const isActiveDir = React.useMemo(() => {
    if (!selectedRel) return false
    if (rel === '') return true // root considered active when any file is selected
    return selectedRel === rel || selectedRel.startsWith(rel + '/')
  }, [selectedRel, rel])

  return (
    <div>
      <div
        style={{ cursor: 'pointer', padding: '2px 6px', paddingLeft, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4, background: dragOver ? '#e0f2fe' : isActiveDir ? '#eef2ff' : undefined, borderLeft: isActiveDir ? '3px solid #6366f1' : '3px solid transparent' }}
        onClick={() => setOpen(o => !o)}
        onContextMenu={(e) => { e.preventDefault(); setTarget({ kind: 'dir', name: name || '/', rel }); setMenu({ x: e.clientX, y: e.clientY }) }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); e.dataTransfer.dropEffect = 'copy' }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault(); setDragOver(false)
          // Internal move?
          const internal = e.dataTransfer.getData('application/x-ai-foundry-internal')
          if (internal) {
            try {
              const payload = JSON.parse(internal)
              if (payload?.rel && payload?.kind) {
                const baseName = payload.rel.split('/').pop()
                await moveMutation.mutateAsync({ projectId, srcRel: payload.rel, destParentRel: rel, newName: baseName })
                await utils.fs.list.invalidate({ projectId, rel })
              }
            } catch (err: any) {
              alert(`移动失败：${err?.message || '未知错误'}`)
            }
            return
          }
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            try {
              await uploadFiles(e.dataTransfer.files, rel)
            } catch (err: any) {
              alert(`上传失败：${err?.message || '未知错误'}`)
            }
          }
        }}
        title={rel || '/'}
        draggable={level > 0}
        onDragStart={(e) => {
          if (level > 0) {
            e.dataTransfer.setData('application/x-ai-foundry-internal', JSON.stringify({ rel, kind: 'dir' }))
            e.dataTransfer.effectAllowed = 'move'
          }
        }}
      >
        <IconCaret open={open} />
        <IconFolder />
        <span style={{ fontWeight: level === 0 ? 600 : 500 }}>{name ?? '根目录'}</span>
      </div>
      {open && (
        <div>
          {listQuery.isLoading && <div style={{ paddingLeft, color: '#6b7280' }}>加载中…</div>}
          {listQuery.error && <div style={{ paddingLeft, color: '#ef4444' }}>加载失败：{String(listQuery.error.message || listQuery.error)}</div>}
          {listQuery.data?.items?.map((it) => (
            it.type === 'dir' ? (
              <DirectoryNode key={it.rel} projectId={projectId} rel={it.rel} name={it.name} level={level + 1} onSelect={onSelect} onTreeChanged={onTreeChanged} selectedRel={selectedRel} />
            ) : (
              <div
                key={it.rel}
                style={{ cursor: 'pointer', padding: '2px 6px', paddingLeft: 8 + (level + 1) * 12, display: 'flex', alignItems: 'center', background: selectedRel === it.rel ? '#eef2ff' : undefined, borderLeft: selectedRel === it.rel ? '3px solid #6366f1' : '3px solid transparent' }}
                onClick={(e) => { e.stopPropagation(); onSelect(it.rel) }}
                onContextMenu={(e) => { e.preventDefault(); setTarget({ kind: 'file', name: it.name, rel: it.rel }); setMenu({ x: e.clientX, y: e.clientY }) }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-ai-foundry-internal', JSON.stringify({ rel: it.rel, kind: 'file' }))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                title={it.rel}
              >
                <span style={{ display: 'inline-block', width: 14 }} />
                <IconFile />
                <span style={{ fontWeight: selectedRel === it.rel ? 600 : 400 }}>{it.name}</span>
              </div>
            )
          ))}
          {!listQuery.isLoading && listQuery.data && listQuery.data.items.length === 0 && (
            <div style={{ paddingLeft, color: '#6b7280' }}>(空)</div>
          )}
        </div>
      )}
      {menu && target && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'transparent' }} />
          <div style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 1110, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
            {/* Directory menu */}
            {target.kind === 'dir' && (
              <>
                <button
                  onClick={async () => {
                    setMenu(null)
                    const name = window.prompt('新建文件夹名称：')?.trim()
                    if (!name) return
                    if (/[\\/]/.test(name)) { alert('名称不能包含 / 或 \\'); return }
                    try {
                      await mkdirMutation.mutateAsync({ projectId, parentRel: target.rel, name })
                      setOpen(true)
                    } catch (err: any) {
                      alert(`创建失败：${err?.message || '未知错误'}`)
                    }
                  }}
                  style={{ display: 'block', padding: '8px 12px', width: 180, textAlign: 'left', background: 'white', border: 'none', cursor: 'pointer' }}
                >新建文件夹…</button>
                <button
                  onClick={async () => {
                    setMenu(null)
                    const name = window.prompt('新建文件名称：')?.trim()
                    if (!name) return
                    if (/[\\/]/.test(name)) { alert('名称不能包含 / 或 \\'); return }
                    try {
                      const res = await createFileMutation.mutateAsync({ projectId, parentRel: target.rel, name })
                      setOpen(true)
                      onSelect(res.rel)
                    } catch (err: any) {
                      alert(`创建失败：${err?.message || '未知错误'}`)
                    }
                  }}
                  style={{ display: 'block', padding: '8px 12px', width: 180, textAlign: 'left', background: 'white', border: 'none', cursor: 'pointer' }}
                >新建文件…</button>
                {level > 0 && (
                  <>
                    <button
                      onClick={async () => {
                        setMenu(null)
                        const newName = window.prompt('重命名文件夹：', target.name)?.trim()
                        if (!newName || newName === target.name) return
                        if (/[\\/]/.test(newName)) { alert('名称不能包含 / 或 \\'); return }
                    try {
                          await renameMutation.mutateAsync({ projectId, rel: target.rel, newName })
                          // refresh parent directory listing
                          const parentRel = target.rel.split('/').slice(0, -1).join('/')
                          await utils.fs.list.invalidate({ projectId, rel: parentRel })
                          onTreeChanged?.()
                        } catch (err: any) {
                          alert(`重命名失败：${err?.message || '未知错误'}`)
                        }
                      }}
                      style={{ display: 'block', padding: '8px 12px', width: 180, textAlign: 'left', background: 'white', border: 'none', cursor: 'pointer' }}
                    >重命名…</button>
                    <button
                      onClick={async () => {
                        setMenu(null)
                        if (!confirm(`确认删除文件夹“${target.name}”及其所有内容？此操作不可撤销。`)) return
                        try {
                          await removeMutation.mutateAsync({ projectId, rel: target.rel, recursive: true })
                          const parentRel = target.rel.split('/').slice(0, -1).join('/')
                          await utils.fs.list.invalidate({ projectId, rel: parentRel })
                          onTreeChanged?.()
                        } catch (err: any) {
                          alert(`删除失败：${err?.message || '未知错误'}`)
                        }
                      }}
                      style={{ display: 'block', padding: '8px 12px', width: 180, textAlign: 'left', background: 'white', border: 'none', cursor: 'pointer', color: '#b91c1c' }}
                    >删除…</button>
                  </>
                )}
              </>
            )}
            {/* File menu */}
            {target.kind === 'file' && (
              <>
                <button
                  onClick={() => { setMenu(null); onSelect(target.rel) }}
                  style={{ display: 'block', padding: '8px 12px', width: 180, textAlign: 'left', background: 'white', border: 'none', cursor: 'pointer' }}
                >打开</button>
                <button
                  onClick={async () => {
                    setMenu(null)
                    const newName = window.prompt('重命名文件：', target.name)?.trim()
                    if (!newName || newName === target.name) return
                    if (/[\\/]/.test(newName)) { alert('名称不能包含 / 或 \\'); return }
                    try {
                      const res = await renameMutation.mutateAsync({ projectId, rel: target.rel, newName })
                      onSelect(res.newRel)
                    } catch (err: any) {
                      alert(`重命名失败：${err?.message || '未知错误'}`)
                    }
                  }}
                  style={{ display: 'block', padding: '8px 12px', width: 180, textAlign: 'left', background: 'white', border: 'none', cursor: 'pointer' }}
                >重命名…</button>
                <button
                  onClick={async () => {
                    setMenu(null)
                    if (!confirm(`确认删除文件“${target.name}”？此操作不可撤销。`)) return
                    try {
                      await removeMutation.mutateAsync({ projectId, rel: target.rel, recursive: false })
                      // refresh current directory
                      await utils.fs.list.invalidate({ projectId, rel })
                    } catch (err: any) {
                      alert(`删除失败：${err?.message || '未知错误'}`)
                    }
                  }}
                  style={{ display: 'block', padding: '8px 12px', width: 180, textAlign: 'left', background: 'white', border: 'none', cursor: 'pointer', color: '#b91c1c' }}
                >删除…</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function isImagePath(rel: string | null): boolean {
  if (!rel) return false
  const m = /\.([^.]+)$/.exec(rel)
  const ext = (m?.[1] || '').toLowerCase()
  return ['png','jpg','jpeg','gif','webp','svg','bmp','ico','tif','tiff','avif','heic','heif','jfif'].includes(ext)
}

export default function FileExplorerModal({ projectId, onClose, baseRel }: { projectId: string; onClose: () => void; baseRel?: string }) {
  const [selectedRel, setSelectedRel] = React.useState<string | null>(null)
  const isImage = isImagePath(selectedRel)
  const readTextQuery = api.fs.read.useQuery({ projectId, rel: selectedRel || '' }, { enabled: !!selectedRel && !isImage })
  const readImageQuery = api.fs.image.useQuery({ projectId, rel: selectedRel || '' }, { enabled: !!selectedRel && isImage })
  const [reloadKey, setReloadKey] = React.useState(0)
  const [showAI, setShowAI] = React.useState(false)
  const localPathQuery = api.local.getPath.useQuery({ projectId })
  const cwd = localPathQuery.data?.path || ''
  const buildAnalyzePrompt = React.useCallback(() => {
    if (!selectedRel) return ''
    return `请在工作目录 ${cwd || '(未绑定路径)'} 下分析文件 ${selectedRel}。请只读分析，必要时读取该文件与其直接依赖，不要修改任何文件。`
  }, [cwd, selectedRel])

  const rootRel = (baseRel || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const rootLabel = rootRel ? rootRel : '根目录'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', width: '90vw', height: '85vh', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <div style={{ fontWeight: 600 }}>本地目录托管浏览</div>
          <button onClick={onClose} style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>关闭</button>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ width: 320, minWidth: 220, maxWidth: 480, overflow: 'auto', borderRight: '1px solid #e5e7eb', padding: '6px 0' }}>
            <DirectoryNode key={reloadKey} projectId={projectId} rel={rootRel} name={rootLabel} level={0} onSelect={(r) => setSelectedRel(r)} onTreeChanged={() => setReloadKey((k) => k + 1)} selectedRel={selectedRel} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#6b7280' }}>查看文件：</span>
              <code style={{ fontSize: 12 }}>{selectedRel || '（未选择）'}</code>
              {(readTextQuery.isFetching || readImageQuery.isFetching) && <span style={{ color: '#6b7280' }}>加载中…</span>}
              {readTextQuery.data?.truncated && <span style={{ marginLeft: 'auto', color: '#a16207' }}>已截断预览（&gt;1MB）</span>}
              <div style={{ flex: 1 }} />
              <span
                title="AI 分析以只读模式运行"
                style={{
                  display: 'inline-block',
                  borderRadius: 999,
                  border: '1px solid #d1d5db',
                  background: '#f3f4f6',
                  color: '#374151',
                  padding: '3px 8px',
                  fontSize: 10,
                  lineHeight: 1,
                  marginRight: 8,
                }}
              >只读模式</span>
              <button
                onClick={() => setShowAI(true)}
                disabled={!selectedRel}
                style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: selectedRel ? 'pointer' : 'not-allowed', opacity: selectedRel ? 1 : 0.5 }}
              >
                AI分析
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {selectedRel && !isImage && readTextQuery.data && (
                <MonacoViewer path={readTextQuery.data.rel} content={readTextQuery.data.content} />
              )}
              {selectedRel && isImage && readImageQuery.data && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f17' }}>
                  <img src={readImageQuery.data.dataUrl} alt={readImageQuery.data.rel} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              )}
              {selectedRel && !isImage && readTextQuery.error && (
                <div style={{ padding: 12, color: '#ef4444' }}>无法读取文件：{String(readTextQuery.error.message || readTextQuery.error)}</div>
              )}
              {selectedRel && isImage && readImageQuery.error && (
                <div style={{ padding: 12, color: '#ef4444' }}>无法读取图片：{String(readImageQuery.error.message || readImageQuery.error)}</div>
              )}
              {!selectedRel && (
                <div style={{ padding: 12, color: '#6b7280' }}>从左侧选择一个文件查看内容。</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showAI && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: 780, height: '80vh', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>AI 分析</div>
              <button onClick={() => setShowAI(false)} style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>关闭</button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ChatBox variant="embedded" title="AI 助手（只读）" projectId={projectId} initialPrompt={buildAnalyzePrompt()} readonly apiPath="/api/ai/ccagent" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
