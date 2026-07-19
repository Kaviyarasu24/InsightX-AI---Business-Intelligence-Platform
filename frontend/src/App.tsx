import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './services/queryClient'
import { AppShell } from './layouts/AppShell'
// Pages configuration
import { UploadPage } from './pages/UploadPage'
import { OverviewPage } from './pages/OverviewPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataTablePage } from './pages/DataTablePage'
import { ProfilingPage } from './pages/ProfilingPage'
import { InsightsPage } from './pages/InsightsPage'
import { ChatPage } from './pages/ChatPage'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/upload" replace />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="table" element={<DataTablePage />} />
            <Route path="profiling" element={<ProfilingPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
// Force TS server refresh after adding new pages

