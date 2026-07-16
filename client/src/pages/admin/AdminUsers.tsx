import { useEffect, useState } from "react";
import { api } from "../../api";
import type { AppUser, Role } from "../../types";
import { useAuth } from "../../context/AuthContext";

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("cashier");

  async function load() {
    try {
      const data = await api.get<AppUser[]>("/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addUser() {
    if (!name.trim() || !username.trim() || !password) return;
    try {
      await api.post("/users", { name: name.trim(), username: username.trim(), password, role });
      setName("");
      setUsername("");
      setPassword("");
      setRole("cashier");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    }
  }

  async function toggleActive(u: AppUser) {
    try {
      await api.put(`/users/${u.id}`, { active: u.active ? 0 : 1 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        >
          <option value="cashier">Cashier</option>
          <option value="admin">Admin</option>
        </select>
        <button
          onClick={addUser}
          className="px-4 py-2 rounded-md bg-sarini-yellow text-black font-medium hover:bg-sarini-yellow-dark"
        >
          + Add User
        </button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between bg-sarini-panel border border-black/30 rounded-lg px-4 py-3"
          >
            <div>
              <div className="text-white font-medium">
                {u.name} <span className="text-gray-500 text-sm">@{u.username}</span>
              </div>
              <div className="text-xs text-gray-400 uppercase">{u.role}</div>
            </div>
            <button
              onClick={() => toggleActive(u)}
              disabled={u.id === currentUser?.id}
              className={`text-xs px-3 py-1.5 rounded-md disabled:opacity-40 ${
                u.active
                  ? "border border-red-700 text-red-400 hover:bg-red-950/40"
                  : "border border-emerald-700 text-emerald-400 hover:bg-emerald-950/40"
              }`}
            >
              {u.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
