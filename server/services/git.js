import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import Preference from '../models/Preference.js'
import { fail } from './errors.js'

const gitEnvironment = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true', LANGUAGE: 'en' }

const knownErrors = [
  [/not a git repository/i, 400, 'this folder is not a Git repository.'],
  [/dubious ownership/i, 400, 'Git does not trust this folder because it belongs to another user. Add it with git config --global --add safe.directory.'],
  [/please tell me who you are|unable to auto-detect email/i, 400, 'Git does not know who you are. Set user.name and user.email with git config --global.'],
  [/authentication failed|could not read username|permission denied \(publickey\)|terminal prompts disabled|invalid username or password|error: 403/i, 401, 'authentication was rejected. Check your Git credential configuration.'],
  [/could not resolve host|failed to connect|connection timed out|unable to access|network is unreachable/i, 503, 'the remote could not be reached. Check your network connection.'],
  [/\[rejected\]|non-fast-forward|fetch first/i, 409, 'the remote has commits that you do not have locally. Pull first, then push again.'],
  [/has no upstream branch|no tracking information/i, 400, 'this branch has no upstream branch configured.'],
  [/CONFLICT|automatic merge failed|resolve all conflicts|unmerged files/i, 409, 'merge conflicts occurred. Resolve the conflicted files in your editor, stage them, and commit.'],
  [/would be overwritten by/i, 409, 'local changes would be overwritten. Commit your changes first.'],
  [/divergent branches|need to specify how to reconcile/i, 409, 'local and remote branches have diverged. Choose a pull strategy with git config pull.rebase false (merge) or true (rebase).'],
  [/nothing to commit|no changes added to commit/i, 400, 'there are no staged changes to commit.'],
  [/already exists/i, 409, 'a branch with that name already exists.'],
  [/index\.lock/i, 409, 'another Git process is using this repository. Wait a moment and try again.'],
  [/no remote repository specified|does not appear to be a git repository/i, 400, 'no usable remote is configured for this repository.']
]

function hideCredentials(text) {
  return text.replace(/(https?:\/\/)[^@\s/]+@/gi, '$1***@')
}

function describeGitError(error, action) {
  if (error.code === 'ENOENT') return fail(500, 'Git is not installed or is not available on PATH.', 'GIT_MISSING')
  if (error.killed) return fail(504, `${action} failed: the operation timed out.`)
  const output = `${error.stderr || ''}\n${error.stdout || ''}`
  const match = knownErrors.find(([pattern]) => pattern.test(output))
  if (match) return Object.assign(fail(match[1], `${action} failed: ${match[2]}`), { output })
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean)
  const detail = lines.find((line) => /^(fatal|error):/i.test(line)) || lines[0] || 'Git returned an error.'
  return Object.assign(fail(400, `${action} failed: ${hideCredentials(detail.replace(/^(fatal|error):\s*/i, '')).slice(0, 300)}`), { output })
}

export function runGit(cwd, args, { action = 'Git', timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, timeout, maxBuffer: 20 * 1024 * 1024, windowsHide: true, env: gitEnvironment },
      (error, stdout, stderr) => {
        if (error) reject(describeGitError(Object.assign(error, { stdout, stderr }), action))
        else resolve(stdout)
      }
    )
  })
}

export async function gitVersion() {
  try {
    return (await runGit(process.cwd(), ['--version'])).trim()
  } catch {
    return null
  }
}

function normalize(directory) {
  return path.resolve(directory)
}

function samePath(first, second) {
  return path.relative(first, second) === ''
}

export function isInside(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

function repositoryId(repositoryPath) {
  const key = process.platform === 'win32' ? repositoryPath.toLowerCase() : repositoryPath
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 12)
}

export async function listDirectories() {
  const fromEnvironment = (process.env.ALLOWED_REPO_DIRS || '')
    .split(/[;,]/)
    .map((directory) => directory.trim())
    .filter(Boolean)
    .map((directory) => ({ path: normalize(directory), source: 'env' }))
  const preference = await Preference.current()
  const fromUser = preference.repositoryDirectories.map((directory) => ({ path: normalize(directory), source: 'user' }))
  const unique = []
  for (const directory of [...fromEnvironment, ...fromUser]) {
    if (!unique.some((item) => samePath(item.path, directory.path))) unique.push(directory)
  }
  return Promise.all(unique.map(async (directory) => ({ ...directory, exists: await exists(directory.path) })))
}

