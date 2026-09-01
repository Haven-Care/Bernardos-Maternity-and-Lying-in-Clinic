import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="app-shell">
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/booking">Booking</Link>
          <Link to="/inventory">Inventory</Link>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        <p>HavenCare</p>
      </footer>
    </div>
  )
}
