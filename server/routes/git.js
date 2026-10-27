import { Router } from 'express'
import { fail } from '../services/errors.js'
import { findRepository, readBranches, readDiff, readStatus, runGit } from '../services/git.js'

const router = Router()
const networkTimeout = 120000

async function loadRepository(repoId) {
  const repository = await findRepository(repoId)
  const status = await readStatus(repository.path)
  return { repository, status }
}

function pickFiles(status, requested, isAllowed) {
  if (!Array.isArray(requested) || requested.length === 0) throw fail(400, 'Select at least one file.')
  if (requested.length > 1000) throw fail(400, 'Too many files in one request.')
  return requested.map((requestedPath) => {
    const file = status.files.find((item) => item.path === requestedPath)
    if (typeof requestedPath !== 'string' || !file || !isAllowed(file)) {
      throw fail(400, `"${String(requestedPath).slice(0, 200)}" is not a changed file in this repository.`)
    }
    return file
  })
}

async function runInBatches(repositoryPath, baseArgs, paths, action) {
  for (let start = 0; start < paths.length; start += 100) {
    await runGit(repositoryPath, [...baseArgs, '--', ...paths.slice(start, start + 100)], { action })
  }
}

async function readUpstream(repositoryPath, branch) {
  const read = (key) =>
    runGit(repositoryPath, ['config', '--get', `branch.${branch}.${key}`])
      .then((value) => value.trim())
      .catch(() => '')
  const [remote, merge] = await Promise.all([read('remote'), read('merge')])
  return remote && merge ? { remote, merge } : null
}

router.post('/stage', async (req, res) => {
  const { repository, status } = await loadRepository(req.body?.repoId)
  if (req.body?.all === true) {
    if (status.counts.total === 0) throw fail(400, 'There are no changes to stage.')
    await runGit(repository.path, ['add', '-A'], { action: 'Staging' })
  } else {
    const files = pickFiles(status, req.body?.files, (file) => file.untracked || file.conflicted || file.worktree !== '.')
    await runInBatches(repository.path, ['add'], files.map((file) => file.path), 'Staging')
  }
  res.json({ message: 'Changes staged.' })
})

router.post('/unstage', async (req, res) => {
  const { repository, status } = await loadRepository(req.body?.repoId)
  const isStaged = (file) => !file.untracked && !file.conflicted && file.index !== '.'
  const files = req.body?.all === true ? status.files.filter(isStaged) : pickFiles(status, req.body?.files, isStaged)
  if (files.length === 0) throw fail(400, 'There are no staged files.')
  const paths = files.flatMap((file) => (file.origPath ? [file.path, file.origPath] : [file.path]))
  const baseArgs = status.hasCommits ? ['restore', '--staged'] : ['rm', '--cached', '-q', '-r']
  await runInBatches(repository.path, baseArgs, paths, 'Unstaging')
  res.json({ message: 'Changes unstaged.' })
})

router.get('/diff', async (req, res) => {
  const { repository, status } = await loadRepository(req.query.repoId)
  const staged = req.query.staged === 'true'
  const isAllowed = (file) => (staged ? file.index !== '.' && !file.untracked : file.worktree !== '.')
  const [file] = pickFiles(status, [req.query.file], isAllowed)
  res.json({ file, staged, ...(await readDiff(repository.path, file, staged)) })
})

router.post('/commit', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  if (!message) throw fail(400, 'Write a commit message first.')
  if (message.length > 5000) throw fail(400, 'The commit message is too long.')
  const { repository, status } = await loadRepository(req.body?.repoId)
  if (status.counts.conflicted > 0) throw fail(409, 'Resolve and stage the conflicted files before committing.')
  if (status.counts.staged === 0) throw fail(400, 'Stage at least one file before committing.')
  await runGit(repository.path, ['commit', '-m', message], { action: 'Commit', timeout: 60000 })
  const hash = (await runGit(repository.path, ['rev-parse', '--short', 'HEAD'])).trim()
  res.status(201).json({ message: `Committed ${hash} to ${status.branch}.`, hash })
})

