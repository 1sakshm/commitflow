import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { DataProvider } from './data'
import { api, applyTheme, hosted } from './lib'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import { Button, EmptyState } from './components/ui'
import Overview from './pages/Overview'
import Repositories from './pages/Repositories'
import LocalProjects from './pages/LocalProjects'
import ProjectDetail from './pages/ProjectDetail'
import Activity from './pages/Activity'
import Settings from './pages/Settings'
import LocalOnly from './pages/LocalOnly'

function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you are looking for does not exist."
      action={
        <Button onClick={() => window.history.back()} variant="secondary">
          Go back
        </Button>
      }
    />
  )
}

export default function App() {
  useEffect(() => {
    if (hosted) return
    api
      .get('/settings')
      .then((response) => applyTheme(response.data.theme))
      .catch(() => {})
  }, [])

  return (
    <ToastProvider>
      <DataProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="repositories" element={<Repositories />} />
            <Route path="projects" element={hosted ? <LocalOnly /> : <LocalProjects />} />
            <Route path="projects/:id" element={hosted ? <LocalOnly /> : <ProjectDetail />} />
            <Route path="activity" element={<Activity />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </DataProvider>
    </ToastProvider>
  )
}
