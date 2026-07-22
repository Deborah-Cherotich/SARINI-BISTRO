import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
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
      <header className="bg-sarini-panel border-b border-black/40 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-md border-2 border-sarini-yellow flex items-center justify-center text-sarini-yellow font-serif font-bold text-sm shrink-0">
              SB
            </div>
            <span className="hidden sm:inline font-semibold tracking-wide text-white">
              SARINI BISTRO
            </span>
          </div>
          <nav className="flex gap-1 sm:gap-2 overflow-x-auto">
            <NavItem to="/">Tables</NavItem>
            {user?.role === "admin" && (
              <>
                <NavItem to="/reports">Reports</NavItem>
                <NavItem to="/admin">Admin</NavItem>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden md:block text-sm text-gray-300 whitespace-nowrap">
            {user?.name} <span className="text-gray-500">({user?.role})</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-md border border-gray-600 text-gray-300 hover:bg-sarini-panel-light whitespace-nowrap"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="flex-1 p-3 sm:p-6">{children}</main>
    </div>
  );
}
