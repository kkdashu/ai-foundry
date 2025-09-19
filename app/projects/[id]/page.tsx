'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Project, Task, NewTask } from '../../../lib/types/api'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params?.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTask, setNewTask] = useState<NewTask>({
    projectId: projectId,
    description: '',
    status: 'pending'
  })

  const statusOptions = [
    { value: 'pending', label: '待处理', color: '#f59e0b' },
    { value: 'in_progress', label: '进行中', color: '#3b82f6' },
    { value: 'completed', label: '已完成', color: '#10b981' },
    { value: 'cancelled', label: '已取消', color: '#ef4444' }
  ]

  useEffect(() => {
    if (projectId) {
      fetchProject()
      fetchTasks()
    }
  }, [projectId])

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setProject(data)
      } else {
        console.error('Failed to fetch project')
      }
    } catch (error) {
      console.error('Error fetching project:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/tasks?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setTasks(data)
      } else {
        console.error('Failed to fetch tasks')
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.description.trim()) {
      alert('任务描述不能为空')
      return
    }

    try {
      setIsCreating(true)
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTask),
      })

      if (response.ok) {
        const createdTask = await response.json()
        setTasks(prev => [...prev, createdTask])
        setNewTask({ projectId: projectId, description: '', status: 'pending' })
        setShowCreateForm(false)
      } else {
        alert('创建任务失败')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      alert('创建任务时出错')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updatedTask = await response.json()
        setTasks(prev => prev.map(task =>
          task.id === taskId ? updatedTask : task
        ))
        setEditingTask(null)
      } else {
        alert('更新任务失败')
      }
    } catch (error) {
      console.error('Error updating task:', error)
      alert('更新任务时出错')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setTasks(prev => prev.filter(task => task.id !== taskId))
      } else {
        alert('删除任务失败')
      }
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

  if (!project) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#666' }}>加载项目中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
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
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
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

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.1rem', color: '#666' }}>加载任务中...</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {tasksByStatus.map((statusGroup) => (
            <div key={statusGroup.value} style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '1rem',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: statusGroup.color
                  }}
                />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {statusGroup.label} ({statusGroup.tasks.length})
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {statusGroup.tasks.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    color: '#9ca3af',
                    padding: '1rem',
                    fontStyle: 'italic'
                  }}>
                    暂无任务
                  </div>
                ) : (
                  statusGroup.tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '1rem',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      {editingTask?.id === task.id ? (
                        <form onSubmit={(e) => {
                          e.preventDefault()
                          const formData = new FormData(e.currentTarget)
                          handleUpdateTask(task.id, {
                            description: formData.get('description') as string,
                            status: formData.get('status') as string
                          })
                        }}>
                          <textarea
                            name="description"
                            defaultValue={task.description}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.9rem',
                              minHeight: '60px',
                              marginBottom: '0.5rem',
                              boxSizing: 'border-box'
                            }}
                            required
                          />
                          <select
                            name="status"
                            defaultValue={task.status}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              marginBottom: '0.5rem',
                              boxSizing: 'border-box'
                            }}
                          >
                            {statusOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="submit"
                              style={{
                                backgroundColor: '#22c55e',
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                              }}
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTask(null)}
                              style={{
                                backgroundColor: '#f3f4f6',
                                color: '#374151',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                              }}
                            >
                              取消
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <p style={{ margin: '0 0 0.75rem 0', lineHeight: '1.4', fontSize: '0.95rem' }}>
                            {task.description}
                          </p>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.8rem',
                            color: '#6b7280'
                          }}>
                            <span>创建于 {formatDate(task.createdAt)}</span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => setEditingTask(task)}
                                style={{
                                  backgroundColor: 'transparent',
                                  color: '#3b82f6',
                                  border: 'none',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer'
                                }}
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                style={{
                                  backgroundColor: 'transparent',
                                  color: '#ef4444',
                                  border: 'none',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer'
                                }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}