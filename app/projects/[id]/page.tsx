'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Project, Task, NewTask, Comment, Landmark } from '../../../lib/types/api'
import ChatBox from '@/components/chat-box'
import { api } from '@/lib/trpc/client'
import dynamic from 'next/dynamic'
import { FolderOpen } from 'lucide-react'
const DynamicFileExplorer = dynamic(() => import('@/components/file-explorer'), { ssr: false })
const DynamicTaskFlow = dynamic(() => import('@/components/task-flow'), { ssr: false })

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params?.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateLandmarkForm, setShowCreateLandmarkForm] = useState(false)
  const [newLandmarkName, setNewLandmarkName] = useState('')
  const [isCreatingLandmark, setIsCreatingLandmark] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({})
  const [newTask, setNewTask] = useState<NewTask>({
    projectId: projectId,
    description: '',
    status: 'pending'
  })
  const [createForLandmarkId, setCreateForLandmarkId] = useState<string | null>(null)

  // Local path binding state
  const [localPath, setLocalPath] = useState<string>('')
  const [pathLoading, setPathLoading] = useState<boolean>(false)
  const [pathError, setPathError] = useState<string | null>(null)

  const statusOptions = [
    { value: 'pending', label: '待处理', color: '#f59e0b' },
    { value: 'in_progress', label: '进行中', color: '#3b82f6' },
    { value: 'completed', label: '已完成', color: '#10b981' },
    { value: 'cancelled', label: '已取消', color: '#ef4444' }
  ]

  const utils = api.useUtils()
  const projectQuery = api.projects.getById.useQuery({ id: projectId }, { enabled: !!projectId })
  const tasksQuery = api.tasks.list.useQuery({ projectId }, { enabled: !!projectId })
  const landmarksQuery = api.landmarks.listByProject.useQuery({ projectId }, { enabled: !!projectId })

  useEffect(() => {
    if (projectQuery.data) setProject(projectQuery.data as any)
  }, [projectQuery.data])

  useEffect(() => {
    if (tasksQuery.data) setTasks(tasksQuery.data as any)
    setIsLoading(tasksQuery.isLoading)
  }, [tasksQuery.data, tasksQuery.isLoading])

  useEffect(() => {
    if (landmarksQuery.data) setLandmarks(landmarksQuery.data as any)
  }, [landmarksQuery.data])

  // Local path via tRPC
  const localPathQuery = api.local.getPath.useQuery({ projectId }, { enabled: !!projectId })
  useEffect(() => {
    if (localPathQuery.data) {
      setLocalPath(localPathQuery.data.path || '')
      setPathError(null)
    }
  }, [localPathQuery.data])

  // Removed REST fetchProject/fetchTasks; using tRPC queries instead

  const fetchComments = async (taskId: string) => {
    try {
      setCommentsLoading(prev => ({ ...prev, [taskId]: true }))
      const data = await utils.comments.listByTask.fetch({ taskId })
      setComments(prev => ({ ...prev, [taskId]: data as any }))
    } catch (err) {
      console.error('Failed to load comments:', err)
    } finally {
      setCommentsLoading(prev => ({ ...prev, [taskId]: false }))
    }
  }

  // Refresh tasks when ChatBox signals updates (e.g., AI marked as completed)
  useEffect(() => {
    const onTaskUpdated = () => utils.tasks.list.invalidate({ projectId })
    window.addEventListener('task:updated', onTaskUpdated as EventListener)
    return () => window.removeEventListener('task:updated', onTaskUpdated as EventListener)
  }, [projectId])

  // Mutations for local path
  const setPathMutation = api.local.setPath.useMutation({ onSuccess: () => localPathQuery.refetch() })
  const removePathMutation = api.local.removePath.useMutation({ onSuccess: () => localPathQuery.refetch() })
  const [showExplorer, setShowExplorer] = useState(false)
  const [lmExplorerId, setLmExplorerId] = useState<string | null>(null)
  const ensureDirMutation = api.fs.ensureDir.useMutation()

  const saveLocalPath = async () => {
    if (!localPath.trim()) {
      alert('请输入本地目录的绝对路径')
      return
    }
    try {
      setPathLoading(true)
      const res = await setPathMutation.mutateAsync({ projectId, path: localPath })
      setLocalPath(res.path)
      setPathError(null)
      alert('已绑定到本地目录')
    } catch (err: any) {
      setPathError(err?.message || '路径无效或不可访问')
      alert(`绑定失败：${err?.message || '未知错误'}`)
    } finally {
      setPathLoading(false)
    }
  }

  const removeLocalBinding = async () => {
    try {
      setPathLoading(true)
      await removePathMutation.mutateAsync({ projectId })
      setLocalPath('')
      setPathError(null)
    } catch (err: any) {
      alert(`解绑失败：${err?.message || '未知错误'}`)
    } finally {
      setPathLoading(false)
    }
  }

  const createTaskMutation = api.tasks.create.useMutation({ onSuccess: () => utils.tasks.list.invalidate({ projectId }) })
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.description.trim()) {
      alert('任务描述不能为空')
      return
    }

    try {
      setIsCreating(true)
      const payload = {
        projectId,
        description: newTask.description.trim(),
        status: newTask.status || 'pending',
        landmarkId: (newTask as any).landmarkId || undefined,
      }
      await createTaskMutation.mutateAsync(payload as any)
      setNewTask({ projectId: projectId, description: '', status: 'pending' })
      setCreateForLandmarkId(null)
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating task:', error)
      alert('创建任务时出错')
    } finally {
      setIsCreating(false)
    }
  }

  const updateTaskMutation = api.tasks.update.useMutation({ onSuccess: () => utils.tasks.list.invalidate({ projectId }) })
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTaskMutation.mutateAsync({ id: taskId, description: updates.description as any, status: updates.status as any })
      setEditingTask(null)
    } catch (error) {
      console.error('Error updating task:', error)
      alert('更新任务时出错')
    }
  }

  // Hand off a task to AI (Claude Code) to process within this project's cwd
  const processTaskMutation = api.tasks.process.useMutation({
    onSuccess: async (_, vars) => {
      await utils.tasks.list.invalidate({ projectId })
      if (expandedTaskId === vars.id) await utils.comments.listByTask.invalidate({ taskId: vars.id })
      if (expandedTaskId === vars.id) fetchComments(vars.id)
    },
  })
  const handleProcessTask = async (task: Task) => {
    try {
      // optimistic
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'in_progress' } : t))
      await processTaskMutation.mutateAsync({ id: task.id })
    } catch (error: any) {
      console.error('Error processing task:', error)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'pending' } : t))
      alert(`AI 处理失败：${error?.message || '未知错误'}`)
    }
  }

  const deleteTaskMutation = api.tasks.delete.useMutation({ onSuccess: () => utils.tasks.list.invalidate({ projectId }) })
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) {
      return
    }

    try {
      await deleteTaskMutation.mutateAsync({ id: taskId })
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('删除任务时出错')
    }
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusInfo = (status: string) => {
    return statusOptions.find(option => option.value === status) || statusOptions[0]
  }

  const selectedTask = tasks.find(t => t.id === expandedTaskId) || null
  const [modalDesc, setModalDesc] = useState<string>('')
  const [modalStatus, setModalStatus] = useState<string>('pending')
  useEffect(() => {
    if (selectedTask) {
      setModalDesc(selectedTask.description)
      setModalStatus(selectedTask.status)
    }
  }, [selectedTask?.id])

  // Landmarks mutations
  const createLandmarkMutation = api.landmarks.create.useMutation({ onSuccess: () => landmarksQuery.refetch() })
  const handleCreateLandmark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLandmarkName.trim()) return
    try {
      setIsCreatingLandmark(true)
      await createLandmarkMutation.mutateAsync({ projectId, name: newLandmarkName.trim() } as any)
      setNewLandmarkName('')
      setShowCreateLandmarkForm(false)
    } catch (err) {
      console.error('Create landmark failed', err)
      alert('创建里程碑失败')
    } finally {
      setIsCreatingLandmark(false)
    }
  }

  if (!project) {
    return (
      <div className="container mx-auto max-w-6xl p-4">
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#666' }}>加载项目中...</div>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <a
              href="/"
              style={{
                textDecoration: 'none',
                color: '#0066cc',
                fontSize: '1rem'
              }}
            >
              ← 返回项目列表
            </a>
          </div>
          <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#333' }}>
            {project.name}
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#666', margin: '0.5rem 0' }}>
            {project.description}
          </p>
          {project.repositoryUrl && (
            <a
              href={project.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#0066cc',
                textDecoration: 'none',
                fontSize: '1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              🔗 Git 仓库
            </a>
          )}
          {/* Local path binding UI */}
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>本地目录绑定</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="例如：/Users/you/code/my-project 或 C:\\code\\my-project"
                style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
              <button
                onClick={saveLocalPath}
                disabled={pathLoading}
                style={{ backgroundColor: '#2563EB', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
              >
                保存
              </button>
              {localPath && (
                <button
                  onClick={() => setShowExplorer(true)}
                  disabled={pathLoading}
                  style={{ backgroundColor: '#111827', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
                >
                  托管
                </button>
              )}
              {localPath && (
                <button
                  onClick={removeLocalBinding}
                  disabled={pathLoading}
                  style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
                >
                  解绑
                </button>
              )}
            </div>
            {pathError && (
              <div style={{ color: '#ef4444', marginTop: 6, fontSize: 12 }}>错误：{pathError}</div>
            )}
            <div style={{ color: '#6b7280', marginTop: 6, fontSize: 12 }}>
              提示：该路径仅保存在本机（{localPathQuery.data?.registry || '~/.config/ai-foundry/local-projects.json'}）。
            </div>
          </div>
        </div>
        {showExplorer && (
          // Lazy-load to keep page light if monaco is missing until needed
          <DynamicFileExplorer projectId={project.id} onClose={() => setShowExplorer(false)} />
        )}
        {lmExplorerId && (
          <DynamicFileExplorer projectId={project.id} baseRel={`.project/${lmExplorerId}`} onClose={() => setLmExplorerId(null)} />
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowCreateLandmarkForm(true)}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            + 新建里程碑
          </button>
          <button
            onClick={() => { setCreateForLandmarkId(null); setNewTask(prev => ({ ...prev, landmarkId: undefined } as any)); setShowCreateForm(true) }}
            style={{
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
          >
            + 新建任务
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            minWidth: '400px',
            maxWidth: '500px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>创建新任务</h2>
            <form onSubmit={handleCreateTask}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  里程碑
                </label>
                <select
                  value={(newTask as any).landmarkId || ''}
                  onChange={(e) => setNewTask(prev => ({ ...prev, landmarkId: e.target.value || undefined } as any))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">未分组</option>
                  {landmarks.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  任务描述 *
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    minHeight: '80px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  placeholder="输入任务描述"
                  required
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  状态
                </label>
                <select
                  value={newTask.status}
                  onChange={(e) => setNewTask(prev => ({ ...prev, status: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  disabled={isCreating}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  disabled={isCreating}
                >
                  {isCreating ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateLandmarkForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>创建里程碑</h2>
            <form onSubmit={handleCreateLandmark}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>名称 *</label>
                <input
                  type="text"
                  value={newLandmarkName}
                  onChange={(e) => setNewLandmarkName(e.target.value)}
                  placeholder="例如：V1.0 发布前"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateLandmarkForm(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', padding: '8px 12px', borderRadius: 4 }}>取消</button>
                <button type="submit" disabled={isCreatingLandmark} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 4 }}>{isCreatingLandmark ? '创建中...' : '创建'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.1rem', color: '#666' }}>加载任务中...</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
            {[...landmarks, { id: '__unassigned__', name: '未分组' } as any].map((lm: any) => {
              const lmTasks = lm.id === '__unassigned__' ? tasks.filter(t => !t.landmarkId) : tasks.filter(t => t.landmarkId === lm.id)
              return (
                <div key={lm.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{lm.name}</h2>
                      <button
                        onClick={() => { const lid = lm.id === '__unassigned__' ? undefined : lm.id; setCreateForLandmarkId(lid ?? null); setNewTask(prev => ({ ...prev, landmarkId: lid } as any)); setShowCreateForm(true) }}
                        style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        title="在该里程碑下新建任务"
                      >
                        + 任务
                      </button>
                      {lm.id !== '__unassigned__' && (
                        <button
                          onClick={async () => {
                            try {
                              await ensureDirMutation.mutateAsync({ projectId, rel: `.project/${lm.id}` })
                              setLmExplorerId(lm.id)
                            } catch (err: any) {
                              alert(`无法创建/打开目录：${err?.message || '未知错误'}`)
                            }
                          }}
                          style={{ background: '#111827', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                          title="查看该里程碑的本地目录"
                        >
                          <FolderOpen size={14} />
                          目录
                        </button>
                      )}
                    </div>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>共 {lmTasks.length} 个任务</span>
                  </div>
                  <DynamicTaskFlow
                    tasks={lmTasks}
                    height="50vh"
                    onSelect={(id) => {
                      setExpandedTaskId(prev => prev === id ? null : (id || null))
                      if (id && !comments[id]) fetchComments(id)
                    }}
                    layoutKey={`${projectId}:${lm.id}`}
                    onConnectEdge={async (sourceId, targetId) => {
                      // 将 target 的前置任务设置为 source
                      try {
                        await updateTaskMutation.mutateAsync({ id: targetId, predecessorId: sourceId } as any)
                        await utils.tasks.list.invalidate({ projectId })
                      } catch (err) {
                        console.error('Update predecessor failed', err)
                        throw err
                      }
                    }}
                    onDeleteEdge={async (sourceId, targetId) => {
                      try {
                        // 清除目标任务的前置任务
                        await updateTaskMutation.mutateAsync({ id: targetId, predecessorId: null } as any)
                        await utils.tasks.list.invalidate({ projectId })
                      } catch (err) {
                        console.error('Clear predecessor failed', err)
                        throw err
                      }
                    }}
                  />
                </div>
              )
            })}
          </div>

          {selectedTask && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setExpandedTaskId(null)}>
              <div style={{ background: '#fff', width: 'min(800px, 96vw)', maxHeight: '85vh', overflow: 'auto', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,.25)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>任务详情</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>创建于 {formatDate(selectedTask.createdAt)}</div>
                  </div>
                  <button onClick={() => setExpandedTaskId(null)} style={{ background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: '#6b7280' }}>×</button>
                </div>
                <div style={{ padding: 16 }}>
                  <form onSubmit={async (e) => { e.preventDefault(); await handleUpdateTask(selectedTask.id, { description: modalDesc, status: modalStatus } as any); setExpandedTaskId(null) }}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>描述</label>
                      <textarea value={modalDesc} onChange={(e) => setModalDesc(e.target.value)} style={{ width: '100%', minHeight: 120, padding: 8, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>状态</label>
                      <select value={modalStatus} onChange={(e) => setModalStatus(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                        {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => handleProcessTask(selectedTask)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>AI处理</button>
                      <button type="button" onClick={() => { handleDeleteTask(selectedTask.id); setExpandedTaskId(null) }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>删除</button>
                      <button type="button" onClick={() => setExpandedTaskId(null)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #ddd', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>取消</button>
                      <button type="submit" style={{ background: '#111827', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>保存</button>
                    </div>
                  </form>

                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#111827' }}>评论</div>
                    {commentsLoading[selectedTask.id] ? (
                      <div style={{ color: '#6b7280', fontSize: '.9rem' }}>加载评论中...</div>
                    ) : (comments[selectedTask.id] && comments[selectedTask.id].length > 0) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {comments[selectedTask.id].map((c) => (
                          <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.75rem', backgroundColor: '#fafafa' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '.85rem', color: '#374151' }}>
                                <span style={{ fontWeight: 600 }}>{c.author}</span>
                                <span style={{ marginLeft: 8, color: '#6b7280' }}>{new Date(c.createdAt as any).toLocaleString()}</span>
                              </div>
                            </div>
                            <div style={{ marginTop: 6, fontSize: '.9rem', color: '#111827', whiteSpace: 'pre-wrap' }}>{c.summary}</div>
                            <details style={{ marginTop: 6 }}>
                              <summary style={{ cursor: 'pointer', color: '#2563eb', fontSize: '.85rem' }}>查看过程（原始事件/输出）</summary>
                              <pre style={{ marginTop: 6, overflow: 'auto', maxHeight: 240, fontSize: '.75rem', backgroundColor: '#fff', padding: '0.5rem', border: '1px solid #eee', borderRadius: 4 }}>
{JSON.stringify(c.content, null, 2)}
                              </pre>
                            </details>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#6b7280', fontStyle: 'italic' }}>暂无评论</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
    {/* Scoped AI Chat for this project (passes projectId via header) */}
    <ChatBox variant="floating" projectId={projectId} />
    </>
  )
}