export async function validateNewDirectory(input) {
  if (typeof input !== 'string' || !input.trim()) throw fail(400, 'Enter a folder path.')
  const requested = input.trim().replace(/^"(.*)"$/, '$1')
  if (!path.isAbsolute(requested)) throw fail(400, 'Use a full path, for example C:\\Users\\You\\Projects.')
  let realPath
  try {
    realPath = await fs.realpath(requested)
  } catch {
    throw fail(400, 'That folder does not exist.')
  }
  const stats = await fs.stat(realPath)
  if (!stats.isDirectory()) throw fail(400, 'That path is a file, not a folder.')
  if (samePath(realPath, path.parse(realPath).root)) throw fail(400, 'Choose a projects folder, not the root of a drive.')
  const directories = await listDirectories()
  if (directories.some((directory) => samePath(directory.path, realPath))) throw fail(409, 'That folder is already configured.')
  return realPath
}

export async function discoverRepositories() {
  const directories = (await listDirectories()).filter((directory) => directory.exists)
  const repositories = []
  const addRepository = (repositoryPath) => {
    if (repositories.some((repository) => samePath(repository.path, repositoryPath))) return
    repositories.push({ id: repositoryId(repositoryPath), name: path.basename(repositoryPath), path: repositoryPath })
  }
  for (const directory of directories) {
    if (await exists(path.join(directory.path, '.git'))) {
      addRepository(directory.path)
      continue
    }
    const entries = await fs.readdir(directory.path, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const candidate = path.join(directory.path, entry.name)
      if (await exists(path.join(candidate, '.git'))) addRepository(candidate)
    }
  }
  return repositories.sort((first, second) => first.name.localeCompare(second.name))
}

export async function findRepository(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{12}$/.test(id)) throw fail(400, 'Invalid repository id.')
  const repository = (await discoverRepositories()).find((item) => item.id === id)
  if (!repository) throw fail(404, 'Repository not found. It may have been moved, or its folder was removed from Settings.')
  return repository
}

export async function readStatus(repositoryPath) {
  const output = await runGit(repositoryPath, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], { action: 'Status' })
  const tokens = output.split('\0')
  const status = { branch: null, oid: null, upstream: null, ahead: 0, behind: 0, files: [] }
  for (let index = 0; index < tokens.length; index++) {
    const line = tokens[index]
    if (!line) continue
    const parts = line.split(' ')
    if (line.startsWith('# branch.head ')) status.branch = line.slice(14)
    else if (line.startsWith('# branch.oid ')) status.oid = line.slice(13)
    else if (line.startsWith('# branch.upstream ')) status.upstream = line.slice(18)
    else if (line.startsWith('# branch.ab ')) {
      status.ahead = Math.abs(Number(parts[2]))
      status.behind = Math.abs(Number(parts[3]))
    } else if (parts[0] === '1') {
      status.files.push({ path: parts.slice(8).join(' '), index: parts[1][0], worktree: parts[1][1] })
    } else if (parts[0] === '2') {
      status.files.push({ path: parts.slice(9).join(' '), origPath: tokens[++index], index: parts[1][0], worktree: parts[1][1] })
    } else if (parts[0] === 'u') {
      status.files.push({ path: parts.slice(10).join(' '), index: 'U', worktree: 'U', conflicted: true })
    } else if (parts[0] === '?') {
      status.files.push({ path: line.slice(2), index: '?', worktree: '?', untracked: true })
    }
  }
  const files = status.files
  const counts = {
    staged: files.filter((file) => !file.untracked && !file.conflicted && file.index !== '.').length,
    unstaged: files.filter((file) => !file.untracked && !file.conflicted && file.worktree !== '.').length,
    modified: files.filter((file) => !file.untracked).length,
    untracked: files.filter((file) => file.untracked).length,
    conflicted: files.filter((file) => file.conflicted).length,
    total: files.length
  }
  const sync = !status.upstream
    ? 'no-upstream'
    : status.ahead && status.behind
      ? 'diverged'
      : status.ahead
        ? 'ahead'
        : status.behind
          ? 'behind'
          : 'synced'
  return {
    ...status,
    counts,
    sync,
    detached: status.branch === '(detached)',
    hasCommits: status.oid !== '(initial)'
  }
}

function toBrowseUrl(remoteUrl) {
  const ssh = remoteUrl.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?\/?$/)
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`
  try {
    const url = new URL(remoteUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return `https://${url.host}${url.pathname.replace(/\.git\/?$/, '')}`
  } catch {
    return null
  }
}

