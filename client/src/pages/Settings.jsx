import { useState } from 'react'
import { FolderCog, FolderPlus, Info, Moon, Palette, RotateCw, Sun, Trash2, TriangleAlert } from 'lucide-react'
import { useResource } from '../data'
import { api, applyTheme, errorInfo } from '../lib'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, CardHeader, GitHubMark, GitHubSetup, IconButton, Modal, PageHeader, Segmented, Skeleton, TextInput } from '../components/ui'

const technologies = ['MongoDB', 'Express.js', 'React', 'Node.js', 'Vite', 'Tailwind CSS', 'Recharts', 'Git CLI', 'GitHub REST API']

function GitHubSection() {
  const profile = useResource('/github/profile')
  return (
    <Card>
      <CardHeader
        icon={GitHubMark}
        title="GitHub connection"
        description="The token lives only in server/.env and is never sent to the browser."
        action={
          <Button size="sm" icon={RotateCw} onClick={profile.refresh} loading={profile.loading}>
            Test connection
          </Button>
        }
      />
      {profile.loading && !profile.data ? (
        <div className="flex items-center gap-4 p-5">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ) : profile.data ? (
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <img src={profile.data.avatarUrl} alt="" className="size-12 rounded-full border border-line" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-fg">
              {profile.data.name || profile.data.login}
              <Badge tone="success">Connected</Badge>
            </p>
            <a href={profile.data.htmlUrl} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-info">
              @{profile.data.login}
            </a>
          </div>
          <p className="text-xs leading-5 text-subtle sm:max-w-xs sm:text-right">
            To change accounts, edit GITHUB_TOKEN in server/.env and restart the backend.
          </p>
        </div>
      ) : profile.error?.code === 'NOT_CONFIGURED' ? (
        <GitHubSetup />
      ) : (
        <div className="space-y-4">
          <p role="alert" className="mx-5 mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {profile.error?.message}
          </p>
          <GitHubSetup className="!pt-0" />
        </div>
      )}
    </Card>
  )
}

function DirectoriesSection() {
  const toast = useToast()
  const local = useResource('/repos', { revalidate: true })
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)

  async function addDirectory(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/repos/directories', { path })
      toast.success('Folder added.')
      setPath('')
      local.refresh()
    } catch (requestError) {
      setError(errorInfo(requestError).message)
    } finally {
      setSaving(false)
    }
  }

  async function removeDirectory() {
    const directory = confirmRemove
    setConfirmRemove(null)
    setRemoving(directory)
    try {
      await api.delete('/repos/directories', { data: { path: directory } })
      toast.success('Folder removed. Your files were not touched.')
      local.refresh()
    } catch (requestError) {
      toast.error(errorInfo(requestError).message)
    } finally {
      setRemoving(null)
    }
  }

  const directories = local.data?.directories || []

  return (
    <Card>
      <CardHeader icon={FolderCog} title="Project folders" description="CommitFlow only scans these folders and their immediate subfolders for Git repositories." />
      <div className="p-5">
        {local.loading && !local.data ? (
          <Skeleton className="h-12 w-full" />
        ) : directories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-sm text-muted">No folders configured yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {directories.map((directory) => (
              <li key={directory.path} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg" title={directory.path}>
                  {directory.path}
                </span>
                {!directory.exists && <Badge tone="danger">Missing</Badge>}
                {directory.source === 'env' ? (
                  <Badge title="Configured with ALLOWED_REPO_DIRS in server/.env">.env</Badge>
                ) : (
                  <IconButton
                    label={`Remove ${directory.path}`}
                    icon={Trash2}
                    size="sm"
                    variant="ghost"
                    loading={removing === directory.path}
                    onClick={() => setConfirmRemove(directory.path)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addDirectory} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextInput
            label="Add a folder"
            placeholder="C:\Users\You\Projects"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            className="flex-1"
            spellCheck={false}
          />
          <Button type="submit" icon={FolderPlus} loading={saving} disabled={!path.trim()}>
            Add folder
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <p className="mt-3 text-xs leading-5 text-subtle">Folders marked .env come from ALLOWED_REPO_DIRS and can only be changed in server/.env.</p>
      </div>
      <Modal
        open={Boolean(confirmRemove)}
        onClose={() => setConfirmRemove(null)}
        title="Remove this folder?"
        description="CommitFlow will stop showing repositories from this folder. No files on your computer are deleted."
        footer={
          <>
            <Button onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} onClick={removeDirectory}>
              Remove folder
            </Button>
          </>
        }
      >
        <p className="truncate rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs text-fg">{confirmRemove}</p>
      </Modal>
    </Card>
  )
}

function AppearanceSection() {
  const toast = useToast()
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('light') ? 'light' : 'dark'))

  async function changeTheme(nextTheme) {
    const previous = theme
    setTheme(nextTheme)
    applyTheme(nextTheme)
    try {
      await api.put('/settings', { theme: nextTheme })
    } catch (error) {
      setTheme(previous)
      applyTheme(previous)
      toast.error(errorInfo(error).message)
    }
  }

  return (
    <Card>
      <CardHeader
        icon={Palette}
        title="Appearance"
        description="Saved to MongoDB so it is remembered next time."
        action={
          <Segmented
            label="Theme"
            value={theme}
            onChange={changeTheme}
            options={[
              { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" />Dark</span> },
              { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun className="size-3.5" />Light</span> }
            ]}
          />
        }
      />
    </Card>
  )
}

function AboutSection() {
  const health = useResource('/health')
  return (
    <Card>
      <CardHeader icon={Info} title="About CommitFlow" description="A minimalist GitHub activity tracker and local Git manager." />
      <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-subtle">Version</dt>
          <dd className="mt-1 font-mono text-fg">1.0.0</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Git</dt>
          <dd className="mt-1 font-mono text-fg">{health.data ? health.data.git || 'Not found on PATH' : '…'}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Database</dt>
          <dd className="mt-1 text-fg">{health.data ? (health.data.database ? 'MongoDB connected' : 'MongoDB disconnected') : '…'}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Runs on</dt>
          <dd className="mt-1 text-fg">Your computer only (127.0.0.1)</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-subtle">Built with</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {technologies.map((technology) => (
              <Badge key={technology}>{technology}</Badge>
            ))}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

export default function Settings() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Connections, project folders, and preferences" />
      <div className="space-y-5">
        <GitHubSection />
        <DirectoriesSection />
        <AppearanceSection />
        <AboutSection />
      </div>
    </div>
  )
}
