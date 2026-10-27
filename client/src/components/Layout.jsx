import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, BookMarked, FolderGit2, LayoutDashboard, Menu, Search, Settings, X } from 'lucide-react'
import { useResource } from '../data'
import { GitHubMark, Logo } from './ui'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/repositories', label: 'Repositories', icon: BookMarked },
  { to: '/projects', label: 'Local Projects', icon: FolderGit2 },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings }
]

const searchablePages = {
  '/repositories': 'Search repositories',
  '/projects': 'Search local projects',
  '/activity': 'Search commits or repositories'
}

function pageTitle(pathname) {
  if (pathname.startsWith('/projects/')) return 'Project'
  return navigation.find((item) => item.to === pathname)?.label || 'CommitFlow'
}

function ConnectionIndicator({ profile }) {
  if (profile.loading && !profile.data) return <span className="text-xs text-subtle">Checking GitHub…</span>
  if (profile.data) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
        <span className="size-2 shrink-0 rounded-full bg-accent" />
        <span className="truncate">Connected as {profile.data.login}</span>
      </span>
    )
  }
  const labels = { NOT_CONFIGURED: 'GitHub not connected', SERVER_OFFLINE: 'Backend offline' }
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className={`size-2 rounded-full ${profile.error?.code === 'NOT_CONFIGURED' ? 'bg-subtle' : 'bg-danger'}`} />
      {labels[profile.error?.code] || 'GitHub connection issue'}
    </span>
  )
}

function Sidebar({ profile, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo />
        <span className="text-[15px] font-semibold tracking-tight text-fg">CommitFlow</span>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-3">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                isActive ? 'bg-hover text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
                <Icon className={`size-4 ${isActive ? 'text-fg' : 'text-subtle group-hover:text-muted'}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line px-5 py-4">
        <ConnectionIndicator profile={profile} />
      </div>
    </div>
  )
}

function SearchBox() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const searchable = searchablePages[location.pathname]
  const value = searchable ? searchParams.get('q') || '' : draft

  useEffect(() => {
    const focusSearch = (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [])

  function handleChange(nextValue) {
    if (!searchable) return setDraft(nextValue)
    const next = new URLSearchParams(searchParams)
    if (nextValue) next.set('q', nextValue)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!searchable && draft.trim()) {
      navigate(`/repositories?q=${encodeURIComponent(draft.trim())}`)
      setDraft('')
    }
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={searchable || 'Search repositories'}
        aria-label={searchable || 'Search repositories'}
        className="h-9 w-full rounded-lg border border-line bg-card pl-9 pr-9 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-line-strong focus:border-info"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[10px] text-subtle sm:block">/</kbd>
    </form>
  )
}

export default function Layout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const profile = useResource('/github/profile')

  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-sidebar lg:block">
        <Sidebar profile={profile} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <aside className="animate-toast-in relative h-full w-64 border-r border-line bg-sidebar">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-lg p-2 text-muted hover:bg-hover hover:text-fg"
            >
              <X className="size-4" />
            </button>
            <Sidebar profile={profile} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 rounded-lg p-2 text-muted hover:bg-hover hover:text-fg lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <p className="hidden w-40 shrink-0 truncate text-sm font-semibold text-fg md:block">{pageTitle(location.pathname)}</p>
          <div className="flex flex-1 justify-center md:justify-start">
            <SearchBox />
          </div>
          <div className="flex items-center gap-3">
            {profile.data ? (
              <>
                <span className="hidden items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-muted xl:inline-flex">
                  <GitHubMark className="size-3.5" />
                  Connected
                </span>
                <a href={profile.data.htmlUrl} target="_blank" rel="noreferrer" title={`${profile.data.login} on GitHub`}>
                  <img src={profile.data.avatarUrl} alt={`${profile.data.login} avatar`} className="size-8 rounded-full border border-line" />
                </a>
              </>
            ) : (
              <NavLink
                to="/settings"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-muted hover:text-fg"
              >
                <GitHubMark className="size-3.5" />
                <span className="hidden sm:inline">{profile.loading ? 'Checking…' : 'Not connected'}</span>
              </NavLink>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
