import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// The login screen only ever needs to distinguish two categories: "admin"
// (full access) and "staff" (everyone else). The account's real role
// (cashier, waiter, chef, manager, receptionist, or any custom role an
// admin created in Admin > Users) still drives everything after login —
// this picker just has to get that broad category right, not the exact
// role string.
const CATEGORIES = [
  { value: "admin", label: "Admin", blurb: "Menu, tables, staff & reports" },
  { value: "staff", label: "Staff", blurb: "Any staff role — waiter, cashier, chef, etc." },
] as const;
type LoginCategory = (typeof CATEGORIES)[number]["value"];

const HERO_IMAGES = [
  { src: "/uploads/vegetarian-burger.jpg", alt: "Vegetarian burger" },
  { src: "/uploads/cappuccino.jpg", alt: "Cappuccino" },
  { src: "/uploads/oreo-shake.jpg", alt: "Oreo shake" },
];

function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

export function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<LoginCategory>("staff");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedInUser = await login(username, password, rememberMe);
      const isAdmin = loggedInUser.role === "admin";
      // Only "admin" is checked exactly — every other role (cashier,
      // waiter, chef, manager, receptionist, or any custom one) counts as
      // "Staff", so picking Staff always works for any non-admin account
      // instead of only matching one specific role string.
      if (category === "admin" && !isAdmin) {
        logout();
        setError('That\'s a Staff account. Select "Staff" above and sign in again.');
        return;
      }
      if (category === "staff" && isAdmin) {
        logout();
        setError('That\'s an Admin account. Select "Admin" above and sign in again.');
        return;
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-sarini-bg">
      {/* Left hero panel (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-sarini-panel">
        <div className="absolute inset-0 grid grid-cols-3 gap-1">
          {HERO_IMAGES.map((img) => (
            <img
              key={img.src}
              src={img.src}
              alt={img.alt}
              onError={hideOnError}
              className="w-full h-full object-cover saturate-125 contrast-110"
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-linear-to-r from-sarini-bg via-sarini-bg/60 to-sarini-bg/10" />
        <div className="absolute inset-0 bg-linear-to-t from-sarini-bg via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-center px-16 max-w-xl">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 rounded-full bg-sarini-yellow/20 blur-2xl" aria-hidden="true" />
            <div
              className="relative w-24 h-24 rounded-full bg-linear-to-br from-sarini-panel-light to-sarini-bg border-2 border-sarini-yellow shadow-lg flex items-center justify-center"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8 absolute opacity-25 text-sarini-yellow" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M7 2v7a2 2 0 1 1-4 0V2M5 9v13M15 2c-1.66 0-3 2-3 5s1.34 5 3 5v11M19 2v9c0 1.1-.9 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-serif font-bold text-3xl text-sarini-yellow">SB</span>
            </div>
          </div>
          <p className="text-sarini-yellow text-base tracking-[0.2em] uppercase font-semibold mb-3">
            Welcome to
          </p>
          <h1 className="text-6xl font-serif font-bold text-white mb-5 leading-tight">
            Sarini Bistro
          </h1>
          <p className="text-gray-200 text-lg leading-relaxed max-w-md">
            Great food, great service. Sign in to start taking orders, managing tables, and
            keeping the kitchen running smoothly.
          </p>
          <div className="flex gap-8 mt-10 text-base text-gray-300 font-medium" aria-hidden="true">
            <span>🍽️ Tables & Orders</span>
            <span>🧾 Kitchen Tickets</span>
            <span>📊 Sales Reports</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-sarini-panel border border-black/40 rounded-xl p-9 shadow-2xl"
          noValidate
        >
          {/* Mobile header (hidden on md+) */}
          <div className="flex flex-col items-center mb-7 md:hidden">
            <div className="relative w-20 h-20 mb-4">
              <div className="absolute inset-0 rounded-full bg-sarini-yellow/20 blur-xl" aria-hidden="true" />
              <div
                className="relative w-20 h-20 rounded-full bg-linear-to-br from-sarini-panel-light to-sarini-bg border-2 border-sarini-yellow shadow-lg flex items-center justify-center text-sarini-yellow font-serif font-bold text-3xl"
                aria-hidden="true"
              >
                SB
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-wide text-center">
              Welcome to Sarini Bistro
            </h1>
            <p className="text-gray-400 text-base mt-1">Point of Sale</p>
          </div>

          {/* Desktop heading */}
          <p className="hidden md:block text-white text-2xl font-semibold mb-1">
            Sign in
          </p>
          <p className="hidden md:block text-gray-400 text-base mb-7">
            Select your role to continue
          </p>

          {/* Role category */}
          <fieldset className="mb-6">
            <legend className="sr-only">Select your role</legend>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  aria-pressed={category === c.value}
                  className={`text-left rounded-md px-4 py-3 border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sarini-yellow ${
                    category === c.value
                      ? "bg-sarini-yellow text-black border-sarini-yellow"
                      : "bg-sarini-panel-light text-gray-300 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  <span className="text-base font-semibold">{c.label}</span>
                  <span
                    className={`block text-xs mt-0.5 ${
                      category === c.value ? "text-black/70" : "text-gray-500"
                    }`}
                  >
                    {c.blurb}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2"
            >
              {error}
            </div>
          )}

          {/* Username */}
          <label htmlFor="login-username" className="block text-base text-gray-300 mb-1.5">
            Username
          </label>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            className="w-full mb-4 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2.5 text-white text-base focus:outline-none focus:border-sarini-yellow"
          />

          {/* Password */}
          <label htmlFor="login-password" className="block text-base text-gray-300 mb-1.5">
            Password
          </label>
          <div className="relative mb-4">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-md bg-sarini-panel-light border border-gray-700 pl-3 pr-11 py-2.5 text-white text-base focus:outline-none focus:border-sarini-yellow"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-white"
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path
                    d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path
                    d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.6 6.8C4.2 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.5 4.9-1.3M17.4 15.1C19.6 13.5 21.5 12 21.5 12S19.4 7.9 15.3 6.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2 mb-7 text-sm text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-sarini-yellow"
            />
            Remember me on this device
          </label>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sarini-yellow text-black font-semibold text-lg py-3 rounded-md hover:bg-sarini-yellow-dark transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sarini-yellow"
          >
            {loading
              ? "Signing in…"
              : `Sign in as ${CATEGORIES.find((c) => c.value === category)?.label}`}
          </button>
        </form>
      </div>
    </div>
  );
}