'use client'

import React, { useState, useEffect } from 'react'
import { Project, NewProject } from '../lib/types/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import ChatBox from '@/components/chat-box'

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [newProject, setNewProject] = useState<NewProject>({
    name: '',
    description: '',
    repositoryUrl: ''
  })


  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      } else {
        console.error('Failed to fetch projects')
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setIsLoading(false)
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
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProject),
      })

      if (response.ok) {
        const createdProject = await response.json()
        setProjects(prev => [...prev, createdProject])
        setNewProject({ name: '', description: '', repositoryUrl: '' })
        setShowCreateForm(false)
      } else {
        alert('创建项目失败')
      }
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


  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl p-4">
        <div className="text-center p-16">
          <div className="text-xl text-muted-foreground">加载项目中...</div>
        </div>
      </div>
    )
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
        {projects.length === 0 ? (
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
              key={project.id}
              className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => window.location.href = `/projects/${project.id}`}
            >
              <CardHeader>
                <CardTitle className="text-xl">{project.name}</CardTitle>
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
