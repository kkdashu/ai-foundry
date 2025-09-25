'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Task } from '@/lib/types/api'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  Panel,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react'

function ellipsize(text: string, max = 60) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function statusColor(status?: string): string {
  switch (status) {
    case 'in_progress':
      return '#3b82f6'
    case 'completed':
      return '#10b981'
    case 'cancelled':
      return '#ef4444'
    default:
      return '#f59e0b'
  }
}

function DeletableEdge({ id, source, target, sourceX, sourceY, targetX, targetY, style, markerEnd, selected, data }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY })
  const rf = useReactFlow()
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            background: selected ? '#111827' : '#ffffff',
            color: selected ? '#ffffff' : '#111827',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            boxShadow: '0 1px 1px rgba(0,0,0,.06)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              rf.setEdges((es) => es.filter((e) => e.id !== id))
              try { (data as any)?.onDeleteEdge?.(source, target) } catch (err) { console.error('onDeleteEdge failed', err) }
            }}
            style={{ background: 'transparent', border: 'none', padding: 2, cursor: 'pointer', color: '#ef4444', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="删除这条依赖"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

function TaskNode({ data }: NodeProps<{ label: string; status?: string }>) {
  return (
    <div style={{
      border: `2px solid ${statusColor((data as any)?.status)}`,
      borderRadius: 8,
      background: '#fff',
      padding: 8,
      width: 240,
      fontSize: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,.06)'
    }}>
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8 }} />
      <div style={{ whiteSpace: 'pre-wrap' }}>{(data as any)?.label}</div>
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8 }} />
    </div>
  )
}

