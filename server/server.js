import dotenv from 'dotenv'
import express from 'express'
import mongoose from 'mongoose'
import Preference from './models/Preference.js'
import githubRoutes from './routes/github.js'
import repositoryRoutes from './routes/repositories.js'
import gitRoutes from './routes/git.js'
import { gitVersion } from './services/git.js'

dotenv.config({ quiet: true })

const app = express()
const port = Number(process.env.PORT) || 5000
const hosted = process.env.HOSTED === 'true'
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/commitflow'
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .concat('http://127.0.0.1:5173')

app.disable('x-powered-by')

app.use((req, res, next) => {
  const origin = req.get('origin')
  const isLocalHost = ['localhost', '127.0.0.1'].includes(req.hostname)
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: 'CommitFlow only accepts requests from its own app.' })
  }
  if (!hosted && !isLocalHost) {
    return res.status(403).json({ message: 'CommitFlow only accepts requests from the local app.' })
  }
  if (origin) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    })
    if (req.method === 'OPTIONS') return res.sendStatus(204)
  }
  next()
})

app.use(express.json({ limit: '100kb' }))

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    hosted,
    database: mongoose.connection.readyState === 1,
    git: await gitVersion(),
    githubConfigured: Boolean(process.env.GITHUB_TOKEN) && process.env.GITHUB_TOKEN !== 'your_github_token_here'
  })
})

app.get('/api/settings', async (req, res) => {
  const preference = await Preference.current()
  res.json({ theme: preference.theme })
})

app.put('/api/settings', async (req, res) => {
  if (hosted) {
    return res.status(403).json({ message: 'Settings are read-only in the online version.', code: 'READ_ONLY' })
  }
  if (!['dark', 'light'].includes(req.body?.theme)) {
    return res.status(400).json({ message: 'Theme must be "dark" or "light".' })
  }
  const preference = await Preference.current()
  preference.theme = req.body.theme
  await preference.save()
  res.json({ theme: preference.theme })
})

app.use('/api/github', githubRoutes)
if (hosted) {
  app.use(['/api/repos', '/api/git'], (req, res) => {
    res.status(403).json({ message: 'Local Git features are only available when CommitFlow runs on your computer.', code: 'LOCAL_ONLY' })
  })
} else {
  app.use('/api/repos', repositoryRoutes)
  app.use('/api/git', gitRoutes)
}

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' })
})

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'The request body is not valid JSON.' })
  }
  if (!error.status) console.error(error.stack)
  res.status(error.status || 500).json({
    message: error.status ? error.message : 'Unexpected server error. Check the server console for details.',
    code: error.code
  })
})

mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    const host = hosted ? '0.0.0.0' : '127.0.0.1'
    app.listen(port, host, () => {
      console.log(`CommitFlow API running at http://${host}:${port}${hosted ? ' in hosted mode' : ''}`)
    })
  })
  .catch((error) => {
    console.error(`Could not connect to MongoDB at ${mongoUri.replace(/\/\/[^@/]+@/, '//***@')}: ${error.message}`)
    process.exit(1)
  })
