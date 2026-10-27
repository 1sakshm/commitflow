import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, BookMarked, FilePen, FolderGit2, GitBranch, GitCommitHorizontal, History } from 'lucide-react'
import { useResource } from '../data'
import { dayKey, formatDate, plural, timeAgo } from '../lib'
import ActivityItem from '../components/ActivityItem'
import { Card, CardHeader, EmptyState, ErrorState, GitHubSetup, ListSkeleton, RefreshButton, RepoStatusBadges, Skeleton, StatCard } from '../components/ui'

function buildDailyCounts(commits, days) {
  const counts = new Map()
  for (const commit of commits) counts.set(dayKey(commit.date), (counts.get(dayKey(commit.date)) || 0) + 1)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - (days - 1 - index))
    return { key: dayKey(date), label: formatDate(date, { month: 'short', day: 'numeric' }), commits: counts.get(dayKey(date)) || 0 }
  })
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-elevated px-3 py-2 text-xs shadow-xl shadow-black/30">
      <p className="text-muted">{point.label}</p>
      <p className="mt-0.5 font-semibold text-fg">{plural(point.commits, 'commit')}</p>
    </div>
  )
}

function ContributionChart({ activity }) {
  const data = useMemo(() => buildDailyCounts(activity.data?.commits || [], 30), [activity.data])
  const total = data.reduce((sum, day) => sum + day.commits, 0)
  const activeDays = data.filter((day) => day.commits > 0).length
  const busiest = data.reduce((best, day) => (day.commits > best.commits ? day : best), data[0])

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        icon={GitCommitHorizontal}
        title="Commit activity · last 30 days"
        description={
          activity.data
            ? `Commits you authored on the default branch of your ${plural(activity.data.repositoriesScanned, 'most recently pushed repository', 'most recently pushed repositories')}. This is not GitHub's full contribution graph.`
            : 'Commits you authored in your most recently pushed repositories.'
        }
      />
      {activity.error ? (
        <ErrorState error={activity.error} onRetry={activity.refresh} showSetup={false} />
      ) : activity.loading && !activity.data ? (
        <div className="p-5">
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <div className="px-3 pb-4 pt-4 sm:px-5">
          <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2 px-2 text-xs">
            <div>
              <dt className="text-subtle">Total</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-fg">{total}</dd>
            </div>
            <div>
              <dt className="text-subtle">Active days</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-fg">{activeDays}/30</dd>
            </div>
            <div>
              <dt className="text-subtle">Busiest day</dt>
              <dd className="mt-0.5 text-base font-semibold text-fg">{busiest?.commits ? `${busiest.label} · ${busiest.commits}` : '—'}</dd>
            </div>
          </dl>
          {total === 0 ? (
            <EmptyState icon={History} title="No commits in the last 30 days" description="Commits you push to GitHub will appear here." />
          ) : (
            <div className="h-56" role="img" aria-label={`Bar chart of ${total} commits over the last 30 days`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap={3}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--subtle)', fontSize: 11 }} minTickGap={28} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--subtle)', fontSize: 11 }} width={44} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover)' }} />
                  <Bar dataKey="commits" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function LocalStatusCard({ local }) {
  const repositories = local.data?.repositories || []
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={FolderGit2}
        title="Local projects"
        description="Live status read from Git on this computer"
        action={
          <Link to="/projects" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted hover:text-fg">
            View all <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      {local.error ? (
        <ErrorState error={local.error} onRetry={local.refresh} />
      ) : local.loading && !local.data ? (
        <ListSkeleton rows={4} />
      ) : repositories.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No local projects yet"
          description="Add a folder that contains your Git repositories."
          action={
            <Link to="/projects" className="text-sm font-medium text-info hover:underline">
              Add a projects folder
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {repositories.slice(0, 6).map((repo) => (
            <li key={repo.id}>
              <Link to={`/projects/${repo.id}`} className="block px-5 py-3 transition-colors hover:bg-hover/40">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-fg">{repo.name}</span>
                  {!repo.error && (
                    <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px] text-muted">
                      <GitBranch className="size-3 shrink-0" />
                      <span className="truncate">{repo.branch}</span>
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <RepoStatusBadges repo={repo} />
                  {!repo.error && repo.counts.total > 0 && (
                    <span className="shrink-0 text-[11px] text-subtle">{plural(repo.counts.total, 'change')}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function Overview() {
  const profile = useResource('/github/profile')
  const repos = useResource('/github/repos')
  const activity = useResource('/github/activity?days=30')
  const local = useResource('/repos', { revalidate: true })

  const notConfigured = profile.error?.code === 'NOT_CONFIGURED'
  const localRepositories = local.data?.repositories || []
  const changedProjects = localRepositories.filter((repo) => !repo.error && repo.counts.total > 0)
  const totalChanges = changedProjects.reduce((sum, repo) => sum + repo.counts.total, 0)
  const privateCount = repos.data?.filter((repo) => repo.private).length || 0
  const refreshing = profile.loading || repos.loading || activity.loading || local.loading

  function refreshAll() {
    profile.refresh()
    repos.refresh()
    activity.refresh()
    local.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">Your development, at a glance.</h1>
          <p className="mt-1.5 text-sm text-muted">
            {profile.data ? (
              <>
                Signed in to GitHub as{' '}
                <a href={profile.data.htmlUrl} target="_blank" rel="noreferrer" className="font-medium text-fg hover:text-info">
                  @{profile.data.login}
                </a>
              </>
            ) : notConfigured ? (
              'GitHub is not connected yet. Local projects still work.'
            ) : (
              'Loading your GitHub profile…'
            )}
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <RefreshButton onClick={refreshAll} loading={refreshing} />
        </div>
      </div>

      {notConfigured && (
        <Card>
          <GitHubSetup />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={BookMarked}
          label="GitHub repositories"
          to="/repositories"
          loading={repos.loading && !repos.data}
          value={repos.data ? repos.data.length : '—'}
          hint={repos.data ? `${repos.data.length - privateCount} public · ${privateCount} private` : 'Unavailable'}
        />
        <StatCard
          icon={GitCommitHorizontal}
          label="Recent commits"
          to="/activity"
          loading={activity.loading && !activity.data}
          value={activity.data ? activity.data.commits.length : '—'}
          hint={activity.data ? 'Authored by you · last 30 days' : 'Unavailable'}
        />
        <StatCard
          icon={FolderGit2}
          label="Local projects"
          to="/projects"
          loading={local.loading && !local.data}
          value={local.data ? localRepositories.length : '—'}
          hint={local.data ? `In ${plural(local.data.directories.length, 'configured folder')}` : 'Unavailable'}
        />
        <StatCard
          icon={FilePen}
          label="Uncommitted changes"
          to="/projects"
          loading={local.loading && !local.data}
          value={local.data ? totalChanges : '—'}
          hint={local.data ? (changedProjects.length ? `Across ${plural(changedProjects.length, 'project')}` : 'All projects are clean') : 'Unavailable'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ContributionChart activity={activity} />
        <LocalStatusCard local={local} />
      </div>

      <Card>
        <CardHeader
          icon={History}
          title="Recent activity"
          description={activity.data ? `Last updated ${timeAgo(activity.loadedAt)}` : 'Your latest commits on GitHub'}
          action={
            <Link to="/activity" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted hover:text-fg">
              View all <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        {activity.error ? (
          <ErrorState error={activity.error} onRetry={activity.refresh} showSetup={false} />
        ) : activity.loading && !activity.data ? (
          <ListSkeleton rows={5} />
        ) : activity.data.commits.length === 0 ? (
          <EmptyState icon={GitCommitHorizontal} title="No recent commits" description="Nothing authored by you in the last 30 days." />
        ) : (
          <ul className="divide-y divide-line">
            {activity.data.commits.slice(0, 8).map((commit) => (
              <ActivityItem key={`${commit.repository.fullName}-${commit.sha}`} commit={commit} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
