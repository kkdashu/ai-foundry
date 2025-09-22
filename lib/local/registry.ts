import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface LocalProjectRecord {
  projectId: string
  path: string
  createdAt: string
  updatedAt: string
}

interface RegistryFile {
  version: 1
  projects: Record<string, LocalProjectRecord>
}

const APP_DIR_NAME = 'ai-foundry'
const FILE_NAME = 'local-projects.json'

function getConfigDir() {
  const platform = process.platform
  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, APP_DIR_NAME)
  }
  // macOS and Linux use the same XDG scheme
  const base = process.env.LOCAL_REGISTRY_DIR || process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(base, APP_DIR_NAME)
}

function getLegacyDarwinPath() {
  // Previous location used "Library/Application Support" on macOS
  return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR_NAME, FILE_NAME)
}

export function getRegistryPath() {
  return path.join(getConfigDir(), FILE_NAME)
}

async function ensureDirExists(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {}
}

async function readJsonSafe(filePath: string): Promise<RegistryFile | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    if (!('version' in data) || !('projects' in data)) return null
    return data as RegistryFile
  } catch {
    return null
  }
}

async function writeJsonAtomic(filePath: string, data: any) {
  const dir = path.dirname(filePath)
  await ensureDirExists(dir)
  const tmp = filePath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, filePath)
}

export async function loadRegistry(): Promise<RegistryFile> {
  const file = getRegistryPath()
  let existing = await readJsonSafe(file)
  if (existing) return existing

  // Attempt one-time migration from legacy macOS path if present
  if (process.platform === 'darwin') {
    const legacy = getLegacyDarwinPath()
    const legacyData = await readJsonSafe(legacy)
    if (legacyData) {
      try {
        await ensureDirExists(path.dirname(file))
        await fs.copyFile(legacy, file)
        existing = legacyData
        return existing
      } catch {
        // ignore and fallthrough to create empty registry
      }
    }
  }

  const empty: RegistryFile = { version: 1, projects: {} }
  await writeJsonAtomic(file, empty)
  return empty
}

export async function saveRegistry(reg: RegistryFile) {
  await writeJsonAtomic(getRegistryPath(), reg)
}

function normalizePath(p: string) {
  if (!p) return ''
  let s = p.trim()
  // Remove surrounding quotes if pasted from terminal
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  if (s.startsWith('~')) {
    s = path.join(os.homedir(), s.slice(1))
  }
  // Resolve to absolute
  return path.resolve(s)
}

export async function validateDirectoryExists(dir: string): Promise<{ ok: boolean; reason?: string; path?: string }> {
  try {
    const abs = normalizePath(dir)
    const st = await fs.stat(abs)
    if (!st.isDirectory()) {
      return { ok: false, reason: 'Not a directory' }
    }
    return { ok: true, path: abs }
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Path not accessible' }
  }
}

export async function getLocalPath(projectId: string): Promise<string | null> {
  const reg = await loadRegistry()
  return reg.projects[projectId]?.path || null
}

export async function setLocalPath(projectId: string, dir: string) {
  const reg = await loadRegistry()
  const now = new Date().toISOString()
  const abs = normalizePath(dir)
  reg.projects[projectId] = reg.projects[projectId]
    ? { ...reg.projects[projectId], path: abs, updatedAt: now }
    : { projectId, path: abs, createdAt: now, updatedAt: now }
  await saveRegistry(reg)
  return reg.projects[projectId]
}

export async function removeLocalPath(projectId: string) {
  const reg = await loadRegistry()
  delete reg.projects[projectId]
  await saveRegistry(reg)
}

export async function listAllLocal(): Promise<LocalProjectRecord[]> {
  const reg = await loadRegistry()
  return Object.values(reg.projects)
}

