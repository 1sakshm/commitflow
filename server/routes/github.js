import { Router } from 'express'
import axios from 'axios'
import { fail } from '../services/errors.js'

const router = Router()
const cacheDuration = 5 * 60 * 1000
const cache = new Map()
const maximumActivityRepositories = 15
const hosted = () => process.env.HOSTED === 'true'
const wantsRefresh = (req) => req.query.refresh === '1' && !hosted()

const github = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 15000,
  headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CommitFlow' }
})

function readToken() {
  const token = process.env.GITHUB_TOKEN
  if (!token || token === 'your_github_token_here') {
    throw fail(503, 'GitHub is not connected. Add GITHUB_TOKEN to server/.env and restart the server.', 'NOT_CONFIGURED')
  }
  return token
}

function describeGithubError(error) {
  const response = error.response
  if (!response) return fail(503, 'Could not reach GitHub. Check your internet connection and try again.', 'NETWORK')
  if (response.status === 401) {
    return fail(401, 'GitHub rejected the token. Check GITHUB_TOKEN in server/.env and restart the server.', 'INVALID_TOKEN')
  }
  if ([403, 429].includes(response.status) && response.headers['x-ratelimit-remaining'] === '0') {
    const resetAt = new Date(Number(response.headers['x-ratelimit-reset']) * 1000)
    return fail(429, `GitHub API rate limit reached. It resets at ${resetAt.toLocaleTimeString()}.`, 'RATE_LIMITED')
  }
  if (response.status === 403) {
    return fail(403, 'The GitHub token does not have permission for this request. Check its repository access and permissions.', 'FORBIDDEN')
  }
  if (response.status === 404) return fail(404, 'GitHub could not find this resource, or the token cannot access it.', 'NOT_FOUND')
  if (response.status === 409) return fail(409, 'This repository is empty.', 'EMPTY_REPOSITORY')
  return fail(502, `GitHub returned an unexpected response (${response.status}).`, 'GITHUB_ERROR')
}

async function request(url, params) {
  const token = readToken()
  try {
    const response = await github.get(url, { params, headers: { Authorization: `Bearer ${token}` } })
    return response.data
  } catch (error) {
    throw describeGithubError(error)
  }
}

async function cached(key, refresh, loader) {
  const entry = cache.get(key)
  if (!refresh && entry && Date.now() - entry.savedAt < cacheDuration) return entry.value
  const value = await loader()
  cache.set(key, { value, savedAt: Date.now() })
  return value
}

function loadProfile(refresh) {
  return cached('profile', refresh, async () => {
    const user = await request('/user')
    return {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following
    }
  })
}

function loadRepositories(refresh) {
  return cached('repositories', refresh, async () => {
    const repositories = []
    for (let page = 1; page <= 5; page++) {
      const batch = await request('/user/repos', {
        per_page: 100,
        page,
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member'
      })
      repositories.push(...batch)
      if (batch.length < 100) break
    }
    return repositories
      .filter((repository) => !hosted() || !repository.private)
      .map((repository) => ({
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        owner: repository.owner.login,
        description: repository.description,
        language: repository.language,
        stars: repository.stargazers_count,
        forks: repository.forks_count,
        private: repository.private,
        fork: repository.fork,
        archived: repository.archived,
        htmlUrl: repository.html_url,
        updatedAt: repository.updated_at,
        pushedAt: repository.pushed_at
      }))
  })
}

router.get('/profile', async (req, res) => {
  res.json(await loadProfile(wantsRefresh(req)))
})

router.get('/repos', async (req, res) => {
  res.json(await loadRepositories(wantsRefresh(req)))
})

router.get('/activity', async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30
  const refresh = wantsRefresh(req)
  const activity = await cached(`activity-${days}`, refresh, async () => {
    const [profile, repositories] = await Promise.all([loadProfile(refresh), loadRepositories(refresh)])
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const recentRepositories = repositories
      .filter((repository) => repository.pushedAt && new Date(repository.pushedAt) >= since)
      .sort((first, second) => new Date(second.pushedAt) - new Date(first.pushedAt))
      .slice(0, maximumActivityRepositories)
    const results = await Promise.allSettled(
      recentRepositories.map((repository) =>
        request(`/repos/${repository.fullName}/commits`, { author: profile.login, since: since.toISOString(), per_page: 100 })
      )
    )
    const rateLimited = results.find((result) => result.status === 'rejected' && result.reason.code === 'RATE_LIMITED')
    if (rateLimited) throw rateLimited.reason
    const commits = results.flatMap((result, index) => {
      if (result.status !== 'fulfilled') return []
      const repository = recentRepositories[index]
      return result.value.map((commit) => ({
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author?.name || commit.author?.login || 'Unknown',
        authorLogin: commit.author?.login || null,
        avatarUrl: commit.author?.avatar_url || null,
        date: commit.commit.author?.date,
        url: commit.html_url,
        repository: { name: repository.name, fullName: repository.fullName, url: repository.htmlUrl, language: repository.language }
      }))
    })
    commits.sort((first, second) => new Date(second.date) - new Date(first.date))
    return {
      days,
      since: since.toISOString(),
      login: profile.login,
      repositoriesScanned: recentRepositories.length,
      repositoriesTotal: repositories.length,
      commits: commits.slice(0, 500)
    }
  })
  res.json(activity)
})

export default router
