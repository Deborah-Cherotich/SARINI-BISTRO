import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-sarini-yellow text-black"
            : "text-gray-300 hover:bg-sarini-panel-light hover:text-white"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-sarini-bg">
      <header className="bg-sarini-panel border-b border-black/40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md border-2 border-sarini-yellow flex items-center justify-center text-sarini-yellow font-serif font-bold text-sm">
              SB
            </div>
            <span className="font-semibold tracking-wide text-white">SARINI BISTRO</span>
          </div>
          <nav className="flex gap-2">
            <NavItem to="/">Tables</NavItem>
            {user?.role === "admin" && (
              <>
                <NavItem to="/reports">Reports</NavItem>
                <NavItem to="/admin">Admin</NavItem>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-300">
            {user?.name} <span className="text-gray-500">({user?.role})</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-600 text-gray-300 hover:bg-sarini-panel-light"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
