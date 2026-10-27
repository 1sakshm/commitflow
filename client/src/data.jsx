import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, errorInfo } from './lib'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [entries, setEntries] = useState({})
  const pending = useRef(new Map())
  const requested = useRef(new Set())

  const load = useCallback((url, refresh = false) => {
    if (pending.current.has(url)) return pending.current.get(url)
    requested.current.add(url)
    setEntries((current) => ({ ...current, [url]: { ...current[url], loading: true } }))
    const promise = api
      .get(url, { params: refresh ? { refresh: 1 } : undefined })
      .then((response) => {
        setEntries((current) => ({ ...current, [url]: { data: response.data, error: null, loading: false, loadedAt: Date.now() } }))
        return response.data
      })
      .catch((error) => {
        requested.current.delete(url)
        setEntries((current) => ({ ...current, [url]: { data: current[url]?.data, error: errorInfo(error), loading: false } }))
      })
      .finally(() => pending.current.delete(url))
    pending.current.set(url, promise)
    return promise
  }, [])

  return <DataContext.Provider value={{ entries, load, requested }}>{children}</DataContext.Provider>
}

export function useResource(url, { revalidate = false } = {}) {
  const { entries, load, requested } = useContext(DataContext)

  useEffect(() => {
    if (url && (revalidate || !requested.current.has(url))) load(url)
  }, [url, revalidate, load, requested])

  const entry = entries[url]
  return {
    data: entry?.data,
    error: entry?.error || null,
    loading: url ? (entry?.loading ?? true) : false,
    loadedAt: entry?.loadedAt,
    refresh: () => load(url, true)
  }
}
