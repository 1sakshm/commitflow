import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  CloudDownload,
  ExternalLink,
  FileDiff,
  FolderGit2,
  GitBranch,
  GitBranchPlus,
  GitCommitHorizontal,
  History,
  Info,
  Minus,
  Plus,
  RotateCw,
  TriangleAlert
} from 'lucide-react'
import { useResource } from '../data'
import { api, errorInfo, formatDate, plural, timeAgo } from '../lib'
import { useToast } from '../components/Toast'
import DiffViewer from '../components/DiffViewer'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, IconButton, ListSkeleton, Modal, RepoStatusBadges, Skeleton, TextInput } from '../components/ui'

const fileStatus = {
  M: { letter: 'M', label: 'Modified', className: 'text-warning' },
  A: { letter: 'A', label: 'Added', className: 'text-accent' },
  D: { letter: 'D', label: 'Deleted', className: 'text-danger' },
  R: { letter: 'R', label: 'Renamed', className: 'text-info' },
  C: { letter: 'C', label: 'Copied', className: 'text-info' },
  T: { letter: 'T', label: 'Type changed', className: 'text-warning' },
  '?': { letter: 'U', label: 'Untracked', className: 'text-accent' },
  U: { letter: '!', label: 'Conflict', className: 'text-danger' }
}

function StatusLetter({ code }) {
  const status = fileStatus[code] || fileStatus.M
  return (
    <span title={status.label} className={`w-4 shrink-0 text-center font-mono text-xs font-semibold ${status.className}`}>
      {status.letter}
    </span>
  )
}

function FileName({ path, origPath }) {
  const slash = path.lastIndexOf('/')
  return (
    <span className="min-w-0 flex-1 truncate text-left text-[13px]" title={origPath ? `${origPath} → ${path}` : path}>
      <span className="text-fg">{path.slice(slash + 1)}</span>
      {slash > 0 && <span className="ml-1.5 text-subtle">{path.slice(0, slash)}</span>}
    </span>
  )
}

