import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GitCommitHorizontal, Info, SearchX } from 'lucide-react'
import { useResource } from '../data'
import { dayKey, formatDate, plural } from '../lib'
import ActivityItem from '../components/ActivityItem'
import { Card, EmptyState, ErrorState, ListSkeleton, PageHeader, RefreshButton, Segmented, Select } from '../components/ui'

function dayHeading(key) {
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  return formatDate(`${key}T12:00:00`, { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function Activity() {
  const [days, setDays] = useState('30')
  const [language, setLanguage] = useState('all')
  const activity = useResource(`/github/activity?days=${days}`)
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') || '').trim().toLowerCase()

  const commits = activity.data?.commits || []
  const languages = useMemo(() => [...new Set(commits.map((commit) => commit.repository.language).filter(Boolean))].sort(), [commits])

  const groups = useMemo(() => {
    const filtered = commits.filter(
      (commit) =>
        (!query || commit.repository.name.toLowerCase().includes(query) || commit.message.toLowerCase().includes(query)) &&
        (language === 'all' || commit.repository.language === language)
    )
    const byDay = new Map()
    for (const commit of filtered) {
      const key = dayKey(commit.date)
      byDay.set(key, [...(byDay.get(key) || []), commit])
    }
    return [...byDay.entries()]
  }, [commits, query, language])

  const shownCount = groups.reduce((sum, [, items]) => sum + items.length, 0)

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Your recent commits across GitHub repositories"
        actions={<RefreshButton onClick={activity.refresh} loading={activity.loading} />}
      />

      {activity.data && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 text-xs leading-5 text-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <p>
            Showing commits authored by <span className="font-medium text-fg">@{activity.data.login}</span> on the default branch of the{' '}
            {plural(activity.data.repositoriesScanned, 'repository', 'repositories')} you pushed to most recently (out of {activity.data.repositoriesTotal})
            in the last {activity.data.days} days. Other event types such as issues and pull requests are not included.
          </p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmented
          label="Date range"
          value={days}
          onChange={(value) => {
            setDays(value)
            setLanguage('all')
          }}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' }
          ]}
        />
        <Select label="Language" value={language} onChange={setLanguage}>
          <option value="all">All languages</option>
          {languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        {activity.data && <span className="ml-auto text-xs text-subtle">{plural(shownCount, 'commit')}</span>}
      </div>

      {activity.error ? (
        <Card>
          <ErrorState error={activity.error} onRetry={activity.refresh} />
        </Card>
      ) : activity.loading && !activity.data ? (
        <Card>
          <ListSkeleton rows={8} />
        </Card>
      ) : commits.length === 0 ? (
        <Card>
          <EmptyState icon={GitCommitHorizontal} title="No commits in this period" description="Try a longer date range." />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title="No matching commits" description="Try a different search or language filter." />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, items]) => (
            <section key={key}>
              <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted">
                <span className="size-1.5 rounded-full bg-line-strong" />
                {dayHeading(key)}
                <span className="text-subtle">· {plural(items.length, 'commit')}</span>
              </h2>
              <Card>
                <ul className="divide-y divide-line">
                  {items.map((commit) => (
                    <ActivityItem key={`${commit.repository.fullName}-${commit.sha}`} commit={commit} showDate />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
