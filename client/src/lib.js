import axios from 'axios'

const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const hosted = Boolean(apiOrigin)

export const repositoryUrl = 'https://github.com/1sakshm/commitflow'

export const api = axios.create({ baseURL: `${apiOrigin}/api`, timeout: 150000 })

export function errorInfo(error) {
  if (error.response?.data?.message || (error.response && ![500, 502, 503, 504].includes(error.response.status))) {
    return {
      message: error.response.data?.message || `Request failed with status ${error.response.status}.`,
      code: error.response.data?.code,
      status: error.response.status
    }
  }
  return {
    message: hosted
      ? 'Cannot reach the CommitFlow server. The free server sleeps when idle and can take up to a minute to wake up. Please try again shortly.'
      : 'Cannot reach the CommitFlow server. Make sure the backend is running on port 5000.',
    code: 'SERVER_OFFLINE'
  }
}

const timeUnits = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60]
]

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(value) {
  if (!value) return 'Never'
  const seconds = (new Date(value).getTime() - Date.now()) / 1000
  for (const [unit, size] of timeUnits) {
    if (Math.abs(seconds) >= size) return relativeFormatter.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function formatDate(value, options = { dateStyle: 'medium' }) {
  return value ? new Intl.DateTimeFormat('en', options).format(new Date(value)) : ''
}

export function dayKey(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const languageColors = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572a5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#8d93a0',
  'C#': '#178600',
  Go: '#00add8',
  Rust: '#dea584',
  PHP: '#4f5d95',
  Ruby: '#cc342d',
  Kotlin: '#a97bff',
  Swift: '#f05138',
  Dart: '#00b4ab',
  HTML: '#e34c26',
  CSS: '#663399',
  SCSS: '#c6538c',
  Shell: '#89e051',
  'Jupyter Notebook': '#da5b0b',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Lua: '#000080',
  R: '#198ce7'
}

export function languageColor(language) {
  return languageColors[language] || '#8b949e'
}

export function plural(count, word, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
  try {
    localStorage.setItem('commitflow-theme', theme)
  } catch {}
}