function FileList({ title, files, staged, selected, onSelect, onToggle, onToggleAll, busy }) {
  return (
    <div>
      <div className="flex h-10 items-center justify-between gap-2 border-b border-line px-4">
        <h3 className="text-xs font-semibold text-muted">
          {title} <span className="ml-1 rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-muted">{files.length}</span>
        </h3>
        {files.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onToggleAll} disabled={Boolean(busy)} loading={busy === `${staged ? 'unstage' : 'stage'}:all`}>
            {staged ? 'Unstage all' : 'Stage all'}
          </Button>
        )}
      </div>
      {files.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs text-subtle">{staged ? 'No staged changes yet' : 'No unstaged changes'}</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto py-1">
          {files.map((file) => {
            const isSelected = selected?.path === file.path && selected?.staged === staged
            const code = staged ? file.index : file.untracked ? '?' : file.conflicted ? 'U' : file.worktree
            return (
              <li key={file.path} className={`group flex items-center gap-1 pr-2 ${isSelected ? 'bg-info/10' : 'hover:bg-hover/50'}`}>
                <button
                  type="button"
                  onClick={() => onSelect({ path: file.path, staged })}
                  aria-pressed={isSelected}
                  className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-4"
                >
                  <StatusLetter code={code} />
                  <FileName path={file.path} origPath={staged ? file.origPath : null} />
                </button>
                <IconButton
                  label={staged ? `Unstage ${file.path}` : `Stage ${file.path}`}
                  icon={staged ? Minus : Plus}
                  size="sm"
                  variant="ghost"
                  className="size-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  disabled={Boolean(busy)}
                  loading={busy === `${staged ? 'unstage' : 'stage'}:${file.path}`}
                  onClick={() => onToggle(file)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function BranchModal({ open, onClose, branches, hasChanges, busy, onSwitch, onCreate }) {
  const [name, setName] = useState('')

  async function handleCreate(event) {
    event.preventDefault()
    if (await onCreate(name.trim())) setName('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Branches" description="Switch to another local branch or create a new one from the current commit.">
      {hasChanges && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          You have uncommitted changes. Commit them before switching branches. Creating a new branch keeps your changes.
        </p>
      )}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
        {branches.loading && !branches.data ? (
          <ListSkeleton rows={3} />
        ) : branches.error ? (
          <p className="p-4 text-sm text-danger">{branches.error.message}</p>
        ) : (
          <ul className="divide-y divide-line">
            {branches.data.map((branch) => (
              <li key={branch.name} className="flex items-center gap-3 px-3 py-2.5">
                <GitBranch className={`size-4 shrink-0 ${branch.current ? 'text-accent' : 'text-subtle'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] text-fg">{branch.name}</p>
                  <p className="truncate text-[11px] text-subtle">
                    {branch.upstream ? `${branch.upstream} ${branch.track}` : 'No upstream'} · {timeAgo(branch.lastCommitAt)}
                  </p>
                </div>
                {branch.current ? (
                  <Badge tone="success" icon={Check}>
                    Current
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => onSwitch(branch.name)} disabled={hasChanges || Boolean(busy)} loading={busy === `checkout:${branch.name}`}>
                    Switch
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={handleCreate} className="mt-4 flex items-end gap-2">
        <TextInput
          label="New branch name"
          placeholder="feature/my-change"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="flex-1"
          spellCheck={false}
        />
        <Button type="submit" variant="primary" icon={GitBranchPlus} disabled={!name.trim() || Boolean(busy)} loading={busy === 'branch'}>
          Create
        </Button>
      </form>
    </Modal>
  )
}

function CommitFiles({ repoId, commit, browseUrl }) {
  const files = useResource(commit ? `/repos/${repoId}/commits/${commit.hash}` : null)
  if (!commit) return <EmptyState icon={GitCommitHorizontal} title="Select a commit" description="Choose a commit to see the files it changed." />
  return (
    <div>
      <div className="border-b border-line px-5 py-4">
        <p className="text-sm font-medium text-fg">{commit.message}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="font-mono">{commit.shortHash}</span>
          <span className="text-subtle">·</span>
          {commit.author}
          <span className="text-subtle">·</span>
          {formatDate(commit.date, { dateStyle: 'medium', timeStyle: 'short' })}
          {browseUrl && /github\.com/.test(browseUrl) && (
            <a href={`${browseUrl}/commit/${commit.hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-info hover:underline">
              View on GitHub <ExternalLink className="size-3" />
            </a>
          )}
        </p>
      </div>
      {files.loading && !files.data ? (
        <ListSkeleton rows={3} />
      ) : files.error ? (
        <p className="p-5 text-sm text-danger">{files.error.message}</p>
      ) : files.data.length === 0 ? (
        <p className="p-5 text-sm text-subtle">This commit has no file changes to show (it may be a merge commit).</p>
      ) : (
        <ul className="max-h-[28rem] overflow-y-auto py-1">
          {files.data.map((file) => (
            <li key={`${file.status}-${file.path}`} className="flex items-center gap-2.5 px-5 py-1.5">
              <StatusLetter code={file.status} />
              <FileName path={file.path} origPath={file.origPath} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const toast = useToast()
  const status = useResource(`/repos/${id}/status`, { revalidate: true })
  const history = useResource(`/repos/${id}/history`, { revalidate: true })
  const branches = useResource(`/repos/${id}/branches`, { revalidate: true })
  const [tab, setTab] = useState('changes')
  const [busy, setBusy] = useState(null)
  const [selected, setSelected] = useState(null)
  const [selectedCommit, setSelectedCommit] = useState(null)
  const [message, setMessage] = useState('')
  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const [confirmPullOpen, setConfirmPullOpen] = useState(false)
  const [diff, setDiff] = useState({ result: null, loading: false, error: null })

  const repo = status.data
  const files = useMemo(() => repo?.files || [], [repo])
  const stagedFiles = useMemo(() => files.filter((file) => !file.untracked && !file.conflicted && file.index !== '.'), [files])
  const unstagedFiles = useMemo(() => files.filter((file) => file.untracked || file.conflicted || file.worktree !== '.'), [files])
  const hasTrackedChanges = (repo?.counts.modified || 0) > 0

  useEffect(() => {
    if (!selected || !repo) return
    const list = selected.staged ? stagedFiles : unstagedFiles
    if (list.some((file) => file.path === selected.path)) return
    const otherList = selected.staged ? unstagedFiles : stagedFiles
    setSelected(otherList.some((file) => file.path === selected.path) ? { path: selected.path, staged: !selected.staged } : null)
  }, [repo, selected, stagedFiles, unstagedFiles])

  useEffect(() => {
    if (!selected) {
      setDiff({ result: null, loading: false, error: null })
      return
    }
    let cancelled = false
    setDiff((current) => ({
      result: current.result?.file.path === selected.path && current.result?.staged === selected.staged ? current.result : null,
      loading: true,
      error: null
    }))
    api
      .get('/git/diff', { params: { repoId: id, file: selected.path, staged: selected.staged } })
      .then((response) => !cancelled && setDiff({ result: response.data, loading: false, error: null }))
      .catch((error) => !cancelled && setDiff({ result: null, loading: false, error: errorInfo(error).message }))
    return () => {
      cancelled = true
    }
  }, [id, selected, status.loadedAt])

  function refreshAll() {
    status.refresh()
    history.refresh()
    branches.refresh()
  }

  async function run(operation, request) {
    setBusy(operation)
    try {
      const response = await request()
      toast.success(response.data.message)
      return true
    } catch (error) {
      toast.error(errorInfo(error).message)
      return false
    } finally {
      setBusy(null)
      refreshAll()
    }
  }

  const toggleFile = (file, staged) =>
    run(`${staged ? 'unstage' : 'stage'}:${file.path}`, () => api.post(staged ? '/git/unstage' : '/git/stage', { repoId: id, files: [file.path] }))

  const toggleAll = (staged) => run(`${staged ? 'unstage' : 'stage'}:all`, () => api.post(staged ? '/git/unstage' : '/git/stage', { repoId: id, all: true }))

  async function handleCommit(event) {
    event?.preventDefault()
    if (!message.trim() || stagedFiles.length === 0 || busy) return
    if (await run('commit', () => api.post('/git/commit', { repoId: id, message }))) setMessage('')
  }

  function handlePull() {
    if (hasTrackedChanges) setConfirmPullOpen(true)
    else run('pull', () => api.post('/git/pull', { repoId: id }))
  }

  async function confirmPull() {
    setConfirmPullOpen(false)
    await run('pull', () => api.post('/git/pull', { repoId: id, confirmed: true }))
  }

  const switchBranch = async (branch) => {
    if (await run(`checkout:${branch}`, () => api.post('/git/checkout', { repoId: id, branch }))) setBranchModalOpen(false)
  }

  const createBranch = async (name) => {
    const created = await run('branch', () => api.post('/git/branches', { repoId: id, name }))
    if (created) setBranchModalOpen(false)
    return created
  }

  if (status.error && !repo) {
    return (
      <div>
        <Link to="/projects" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Local Projects
        </Link>
        <Card>
          <ErrorState error={status.error} onRetry={status.refresh} />
        </Card>
      </div>
    )
  }

  if (!repo) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  const lastCommit = history.data?.[0]
  const commitDisabledReason = stagedFiles.length === 0 ? 'Stage at least one file to commit.' : !message.trim() ? 'Write a commit message.' : null

  return (
    <div>
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Local Projects
      </Link>

      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <FolderGit2 className="size-6 text-muted" />
            <h1 className="truncate text-2xl font-semibold tracking-tight text-fg">{repo.name}</h1>
            <RepoStatusBadges repo={repo} />
          </div>
          <p className="mt-1 truncate font-mono text-xs text-subtle" title={repo.path}>
            {repo.path}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Button icon={GitBranch} onClick={() => setBranchModalOpen(true)} className="max-w-56 font-mono">
            <span className="truncate">{repo.branch}</span>
            <ChevronDown className="size-3.5 text-muted" />
          </Button>
          <Button icon={CloudDownload} onClick={() => run('fetch', () => api.post('/git/fetch', { repoId: id }))} loading={busy === 'fetch'} disabled={Boolean(busy)}>
            Fetch
          </Button>
          <Button icon={ArrowDownToLine} onClick={handlePull} loading={busy === 'pull'} disabled={Boolean(busy)}>
            Pull{repo.behind > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-[11px] text-warning">{repo.behind}</span>}
          </Button>
          <Button
            icon={ArrowUpFromLine}
            variant={repo.ahead > 0 ? 'primary' : 'secondary'}
            onClick={() => run('push', () => api.post('/git/push', { repoId: id }))}
            loading={busy === 'push'}
            disabled={Boolean(busy)}
          >
            Push{repo.ahead > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{repo.ahead}</span>}
          </Button>
          <IconButton label="Refresh status" icon={RotateCw} onClick={refreshAll} disabled={status.loading} className={status.loading ? '[&>svg]:animate-spin' : ''} />
        </div>
      </div>

      <Card className="mb-5 grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
        <div className="min-w-0 px-5 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">Upstream</p>
          <p className="mt-1 truncate font-mono text-xs text-fg">{repo.upstream || 'Not configured'}</p>
        </div>
        <div className="min-w-0 px-5 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">Sync</p>
          <p className="mt-1 text-xs text-fg">
            {repo.sync === 'no-upstream' ? '—' : repo.sync === 'synced' ? 'Up to date' : `${repo.ahead} to push · ${repo.behind} to pull`}
          </p>
        </div>
        <div className="min-w-0 px-5 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">Remote</p>
          {repo.remote ? (
            repo.remote.browseUrl ? (
              <a href={repo.remote.browseUrl} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 truncate text-xs text-info hover:underline" title={repo.remote.url}>
                <span className="truncate">{repo.remote.browseUrl.replace(/^https:\/\//, '')}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : (
              <p className="mt-1 truncate font-mono text-xs text-fg" title={repo.remote.url}>
                {repo.remote.name}
              </p>
            )
          ) : (
            <p className="mt-1 text-xs text-fg">None</p>
          )}
        </div>
        <div className="min-w-0 px-5 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">Last commit</p>
          <p className="mt-1 truncate text-xs text-fg">{lastCommit ? timeAgo(lastCommit.date) : 'No commits yet'}</p>
        </div>
      </Card>

      {(repo.sync === 'no-upstream' || repo.counts.conflicted > 0) && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 text-xs leading-5 text-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          {repo.counts.conflicted > 0 ? (
            <p>
              <span className="font-medium text-danger">{plural(repo.counts.conflicted, 'file has', 'files have')} merge conflicts.</span> Open them in your editor, resolve the
              conflict markers, then stage and commit them here.
            </p>
          ) : repo.remote ? (
            <p>
              <span className="font-medium text-fg">{repo.branch}</span> has no upstream branch, so it cannot be pushed or pulled yet. Publish it once with{' '}
              <code className="rounded bg-hover px-1.5 py-0.5 font-mono text-fg">git push -u {repo.remote.name} {repo.branch}</code>.
            </p>
          ) : (
            <p>This repository has no remote configured. Committing works, but fetch, pull, and push need a remote.</p>
          )}
        </div>
      )}

      <div role="tablist" aria-label="Repository sections" className="mb-4 flex gap-1 border-b border-line">
        {[
          { value: 'changes', label: 'Changes', icon: FileDiff, count: files.length },
          { value: 'history', label: 'History', icon: History }
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
              tab === item.value ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
            {item.count > 0 && <span className="rounded-full bg-hover px-1.5 text-[11px] text-muted">{item.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'changes' ? (
        <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <FileList
                title="Staged"
                files={stagedFiles}
                staged
                selected={selected}
                onSelect={setSelected}
                onToggle={(file) => toggleFile(file, true)}
                onToggleAll={() => toggleAll(true)}
                busy={busy}
              />
              <div className="border-t border-line">
                <FileList
                  title="Changes"
                  files={unstagedFiles}
                  staged={false}
                  selected={selected}
                  onSelect={setSelected}
                  onToggle={(file) => toggleFile(file, false)}
                  onToggleAll={() => toggleAll(false)}
                  busy={busy}
                />
              </div>
            </Card>
            <Card>
              <form onSubmit={handleCommit} className="p-4">
                <label htmlFor="commit-message" className="mb-1.5 block text-xs font-medium text-muted">
                  Commit message
                </label>
                <textarea
                  id="commit-message"
                  rows={3}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => (event.ctrlKey || event.metaKey) && event.key === 'Enter' && handleCommit()}
                  placeholder="Summarize your change"
                  className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-line-strong focus:border-info"
                />
                <Button type="submit" variant="primary" icon={GitCommitHorizontal} className="mt-3 w-full" disabled={Boolean(commitDisabledReason) || Boolean(busy)} loading={busy === 'commit'}>
                  <span className="truncate">
                    Commit {stagedFiles.length > 0 && plural(stagedFiles.length, 'file')} to {repo.branch}
                  </span>
                </Button>
                <p className="mt-2 text-center text-[11px] text-subtle">{commitDisabledReason || 'Press Ctrl + Enter to commit'}</p>
              </form>
            </Card>
          </div>
          <Card className="min-w-0 overflow-hidden">
            <CardHeader
              icon={FileDiff}
              title={selected ? selected.path : 'Diff'}
              description={selected ? (selected.staged ? 'Staged changes' : 'Unstaged changes') : 'No file selected'}
            />
            {files.length === 0 && !selected ? (
              <EmptyState icon={Check} title="Working tree clean" description="There are no local changes in this repository." />
            ) : (
              <DiffViewer result={diff.result} loading={diff.loading} error={diff.error} />
            )}
          </Card>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader icon={History} title="Recent commits" description="The latest 20 commits on this branch" />
            {history.loading && !history.data ? (
              <ListSkeleton rows={6} />
            ) : history.error ? (
              <ErrorState error={history.error} onRetry={history.refresh} />
            ) : history.data.length === 0 ? (
              <EmptyState icon={GitCommitHorizontal} title="No commits yet" description="Make your first commit from the Changes tab." />
            ) : (
              <ul className="divide-y divide-line">
                {history.data.map((commit) => (
                  <li key={commit.hash}>
                    <button
                      type="button"
                      onClick={() => setSelectedCommit(commit)}
                      aria-pressed={selectedCommit?.hash === commit.hash}
                      className={`flex w-full items-start gap-3 px-5 py-3 text-left transition-colors ${selectedCommit?.hash === commit.hash ? 'bg-info/10' : 'hover:bg-hover/40'}`}
                    >
                      <span className="mt-0.5 shrink-0 rounded-md border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted">{commit.shortHash}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-fg">{commit.message}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {commit.author} · {timeAgo(commit.date)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="min-w-0 self-start overflow-hidden">
            <CommitFiles repoId={id} commit={selectedCommit} browseUrl={repo.remote?.browseUrl} />
          </Card>
        </div>
      )}

      <BranchModal
        open={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        branches={branches}
        hasChanges={hasTrackedChanges}
        busy={busy}
        onSwitch={switchBranch}
        onCreate={createBranch}
      />

      <Modal
        open={confirmPullOpen}
        onClose={() => setConfirmPullOpen(false)}
        title="Pull with uncommitted changes?"
        description={`You have ${plural(repo.counts.modified, 'uncommitted change')}. If incoming commits touch the same files, Git will stop the pull or report conflicts. CommitFlow never discards your local work.`}
        footer={
          <>
            <Button onClick={() => setConfirmPullOpen(false)}>Cancel</Button>
            <Button variant="primary" icon={ArrowDownToLine} onClick={confirmPull}>
              Pull anyway
            </Button>
          </>
        }
      />
    </div>
  )
}
