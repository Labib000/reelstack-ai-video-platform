import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { RequireAuth, RequireGuest, RequirePermission } from '@/auth/guards'
import AppLayout from '@/components/shell/AppLayout'
import AskPaletteProvider from '@/components/shell/AskPalette'
import AuthLayout from '@/components/shell/AuthLayout'
import Channel from '@/pages/Channel'
import Explore from '@/pages/Explore'
import History from '@/pages/History'
import Home from '@/pages/Home'
import Library from '@/pages/Library'
import Login from '@/pages/Login'
import Moderation from '@/pages/Moderation'
import NotFound from '@/pages/NotFound'
import Register from '@/pages/Register'
import SavedList from '@/pages/SavedList'
import Sessions from '@/pages/Sessions'
import Subscriptions from '@/pages/Subscriptions'
import Upload from '@/pages/Upload'
import Watch from '@/pages/Watch'

/** Old /discover links keep working (query string included). */
function DiscoverRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/explore${search}`} replace />
}

export default function App() {
  return (
    <AskPaletteProvider>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route element={<RequireGuest />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
        </Route>

        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/discover" element={<DiscoverRedirect />} />
          <Route path="/channel/:id" element={<Channel />} />

          <Route element={<RequireAuth />}>
            <Route path="/upload" element={<Upload />} />
            <Route path="/library" element={<Library />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/history" element={<History />} />
            <Route path="/watch-later" element={<SavedList list="watchLater" />} />
            <Route path="/liked" element={<SavedList list="liked" />} />
            <Route path="/sessions" element={<Sessions />} />
          </Route>

          <Route element={<RequirePermission permission="moderation:view" fallback={<NotFound />} />}>
            <Route path="/moderation" element={<Moderation />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AskPaletteProvider>
  )
}
