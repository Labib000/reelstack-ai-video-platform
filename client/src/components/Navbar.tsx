import { Link, NavLink } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition-colors ${
    isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
  }`

export default function Navbar() {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-auto text-lg font-semibold tracking-tight">
          Reel<span className="text-red-500">Stack</span>
        </Link>
        <NavLink to="/upload" className={linkClass}>Upload</NavLink>
        <NavLink to="/login" className={linkClass}>Log in</NavLink>
        <NavLink
          to="/register"
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
        >
          Sign up
        </NavLink>
      </nav>
    </header>
  )
}
