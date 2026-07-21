const TOKEN_KEY = "sarini_token";
const USER_KEY = "sarini_user";

// "Remember me" checked -> localStorage (survives closing the app/browser
// entirely, like the Electron desktop shell being quit and reopened).
// Unchecked -> sessionStorage (cleared as soon as this window/tab closes) —
// for a shared till where the next person shouldn't land in someone else's
// account automatically.
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): string | null {
  return localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
}

export function setAuth(token: string, user: string, remember: boolean) {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, user);
  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
