import { ArrowUpRight, GitFork, Lock, Star } from 'lucide-react'
import { timeAgo } from '../lib'
import { Badge, LanguageDot } from './ui'

export default function RepositoryCard({ repo }) {
  return (
    <article className="group relative flex h-44 flex-col rounded-xl border border-line bg-card p-5 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-subtle">{repo.owner}</p>
          <h3 className="truncate text-[15px] font-semibold text-fg">
            <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="after:absolute after:inset-0 after:rounded-xl hover:text-info">
              {repo.name}
            </a>
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {repo.archived && <Badge tone="warning">Archived</Badge>}
          {repo.private ? <Badge icon={Lock}>Private</Badge> : <Badge>Public</Badge>}
        </div>
      </div>
      <p className={`mt-2 line-clamp-2 text-sm leading-6 ${repo.description ? 'text-muted' : 'italic text-subtle'}`}>
        {repo.description || 'No description provided'}
      </p>
      <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-muted">
        <LanguageDot language={repo.language} />
        <span className="inline-flex items-center gap-1" title="Stars">
          <Star className="size-3.5" />
          {repo.stars}
        </span>
        <span className="inline-flex items-center gap-1" title="Forks">
          <GitFork className="size-3.5" />
          {repo.forks}
        </span>
        <span className="ml-auto truncate text-subtle">Updated {timeAgo(repo.updatedAt)}</span>
        <ArrowUpRight className="size-3.5 shrink-0 text-subtle transition-colors group-hover:text-info" />
      </div>
    </article>
  )
}
