import { Laptop } from 'lucide-react'
import { repositoryUrl } from '../lib'
import { Card, EmptyState, GitHubMark, PageHeader } from '../components/ui'

export function RunLocally({ className = '' }) {
  return (
    <EmptyState
      className={className}
      icon={Laptop}
      title="Local projects run on your computer"
      description="This online version shows GitHub data only. Run CommitFlow on your own machine to see your local repositories and stage, commit, push and pull from the browser."
      action={
        <a
          href={`${repositoryUrl}#5-installation`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-transparent bg-accent-strong px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <GitHubMark className="size-4" />
          How to run it locally
        </a>
      }
    />
  )
}

export default function LocalOnly() {
  return (
    <div>
      <PageHeader title="Local Projects" description="Git repositories on your computer" />
      <Card>
        <RunLocally className="py-16" />
      </Card>
    </div>
  )
}