export async function readRemote(repositoryPath) {
  const output = await runGit(repositoryPath, ['config', '--get-regexp', '^remote\\..*\\.url$']).catch(() => '')
  const remotes = output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split(' ')
      return { name: key.slice(7, -4), url: rest.join(' ') }
    })
  const remote = remotes.find((item) => item.name === 'origin') || remotes[0]
  if (!remote) return null
  return { name: remote.name, url: hideCredentials(remote.url), browseUrl: toBrowseUrl(remote.url) }
}

export async function describeRepository(repository) {
  try {
    const [status, lastCommit, remote] = await Promise.all([
      readStatus(repository.path),
      runGit(repository.path, ['log', '-1', '--format=%cI']).catch(() => ''),
      readRemote(repository.path)
    ])
    const { files, ...summary } = status
    return { ...repository, ...summary, remote, lastCommitAt: lastCommit.trim() || null }
  } catch (error) {
    return { ...repository, error: error.message }
  }
}

export async function readBranches(repositoryPath) {
  const output = await runGit(repositoryPath, [
    'for-each-ref',
    '--sort=-committerdate',
    '--format=%(HEAD)%00%(refname:short)%00%(upstream:short)%00%(upstream:track)%00%(committerdate:iso-strict)%00%(objectname:short)',
    'refs/heads'
  ], { action: 'Reading branches' })
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [head, name, upstream, track, date, hash] = line.split('\0')
      return { name, current: head === '*', upstream: upstream || null, track: track || '', lastCommitAt: date || null, hash }
    })
}

export async function readHistory(repositoryPath, limit = 20) {
  try {
    const output = await runGit(repositoryPath, ['log', '-n', String(limit), '--format=%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1e'], { action: 'Reading history' })
    return output
      .split('\x1e')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [hash, shortHash, author, date, message] = entry.split('\x1f')
        return { hash, shortHash, author, date, message }
      })
  } catch (error) {
    if (/does not have any commits|unknown revision|bad default revision/i.test(error.output || '')) return []
    throw error
  }
}

export async function readCommitFiles(repositoryPath, hash) {
  if (typeof hash !== 'string' || !/^[0-9a-f]{7,40}$/i.test(hash)) throw fail(400, 'Invalid commit hash.')
  const output = await runGit(repositoryPath, ['diff-tree', '-r', '--root', '--no-commit-id', '--name-status', '-z', hash], { action: 'Reading commit' })
  const tokens = output.split('\0').filter(Boolean)
  const files = []
  for (let index = 0; index < tokens.length; index++) {
    const code = tokens[index]
    if (code.startsWith('R') || code.startsWith('C')) {
      files.push({ status: code[0], origPath: tokens[index + 1], path: tokens[index + 2] })
      index += 2
    } else {
      files.push({ status: code[0], path: tokens[index + 1] })
      index += 1
    }
  }
  return files
}

const maximumDiffSize = 400 * 1024

export async function readDiff(repositoryPath, file, staged) {
  if (file.untracked) return previewUntrackedFile(repositoryPath, file.path)
  const paths = staged && file.origPath ? [file.path, file.origPath] : [file.path]
  const args = ['diff', '--no-color', '--no-ext-diff', '-M']
  if (staged) args.push('--cached')
  const output = await runGit(repositoryPath, [...args, '--', ...paths], { action: 'Reading diff' })
  const binary = /^Binary files .* differ$/m.test(output) || output.includes('GIT binary patch')
  return { binary, truncated: output.length > maximumDiffSize, diff: binary ? '' : output.slice(0, maximumDiffSize) }
}

async function previewUntrackedFile(repositoryPath, relativePath) {
  const repositoryRealPath = await fs.realpath(repositoryPath)
  const realPath = await fs.realpath(path.resolve(repositoryPath, relativePath)).catch(() => null)
  if (!realPath || !isInside(repositoryRealPath, realPath)) throw fail(400, 'That file is outside the repository.')
  const stats = await fs.stat(realPath)
  if (!stats.isFile()) return { binary: true, truncated: false, diff: '' }
  if (stats.size > maximumDiffSize) return { binary: false, tooLarge: true, truncated: true, diff: '' }
  const buffer = await fs.readFile(realPath)
  if (buffer.includes(0)) return { binary: true, truncated: false, diff: '' }
  const lines = buffer.toString('utf8').replace(/\r\n/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  const body = lines.map((line) => `+${line}`).join('\n')
  return { binary: false, truncated: false, diff: `new file ${relativePath}\n@@ -0,0 +1,${lines.length} @@\n${body}` }
}
