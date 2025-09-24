'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Project, Task, NewTask, Comment, Landmark } from '../../../lib/types/api'
import ChatBox from '@/components/chat-box'
import { api } from '@/lib/trpc/client'

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
      await createTaskMutation.mutateAsync(newTask as any)
      setNewTask({ projectId: projectId, description: '', status: 'pending' })
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

  const tasksByStatus = statusOptions.map(status => ({
    ...status,
    tasks: tasks.filter(task => task.status === status.value)
  }))

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
    <div className="container mx-auto max-w-6xl p-4">
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
            onClick={() => setShowCreateForm(true)}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {[...landmarks, { id: '__unassigned__', name: '未分组' } as any].map((lm: any) => {
            const lmTasks = lm.id === '__unassigned__' ? tasks.filter(t => !t.landmarkId) : tasks.filter(t => t.landmarkId === lm.id)
            const byStatus = statusOptions.map(status => ({ ...status, tasks: lmTasks.filter(t => t.status === status.value) }))
            return (
              <div key={lm.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{lm.name}</h2>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>共 {lmTasks.length} 个任务</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {byStatus.map((statusGroup) => (
                    <div key={statusGroup.value} style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: '1rem', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: statusGroup.color }} />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                          {statusGroup.label} ({statusGroup.tasks.length})
                        </h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {statusGroup.tasks.length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '0.75rem', fontStyle: 'italic' }}>暂无任务</div>
                        ) : (
                          statusGroup.tasks.map((task) => (
                            <div
                              key={task.id}
                              style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}
                              onClick={() => {
                                const next = expandedTaskId === task.id ? null : task.id
                                setExpandedTaskId(next)
                                if (next) fetchComments(task.id)
                              }}
                            >
                              {editingTask?.id === task.id ? (
                                <form onSubmit={(e) => {
                                  e.preventDefault()
                                  const formData = new FormData(e.currentTarget)
                                  handleUpdateTask(task.id, { description: formData.get('description') as string, status: formData.get('status') as string })
                                }}>
                                  <textarea name="description" defaultValue={task.description} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: '.9rem', minHeight: 60, marginBottom: 8, boxSizing: 'border-box' }} required />
                                  <select name="status" defaultValue={task.status} style={{ width: '100%', padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '.85rem', marginBottom: 8, boxSizing: 'border-box' }}>
                                    {statusOptions.map(option => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="submit" style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: '.8rem', cursor: 'pointer' }}>保存</button>
                                    <button type="button" onClick={() => setEditingTask(null)} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: '.8rem', cursor: 'pointer' }}>取消</button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'flex', gap: 8, whiteSpace: 'nowrap' }}>
                                      <button onClick={() => handleProcessTask(task)} style={{ background: 'transparent', color: '#16a34a', border: 'none', padding: '2px 6px', borderRadius: 3, fontSize: '.8rem', cursor: 'pointer' }} title="交给 AI 处理">AI处理</button>
                                      <button onClick={() => setEditingTask(task)} style={{ background: 'transparent', color: '#3b82f6', border: 'none', padding: '2px 6px', borderRadius: 3, fontSize: '.8rem', cursor: 'pointer' }}>编辑</button>
                                      <button onClick={() => handleDeleteTask(task.id)} style={{ background: 'transparent', color: '#ef4444', border: 'none', padding: '2px 6px', borderRadius: 3, fontSize: '.8rem', cursor: 'pointer' }}>删除</button>
                                    </div>
                                  </div>
                                  <p style={{ margin: '0.5rem 0 0.5rem 0', lineHeight: 1.5, fontSize: '.95rem' }}>{task.description}</p>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.8rem', color: '#6b7280', marginTop: 4 }}>
                                    <span>创建于 {formatDate(task.createdAt)}</span>
                                  </div>
                                  {expandedTaskId === task.id && (
                                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }} onClick={(e) => e.stopPropagation()}>
                                      <div style={{ fontWeight: 600, marginBottom: 8, color: '#111827' }}>评论</div>
                                      {commentsLoading[task.id] ? (
                                        <div style={{ color: '#6b7280', fontSize: '.9rem' }}>加载评论中...</div>
                                      ) : (comments[task.id] && comments[task.id].length > 0) ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                          {comments[task.id].map((c) => (
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
                                  )}
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
    {/* Scoped AI Chat for this project (passes projectId via header) */}
    <ChatBox variant="floating" projectId={projectId} />
    </>
  )
}
