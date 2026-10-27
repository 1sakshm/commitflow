import { Router } from 'express'
import path from 'node:path'
import Preference from '../models/Preference.js'
import { fail } from '../services/errors.js'
import {
  describeRepository,
  discoverRepositories,
  findRepository,
  listDirectories,
  readBranches,
  readCommitFiles,
  readHistory,
  readRemote,
  readStatus,
  validateNewDirectory
} from '../services/git.js'

const router = Router()

router.get('/', async (req, res) => {
  const [directories, repositories] = await Promise.all([listDirectories(), discoverRepositories()])
  res.json({ directories, repositories: await Promise.all(repositories.map(describeRepository)) })
})

router.post('/directories', async (req, res) => {
  const directory = await validateNewDirectory(req.body?.path)
  const preference = await Preference.current()
  preference.repositoryDirectories.push(directory)
  await preference.save()
  res.status(201).json({ directories: await listDirectories() })
})

router.delete('/directories', async (req, res) => {
  const requested = req.body?.path
  if (typeof requested !== 'string' || !path.isAbsolute(requested)) throw fail(400, 'A configured folder path is required.')
  const preference = await Preference.current()
  const remaining = preference.repositoryDirectories.filter((directory) => path.relative(directory, requested) !== '')
  if (remaining.length === preference.repositoryDirectories.length) {
    throw fail(404, 'That folder was not added in the app. Folders from ALLOWED_REPO_DIRS must be removed from server/.env.')
  }
  preference.repositoryDirectories = remaining
  await preference.save()
  res.json({ directories: await listDirectories() })
})

router.get('/:id/status', async (req, res) => {
  const repository = await findRepository(req.params.id)
  const [status, remote] = await Promise.all([readStatus(repository.path), readRemote(repository.path)])
  res.json({ ...repository, ...status, remote })
})

router.get('/:id/history', async (req, res) => {
  const repository = await findRepository(req.params.id)
  res.json(await readHistory(repository.path))
})

router.get('/:id/branches', async (req, res) => {
  const repository = await findRepository(req.params.id)
  res.json(await readBranches(repository.path))
})

router.get('/:id/commits/:hash', async (req, res) => {
  const repository = await findRepository(req.params.id)
  res.json(await readCommitFiles(repository.path, req.params.hash))
})

export default router
