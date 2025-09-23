'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Project, NewProject } from '../lib/types/api'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'
import { Trash2 } from 'lucide-react'
import ChatBox from '@/components/chat-box'

export default function HomePage() {
  const utils = api.useUtils()
  const { data: projects = [], isLoading } = api.projects.list.useQuery()
  const createMutation = api.projects.create.useMutation({
    onSuccess: async (created) => {
      await utils.projects.list.invalidate()
      setNewProject({ name: '', description: '', repositoryUrl: '' })
      setShowCreateForm(false)
      try { window.dispatchEvent(new CustomEvent('project:created', { detail: created })) } catch {}
    },
  })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [newProject, setNewProject] = useState<NewProject>({
    name: '',
    description: '',
    repositoryUrl: ''
  })
  const { toast } = useToast()
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)


  useEffect(() => {
    // no-op: projects are loaded via tRPC query
  }, [])

  // Listen for project creation/deletion events from the Agent chat and refresh list
  useEffect(() => {
    const onCreated = (e: any) => {
      const id = e?.detail?.id
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      setHighlightId(id ?? null)
      utils.projects.list.invalidate().then(() => {
        if (!id) return
        // Scroll the new card into view after render
        requestAnimationFrame(() => {
          const el = document.getElementById(`project-card-${id}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      })
      // Clear highlight after 2.5s
      highlightTimerRef.current = setTimeout(() => setHighlightId(null), 2500)
    }
    const onDeleted = () => { utils.projects.list.invalidate() }
    window.addEventListener('project:created', onCreated as EventListener)
    window.addEventListener('project:deleted', onDeleted as EventListener)
    return () => {
      window.removeEventListener('project:created', onCreated as EventListener)
      window.removeEventListener('project:deleted', onDeleted as EventListener)
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  const deleteMutation = api.projects.delete.useMutation({
    onSuccess: async () => {
      await utils.projects.list.invalidate()
    },
  })
  const handleDeleteProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = window.confirm(`确认删除项目：“${project.name}”？`)
    if (!confirmed) return
    try {
      await deleteMutation.mutateAsync({ id: project.id })
      toast({ description: `已删除项目：${project.name}` })
      try { window.dispatchEvent(new CustomEvent('project:deleted', { detail: project })) } catch {}
    } catch (err: any) {
      console.error('Delete failed:', err)
      toast({ description: `删除失败：${err?.message || '未知错误'}`, variant: 'destructive' })
    }
  }


  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProject.name.trim() || !newProject.description.trim()) {
      alert('项目名称和描述不能为空')
      return
    }

    try {
      setIsCreating(true)
      await createMutation.mutateAsync(newProject as any)
    } catch (error) {
      console.error('Error creating project:', error)
      alert('创建项目时出错')
    } finally {
      setIsCreating(false)
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


  return (
    <div className="container mx-auto max-w-6xl p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-foreground">项目管理</h1>
        <div className="flex gap-4">
          <Button variant="outline" asChild>
            <Link href="/chat">Chat</Link>
          </Button>
          <Button variant="secondary" asChild>
            <a href="#ai-chat">AI Chat</a>
          </Button>
          <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
            <DialogTrigger asChild>
              <Button>
                + 新建项目
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>创建新项目</DialogTitle>
                <DialogDescription>
                  填写项目信息来创建新的项目
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    项目名称 *
                  </label>
                  <Input
                    id="name"
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入项目名称"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    项目描述 *
                  </label>
                  <Textarea
                    id="description"
                    value={newProject.description}
                    onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入项目描述"
                    className="min-h-[80px]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="repo" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Git 仓库地址 (可选)
                  </label>
                  <Input
                    id="repo"
                    type="url"
                    value={newProject.repositoryUrl}
                    onChange={(e) => setNewProject(prev => ({ ...prev, repositoryUrl: e.target.value }))}
                    placeholder="https://github.com/username/repo"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    disabled={isCreating}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating}
                  >
                    {isCreating ? '创建中...' : '创建'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(350px,1fr))]">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center p-16">
              <div className="text-xl text-muted-foreground">加载项目中...</div>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center p-16">
              <h3 className="text-xl font-semibold mb-4">还没有项目</h3>
              <p className="text-muted-foreground mb-6 text-center">创建您的第一个项目来开始管理任务</p>
              <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
                <DialogTrigger asChild>
                  <Button>
                    + 创建项目
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => (
            <Card
              id={`project-card-${project.id}`}
              key={project.id}
              className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                highlightId === project.id ? 'ring-2 ring-primary/60 bg-primary/5 shadow-lg' : ''
              }`}
              onClick={() => window.location.href = `/projects/${project.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => handleDeleteProject(project, e)}
                    aria-label={`删除 ${project.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="leading-6">
                  {project.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {project.repositoryUrl && (
                  <div className="mb-4">
                    <Badge variant="outline" className="text-primary">
                      <a
                        href={project.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🔗 Git 仓库
                      </a>
                    </Badge>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  创建于 {formatDate(project.createdAt)}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* AI 聊天组件 */}
      <ChatBox variant="floating" />
    </div>
  )
}