export default function TaskFlow({
  tasks,
  onSelect,
  height = '50vh',
  onConnectEdge,
  onDeleteEdge,
  layoutKey,
}: {
  tasks: Task[]
  onSelect?: (taskId: string | null) => void
  height?: number | string
  onConnectEdge?: (sourceId: string, targetId: string) => Promise<void> | void
  onDeleteEdge?: (sourceId: string, targetId: string) => Promise<void> | void
  layoutKey?: string
}) {
  // Build layout (columns by predecessor depth)
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const idToTask = new Map<string, Task>()
    for (const t of tasks) idToTask.set(t.id, t)

    // memoized depth calculation; depth = number of predecessors in chain
    const depthMemo = new Map<string, number>()
    const visiting = new Set<string>()

    const depthOf = (id: string): number => {
      if (depthMemo.has(id)) return depthMemo.get(id) as number
      if (visiting.has(id)) return 0 // cycle guard
      visiting.add(id)
      const t = idToTask.get(id)
      let d = 0
      if (t && t.predecessorId && idToTask.has(t.predecessorId)) {
        d = Math.min(64, 1 + depthOf(t.predecessorId)) // limit depth
      }
      visiting.delete(id)
      depthMemo.set(id, d)
      return d
    }

    const buckets = new Map<number, Task[]>()
    for (const t of tasks) {
      const d = depthOf(t.id)
      if (!buckets.has(d)) buckets.set(d, [])
      buckets.get(d)!.push(t)
    }

    // sort inside each bucket by createdAt
    for (const arr of buckets.values()) arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const XGAP = 300
    const YGAP = 120

    const nodes: Node[] = []
    for (const [depth, arr] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      arr.forEach((t, idx) => {
        nodes.push({
          id: t.id,
          position: { x: depth * XGAP, y: idx * YGAP },
          type: 'task',
          data: { label: ellipsize(t.description), status: t.status },
        })
      })
    }

    const edges: Edge[] = []
    for (const t of tasks) {
      if (t.predecessorId && idToTask.has(t.predecessorId)) {
        edges.push({ id: `${t.predecessorId}-${t.id}`.toString(), source: t.predecessorId, target: t.id, type: 'deletable', data: { onDeleteEdge } as any })
      }
    }

    return { nodes, edges }
  }, [tasks, onDeleteEdge])

  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)

  // Helpers to persist layout in localStorage
  const saveLayout = useCallback((nodesToSave: Node[]) => {
    if (!layoutKey) return
    try {
      const payload = nodesToSave.map(n => ({ id: n.id, x: n.position.x, y: n.position.y }))
      localStorage.setItem(`taskflow:layout:${layoutKey}`, JSON.stringify(payload))
    } catch {}
  }, [layoutKey])

  const loadLayout = useCallback((): Map<string, { x: number; y: number }> => {
    const map = new Map<string, { x: number; y: number }>()
    if (!layoutKey) return map
    try {
      const raw = localStorage.getItem(`taskflow:layout:${layoutKey}`)
      if (!raw) return map
      const arr = JSON.parse(raw) as Array<{ id: string; x: number; y: number }>
      for (const it of arr || []) map.set(it.id, { x: it.x, y: it.y })
    } catch {}
    return map
  }, [layoutKey])

  // Keep manual positions; only sync task set and edges without changing existing node positions.
  React.useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map(n => [n.id, n]))
      const saved = loadLayout()
      const next: Node[] = []
      let i = 0
      for (const t of tasks) {
        const prevNode = byId.get(t.id)
        const pos = saved.get(t.id) ?? prevNode?.position ?? { x: 0, y: i * 100 }
        next.push({ id: t.id, position: pos, type: 'task', data: { label: ellipsize(t.description), status: t.status } })
        i++
      }
      // Persist positions after rebuilding list
      saveLayout(next)
      return next
    })
    // rebuild edges from tasks (doesn't affect node positions)
    setEdges(() => {
      const idToTask = new Map(tasks.map(t => [t.id, t]))
      const es: Edge[] = []
      for (const t of tasks) {
        if (t.predecessorId && idToTask.has(t.predecessorId)) {
          es.push({ id: `${t.predecessorId}-${t.id}`, source: t.predecessorId, target: t.id, type: 'deletable', data: { onDeleteEdge } as any })
        }
      }
      return es
    })
  }, [tasks, onDeleteEdge, loadLayout, saveLayout])

  const onNodesChange = useCallback<OnNodesChange>((changes) => setNodes((ns) => {
    const next = applyNodeChanges(changes, ns)
    // persist layout on any move/position change
    saveLayout(next)
    return next
  }), [saveLayout])
  const onEdgesChange = useCallback<OnEdgesChange>((changes) => {
    // Handle deletions: clear predecessor on target
    const removed = changes.filter((c: any) => c.type === 'remove') as Array<{ id: string }>
    if (removed.length && onDeleteEdge) {
      const byId = new Map(edges.map(e => [e.id, e]))
      removed.forEach(({ id }) => {
        const e = byId.get(id)
        if (e?.source && e?.target) {
          try { onDeleteEdge(e.source, e.target) } catch (err) { console.error('onDeleteEdge failed', err) }
        }
      })
    }
    setEdges((es) => applyEdgeChanges(changes, es))
  }, [edges, onDeleteEdge])
  const onConnect = useCallback<OnConnect>(async (params) => {
    const source = params.source
    const target = params.target
    if (!source || !target || source === target) return

    const idToTask = new Map(tasks.map(t => [t.id, t]))

    // prevent cycles: cannot set target.predecessor = source if target is an ancestor of source
    const isAncestor = (ancestorId: string, nodeId: string): boolean => {
      const visited = new Set<string>()
      let cur: string | undefined = nodeId
      let steps = 0
      while (cur && steps < 1024 && idToTask.has(cur) && !visited.has(cur)) {
        if (cur === ancestorId) return true
        visited.add(cur)
        const t = idToTask.get(cur)!
        cur = t.predecessorId || undefined
        steps++
      }
      return false
    }

    if (isAncestor(target, source)) {
      // would create a cycle
      try { alert('无法连接：会产生循环依赖') } catch {}
      return
    }

    // optimistically draw edge: replace any existing predecessor of target
    setEdges((es) => {
      const filtered = es.filter(e => e.target !== target)
      return addEdge({ source, target, type: 'deletable', data: { onDeleteEdge } as any }, filtered)
    })

    try {
      await onConnectEdge?.(source, target)
    } catch (err) {
      // revert by rebuilding from tasks on next effect; also show a hint
      console.error('Failed to set predecessor', err)
      try { alert('设置前置任务失败') } catch {}
    }
  }, [tasks, onConnectEdge])

  const edgeTypes = useMemo(() => ({ deletable: DeletableEdge }), [])
  const nodeTypes = useMemo(() => ({ task: TaskNode }), [])

  // Relayout on demand: apply default column layout and reset Y based on createdAt order
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const relayout = useCallback(() => {
    setNodes((_) => {
      saveLayout(initialNodes)
      return initialNodes
    })
    setEdges(initialEdges)
    try { rfInstance?.fitView?.({ padding: 0.2 }) } catch {}
  }, [initialNodes, initialEdges, rfInstance, saveLayout])

  return (
    <div style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(inst) => setRfInstance(inst)}
        fitView
        onNodeClick={(_, n) => onSelect?.(n.id)}
      >
        <Background />
        <Controls />
        <MiniMap zoomable pannable />
        <Panel position="top-right">
          <button onClick={relayout} style={{ background: '#111827', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>重新布局</button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
