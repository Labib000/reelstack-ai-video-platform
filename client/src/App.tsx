import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { RequireAuth, RequireGuest, RequirePermission } from '@/auth/guards'
import AdminLayout from '@/components/admin/AdminLayout'
import AppLayout from '@/components/shell/AppLayout'
import AskPaletteProvider from '@/components/shell/AskPalette'
import AuthLayout from '@/components/shell/AuthLayout'
import Channel from '@/pages/Channel'
import Explore from '@/pages/Explore'
import History from '@/pages/History'
import Home from '@/pages/Home'
import Library from '@/pages/Library'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import Register from '@/pages/Register'
import SavedList from '@/pages/SavedList'
import Sessions from '@/pages/Sessions'
import Subscriptions from '@/pages/Subscriptions'
import Upload from '@/pages/Upload'
import StaffWelcome from '@/pages/StaffWelcome'
import Watch from '@/pages/Watch'
import AdminAudit from '@/pages/admin/Audit'
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminReports from '@/pages/admin/Reports'
import AdminUserDetail from '@/pages/admin/UserDetail'
import AdminUsers from '@/pages/admin/Users'
import AdminVideos from '@/pages/admin/Videos'

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
          <Route element={<RequirePermission permission="moderation:view" fallback={<Navigate to="/" replace />} />}>
            <Route path="/welcome" element={<StaffWelcome />} />
          </Route>
        </Route>

        {/* Admin console: moderators and admins. Others get the normal 404 page. */}
        <Route
          element={
            <RequirePermission
              permission="moderation:view"
              fallback={
                <AppLayout>
                  <NotFound />
                </AppLayout>
              }
            />
          }
        >
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/videos" element={<AdminVideos />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route element={<RequirePermission permission="user:view" fallback={<NotFound />} />}>
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
            </Route>
            <Route element={<RequirePermission permission="audit:view" fallback={<NotFound />} />}>
              <Route path="/admin/audit" element={<AdminAudit />} />
            </Route>
            <Route path="/admin/*" element={<NotFound />} />
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

          <Route path="/moderation" element={<Navigate to="/admin" replace />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AskPaletteProvider>
  )
}
