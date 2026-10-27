import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ExternalLink, FolderGit2, FolderPlus, GitBranch, SearchX, TriangleAlert } from 'lucide-react'
import { useResource } from '../data'
import { api, errorInfo, plural, timeAgo } from '../lib'
import { useToast } from '../components/Toast'
import { Button, Card, EmptyState, ErrorState, ListSkeleton, Modal, PageHeader, RefreshButton, RepoStatusBadges, Segmented, TextInput } from '../components/ui'

const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'changes', label: 'Changes' },
  { value: 'unpushed', label: 'Unpushed' },
  { value: 'behind', label: 'Behind' },
  { value: 'no-upstream', label: 'No upstream' },
  { value: 'clean', label: 'Clean' }
]

function matchesFilter(repo, filter) {
  if (filter === 'all') return true
  if (repo.error) return false
  if (filter === 'changes') return repo.counts.total > 0
  if (filter === 'unpushed') return repo.ahead > 0
  if (filter === 'behind') return repo.behind > 0
  if (filter === 'no-upstream') return repo.sync === 'no-upstream'
  return repo.counts.total === 0
}

export function AddDirectoryModal({ open, onClose, onAdded }) {
  const toast = useToast()
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/repos/directories', { path })
      toast.success('Folder added. Scanning for repositories…')
      setPath('')
      onAdded()
      onClose()
    } catch (requestError) {
      setError(errorInfo(requestError).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a projects folder"
      description="CommitFlow looks for Git repositories in this folder and its immediate subfolders. Nothing outside it is scanned."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput
          label="Folder path"
          placeholder="C:\Users\You\Projects"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          autoFocus
          spellCheck={false}
        />
        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!path.trim()}>
            Add folder
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ProjectRow({ repo }) {
  return (
    <li className="relative grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-hover/40 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.6fr)_7rem_2rem] md:items-center md:gap-4">
      <div className="min-w-0">
        <Link to={`/projects/${repo.id}`} className="truncate text-sm font-semibold text-fg after:absolute after:inset-0 hover:text-info">
          {repo.name}
        </Link>
        <p className="mt-0.5 truncate font-mono text-[11px] text-subtle" title={repo.path}>
          {repo.path}
        </p>
      </div>
      {repo.error ? (
        <p className="text-xs text-danger md:col-span-3">{repo.error}</p>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-3 font-mono text-xs text-muted">
            <span className="inline-flex min-w-0 items-center gap-1">
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate">{repo.branch}</span>
            </span>
            {repo.ahead > 0 && (
              <span className="inline-flex items-center text-info" title="Commits to push">
                <ArrowUp className="size-3" />
                {repo.ahead}
              </span>
            )}
            {repo.behind > 0 && (
              <span className="inline-flex items-center text-warning" title="Commits to pull">
                <ArrowDown className="size-3" />
                {repo.behind}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <RepoStatusBadges repo={repo} />
            {repo.counts.total > 0 && (
              <p className="mt-1 text-[11px] text-subtle">
                {plural(repo.counts.modified, 'modified file')} · {repo.counts.untracked} untracked
              </p>
            )}
          </div>
          <span className="text-xs text-subtle">{repo.lastCommitAt ? timeAgo(repo.lastCommitAt) : 'No commits'}</span>
        </>
      )}
      <div className="hidden justify-end md:flex">
        {repo.remote?.browseUrl && (
          <a
            href={repo.remote.browseUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${repo.name} remote`}
            title={repo.remote.url}
            className="relative z-10 rounded-md p-1.5 text-subtle hover:bg-hover hover:text-fg"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </li>
  )
}

export default function LocalProjects() {
  const local = useResource('/repos', { revalidate: true })
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') || '').trim().toLowerCase()
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)

  const repositories = local.data?.repositories || []
  const directories = local.data?.directories || []
  const filtered = useMemo(
    () => repositories.filter((repo) => (!query || repo.name.toLowerCase().includes(query)) && matchesFilter(repo, filter)),
    [repositories, query, filter]
  )

  return (
    <div>
      <PageHeader
        title="Local Projects"
        description="Git repositories found in your configured folders"
        actions={
          <>
            <RefreshButton onClick={local.refresh} loading={local.loading} />
            <Button variant="primary" icon={FolderPlus} onClick={() => setAdding(true)}>
              Add folder
            </Button>
          </>
        }
      />

      {directories.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="text-subtle">Scanning</span>
          {directories.map((directory) => (
            <span
              key={directory.path}
              title={directory.exists ? directory.path : 'This folder does not exist'}
              className={`max-w-full truncate rounded-md border px-2 py-1 font-mono text-[11px] ${directory.exists ? 'border-line bg-card' : 'border-danger/30 text-danger line-through'}`}
            >
              {directory.path}
            </span>
          ))}
        </div>
      )}

      {local.error ? (
        <Card>
          <ErrorState error={local.error} onRetry={local.refresh} />
        </Card>
      ) : local.loading && !local.data ? (
        <Card>
          <ListSkeleton rows={5} />
        </Card>
      ) : directories.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderPlus}
            title="Add your projects folder"
            description="Choose a folder such as C:\Users\You\Projects. CommitFlow will list the Git repositories inside it."
            action={
              <Button variant="primary" icon={FolderPlus} onClick={() => setAdding(true)}>
                Add folder
              </Button>
            }
          />
        </Card>
      ) : repositories.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderGit2}
            title="No Git repositories found"
            description="None of the configured folders contain a Git repository directly inside them. Add the folder that holds your project folders."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 overflow-x-auto">
            <Segmented label="Status filter" value={filter} onChange={setFilter} options={statusFilters} />
          </div>
          <Card>
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.6fr)_7rem_2rem] gap-4 border-b border-line px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-subtle md:grid">
              <span>Repository</span>
              <span>Branch</span>
              <span>Status</span>
              <span>Last commit</span>
              <span />
            </div>
            {filtered.length === 0 ? (
              <EmptyState icon={SearchX} title="No matching projects" description="Try another search or status filter." />
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((repo) => (
                  <ProjectRow key={repo.id} repo={repo} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <AddDirectoryModal open={adding} onClose={() => setAdding(false)} onAdded={local.refresh} />
    </div>
  )
}
