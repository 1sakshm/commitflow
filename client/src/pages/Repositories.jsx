import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookMarked, SearchX } from 'lucide-react'
import { useResource } from '../data'
import { plural } from '../lib'
import RepositoryCard from '../components/RepositoryCard'
import { Button, Card, EmptyState, ErrorState, PageHeader, RefreshButton, Segmented, Select, Skeleton } from '../components/ui'

const pageSize = 24

export default function Repositories() {
  const repos = useResource('/github/repos')
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') || '').trim().toLowerCase()
  const [visibility, setVisibility] = useState('all')
  const [language, setLanguage] = useState('all')
  const [sort, setSort] = useState('updated')
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const languages = useMemo(
    () => [...new Set((repos.data || []).map((repo) => repo.language).filter(Boolean))].sort(),
    [repos.data]
  )

  const filtered = useMemo(() => {
    const result = (repos.data || []).filter(
      (repo) =>
        (!query || repo.fullName.toLowerCase().includes(query)) &&
        (visibility === 'all' || (visibility === 'private') === repo.private) &&
        (language === 'all' || repo.language === language)
    )
    return result.sort((first, second) =>
      sort === 'name' ? first.name.localeCompare(second.name) : new Date(second.updatedAt) - new Date(first.updatedAt)
    )
  }, [repos.data, query, visibility, language, sort])

  const resetFilters = () => {
    setVisibility('all')
    setLanguage('all')
  }

  return (
    <div>
      <PageHeader
        title="Repositories"
        description={repos.data ? `${plural(repos.data.length, 'repository', 'repositories')} accessible with your GitHub token` : 'Repositories from your GitHub account'}
        actions={<RefreshButton onClick={repos.refresh} loading={repos.loading} />}
      />

      {repos.error ? (
        <Card>
          <ErrorState error={repos.error} onRetry={repos.refresh} />
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Segmented
              label="Visibility"
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: 'all', label: 'All' },
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' }
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
            <Select label="Sort by" value={sort} onChange={setSort}>
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
            </Select>
            {repos.data && <span className="ml-auto text-xs text-subtle">{plural(filtered.length, 'result')}</span>}
          </div>

          {repos.loading && !repos.data ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }, (_, index) => (
                <Skeleton key={index} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : repos.data.length === 0 ? (
            <Card>
              <EmptyState icon={BookMarked} title="No repositories yet" description="Repositories you create or can access on GitHub will appear here." />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="No matching repositories"
                description="Try a different search or clear the filters."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.slice(0, visibleCount).map((repo) => (
                  <RepositoryCard key={repo.id} repo={repo} />
                ))}
              </div>
              {filtered.length > visibleCount && (
                <div className="mt-6 flex justify-center">
                  <Button onClick={() => setVisibleCount((count) => count + pageSize)}>
                    Show more ({filtered.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
