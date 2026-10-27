import { GitCommitHorizontal } from 'lucide-react'
import { formatDate, timeAgo } from '../lib'

export default function ActivityItem({ commit, showDate = false }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-hover/40">
      {commit.avatarUrl ? (
        <img src={commit.avatarUrl} alt="" className="mt-0.5 size-7 shrink-0 rounded-full border border-line" />
      ) : (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-elevated">
          <GitCommitHorizontal className="size-3.5 text-muted" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <a href={commit.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-fg hover:text-info" title={commit.message}>
          {commit.message}
        </a>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <a href={commit.repository.url} target="_blank" rel="noreferrer" className="truncate font-medium text-muted hover:text-info">
            {commit.repository.name}
          </a>
          <span className="text-subtle">·</span>
          <span className="truncate">{commit.author}</span>
          <span className="text-subtle">·</span>
          <time dateTime={commit.date} title={formatDate(commit.date, { dateStyle: 'medium', timeStyle: 'short' })} className="shrink-0">
            {showDate ? formatDate(commit.date, { timeStyle: 'short' }) : timeAgo(commit.date)}
          </time>
        </p>
      </div>
      <a
        href={commit.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open commit ${commit.shortSha} on GitHub`}
        className="shrink-0 rounded-md border border-line bg-elevated px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        {commit.shortSha}
      </a>
    </li>
  )
}
