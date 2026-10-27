import { useEffect, useId } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, KeyRound, Loader2, RotateCw, TriangleAlert, X } from 'lucide-react'
import { languageColor } from '../lib'

const buttonVariants = {
  primary: 'border-transparent bg-accent-strong text-white hover:bg-accent-hover',
  secondary: 'border-line bg-elevated text-fg hover:border-line-strong hover:bg-hover',
  outline: 'border-line bg-transparent text-fg hover:bg-hover',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-hover hover:text-fg',
  danger: 'border-danger/40 bg-transparent text-danger hover:bg-danger/10'
}

const buttonSizes = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm'
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading = false, className = '', children, disabled, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  )
}

export function IconButton({ label, size = 'md', className = '', ...props }) {
  return <Button aria-label={label} title={label} size={size} className={`${size === 'sm' ? 'w-8' : 'w-9'} !px-0 ${className}`} {...props} />
}

export function RefreshButton({ onClick, loading, label = 'Refresh' }) {
  return (
    <Button icon={RotateCw} onClick={onClick} disabled={loading} className={loading ? '[&>svg]:animate-spin' : ''}>
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}

export function Card({ className = '', children, ...props }) {
  return (
    <section className={`rounded-xl border border-line bg-card ${className}`} {...props}>
      {children}
    </section>
  )
}

export function CardHeader({ title, description, action, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted" />}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, hint, loading, to }) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="flex size-7 items-center justify-center rounded-md border border-line bg-elevated">
          <Icon className="size-3.5 text-muted" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-fg sm:text-3xl">{value}</p>
      )}
      <p className="mt-1 truncate text-xs text-subtle">{loading ? ' ' : hint}</p>
    </>
  )
  const className = 'block rounded-xl border border-line bg-card p-4 transition-colors hover:border-line-strong sm:p-5'
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

const badgeTones = {
  success: 'border-accent/25 bg-accent/10 text-accent',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-danger/25 bg-danger/10 text-danger',
  info: 'border-info/25 bg-info/10 text-info',
  neutral: 'border-line bg-hover text-muted'
}

export function Badge({ tone = 'neutral', icon: Icon, children, className = '', ...props }) {
  return (
    <span {...props} className={`inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium ${badgeTones[tone]} ${className}`}>
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  )
}

export function RepoStatusBadges({ repo }) {
  if (repo.error) return <Badge tone="danger">Unavailable</Badge>
  const { counts } = repo
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {counts.conflicted > 0 && <Badge tone="danger">Conflicts</Badge>}
      {counts.modified - counts.conflicted > 0 && <Badge tone="warning">Modified</Badge>}
      {counts.untracked > 0 && <Badge tone="info">Untracked files</Badge>}
      {counts.total === 0 && <Badge tone="success">Clean</Badge>}
      {repo.detached && <Badge>Detached HEAD</Badge>}
      {repo.sync === 'ahead' && <Badge tone="info">Ahead {repo.ahead}</Badge>}
      {repo.sync === 'behind' && <Badge tone="warning">Behind {repo.behind}</Badge>}
      {repo.sync === 'diverged' && (
        <Badge tone="danger">
          Diverged {repo.ahead}/{repo.behind}
        </Badge>
      )}
      {repo.sync === 'no-upstream' && !repo.detached && <Badge>No upstream</Badge>}
    </div>
  )
}

export function Skeleton({ className = '', ...props }) {
  return <div className={`animate-pulse rounded-md bg-hover ${className}`} {...props} />
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-5 py-4">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      {Icon && (
        <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-elevated">
          <Icon className="size-5 text-muted" />
        </span>
      )}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className = '', showSetup = true }) {
  if (error?.code === 'NOT_CONFIGURED') {
    if (showSetup) return <GitHubSetup className={className} />
    return <EmptyState className={className} icon={KeyRound} title="GitHub not connected" description="Add a GitHub token to see this information." />
  }
  return (
    <EmptyState
      className={className}
      icon={TriangleAlert}
      title={error?.code === 'RATE_LIMITED' ? 'GitHub rate limit reached' : 'Something went wrong'}
      description={error?.message}
      action={onRetry && error?.code !== 'RATE_LIMITED' && <Button icon={RotateCw} onClick={onRetry}>Try again</Button>}
    />
  )
}

export function GitHubSetup({ className = '' }) {
  return (
    <div className={`px-5 py-6 sm:px-6 ${className}`}>
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-elevated">
          <KeyRound className="size-5 text-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-fg">Connect your GitHub account</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            CommitFlow reads your repositories and commits using a personal access token kept only on the backend.
          </p>
          <ol className="mt-4 space-y-2 text-sm text-muted">
            <li>
              <span className="mr-2 font-mono text-subtle">1</span>
              Create a fine-grained token at{' '}
              <a className="text-info hover:underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                github.com/settings/personal-access-tokens
              </a>{' '}
              with read-only <span className="text-fg">Metadata</span> and <span className="text-fg">Contents</span> access.
            </li>
            <li>
              <span className="mr-2 font-mono text-subtle">2</span>
              Add it to <code className="rounded bg-hover px-1.5 py-0.5 font-mono text-xs text-fg">server/.env</code> as shown below.
            </li>
            <li>
              <span className="mr-2 font-mono text-subtle">3</span>
              Restart the backend and refresh this page.
            </li>
          </ol>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-canvas px-4 py-3 font-mono text-xs text-fg">GITHUB_TOKEN=github_pat_xxxxxxxxxxxx</pre>
        </div>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const handleKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:items-center" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`w-full ${size === 'lg' ? 'max-w-xl' : 'max-w-md'} rounded-xl border border-line bg-card shadow-2xl shadow-black/50`}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-fg">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
          </div>
          <IconButton label="Close dialog" icon={X} variant="ghost" size="sm" onClick={onClose} />
        </div>
        {children ? <div className="px-5 py-4">{children}</div> : <div className="h-4" />}
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-9 items-center rounded-lg border border-line bg-elevated p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-full whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors ${
            value === option.value ? 'bg-hover text-fg shadow-sm ring-1 ring-line-strong' : 'text-muted hover:text-fg'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Select({ label, value, onChange, children }) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-line bg-elevated pl-3 pr-8 text-xs font-medium text-fg outline-none transition-colors hover:border-line-strong"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
    </label>
  )
}

export function TextInput({ label, hideLabel = false, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className={hideLabel ? 'sr-only' : 'mb-1.5 block text-xs font-medium text-muted'}>{label}</span>
      <input
        className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-line-strong focus:border-info"
        {...props}
      />
    </label>
  )
}

export function LanguageDot({ language }) {
  if (!language) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: languageColor(language) }} />
      <span className="truncate">{language}</span>
    </span>
  )
}

export function GitHubMark({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-card">
      <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
        <path d="M10 8v16M10 16h7a5 5 0 0 0 5-5V8" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="10" cy="8" r="3" fill="var(--card)" stroke="var(--accent)" strokeWidth="2.4" />
        <circle cx="10" cy="24" r="3" fill="var(--card)" stroke="var(--accent)" strokeWidth="2.4" />
        <circle cx="22" cy="8" r="3" fill="var(--accent)" />
      </svg>
    </span>
  )
}
