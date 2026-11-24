import { Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireGuest } from './auth/guards.tsx'
import Navbar from './components/Navbar.tsx'
import Home from './pages/Home.tsx'
import Login from './pages/Login.tsx'
import NotFound from './pages/NotFound.tsx'
import Register from './pages/Register.tsx'
import Sessions from './pages/Sessions.tsx'
import Upload from './pages/Upload.tsx'
import Watch from './pages/Watch.tsx'

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/watch/:id" element={<Watch />} />

          <Route element={<RequireGuest />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/upload" element={<Upload />} />
            <Route path="/sessions" element={<Sessions />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