router.post('/push', async (req, res) => {
  const { repository, status } = await loadRepository(req.body?.repoId)
  if (status.detached) throw fail(400, 'You are not on a branch (detached HEAD). Switch to a branch before pushing.')
  const upstream = await readUpstream(repository.path, status.branch)
  if (!upstream) {
    throw fail(
      400,
      `Branch "${status.branch}" has no upstream. Run "git push -u origin ${status.branch}" once in a terminal, then push from CommitFlow.`,
      'NO_UPSTREAM'
    )
  }
  if (status.upstream && status.ahead === 0) throw fail(400, 'Nothing to push. This branch has no commits waiting to be pushed.')
  await runGit(repository.path, ['push', upstream.remote, `HEAD:${upstream.merge}`], { action: 'Push', timeout: networkTimeout })
  res.json({ message: `Pushed ${status.branch} to ${upstream.remote}.` })
})

router.post('/fetch', async (req, res) => {
  const { repository } = await loadRepository(req.body?.repoId)
  const remotes = (await runGit(repository.path, ['remote'])).trim()
  if (!remotes) throw fail(400, 'This repository has no remote configured, so there is nothing to fetch.')
  await runGit(repository.path, ['fetch', '--all'], { action: 'Fetch', timeout: networkTimeout })
  res.json({ message: 'Fetched the latest changes from the remote.' })
})

router.post('/pull', async (req, res) => {
  const { repository, status } = await loadRepository(req.body?.repoId)
  if (status.detached) throw fail(400, 'You are not on a branch (detached HEAD). Switch to a branch before pulling.')
  if (!status.upstream) throw fail(400, `Branch "${status.branch}" has no upstream, so Git does not know what to pull.`, 'NO_UPSTREAM')
  if (status.counts.conflicted > 0) throw fail(409, 'This repository already has unresolved conflicts. Resolve them before pulling.')
  if (status.counts.modified > 0 && req.body?.confirmed !== true) {
    throw fail(409, 'You have uncommitted changes. Confirm to pull anyway.', 'LOCAL_CHANGES')
  }
  const output = await runGit(repository.path, ['pull'], { action: 'Pull', timeout: networkTimeout })
  res.json({ message: /already up to date/i.test(output) ? 'Already up to date.' : `Pulled the latest changes into ${status.branch}.` })
})

router.post('/branches', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!name || name.startsWith('-')) throw fail(400, 'Enter a valid branch name.')
  const { repository } = await loadRepository(req.body?.repoId)
  try {
    await runGit(repository.path, ['check-ref-format', '--branch', name])
  } catch {
    throw fail(400, `"${name.slice(0, 100)}" is not a valid branch name. Avoid spaces and characters such as ~ ^ : ? * [`)
  }
  const branches = await readBranches(repository.path)
  if (branches.some((branch) => branch.name === name)) throw fail(409, `A branch named "${name}" already exists.`)
  await runGit(repository.path, ['switch', '-c', name], { action: 'Creating branch' })
  res.status(201).json({ message: `Created and switched to ${name}.` })
})

router.post('/checkout', async (req, res) => {
  const { repository, status } = await loadRepository(req.body?.repoId)
  const branches = await readBranches(repository.path)
  const target = branches.find((branch) => branch.name === req.body?.branch)
  if (!target) throw fail(404, 'That branch does not exist in this repository.')
  if (target.current) throw fail(400, `You are already on ${target.name}.`)
  if (status.counts.modified > 0) {
    throw fail(409, 'You have uncommitted changes. Commit them before switching branches so no work is lost.', 'LOCAL_CHANGES')
  }
  await runGit(repository.path, ['switch', target.name], { action: 'Switching branch' })
  res.json({ message: `Switched to ${target.name}.` })
})

export default router
