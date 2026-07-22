import { useEffect, useState } from "react";
import { api } from "../../api";
import type { AppUser, Role } from "../../types";
import { useAuth } from "../../context/AuthContext";

interface EditDraft {
  name: string;
  username: string;
  password: string;
  role: Role;
}

const ROLE_PRESETS = ["admin", "manager", "cashier", "waiter", "chef", "receptionist"];
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier",
  waiter: "Waiter",
  chef: "Chef / Kitchen",
  receptionist: "Receptionist",
};

function roleSelectValue(role: string) {
  return ROLE_PRESETS.includes(role) ? role : "other";
}

function RoleSelect({
  role,
  onChange,
  className,
}: {
  role: string;
  onChange: (role: string) => void;
  className: string;
}) {
  return (
    <>
      <select
        value={roleSelectValue(role)}
        onChange={(e) => onChange(e.target.value === "other" ? "" : e.target.value)}
        className={className}
      >
        {ROLE_PRESETS.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
        <option value="other">Other…</option>
      </select>
      {roleSelectValue(role) === "other" && (
        <input
          value={role}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Custom role"
          className={className}
        />
      )}
    </>
  );
}

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

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
    setError(null);
    setNotice(null);
    const addedName = name.trim();
    try {
      await api.post("/users", { name: addedName, username: username.trim(), password, role });
      setName("");
      setUsername("");
      setPassword("");
      setRole("cashier");
      await load();
      // New accounts are already active and ready to log in immediately —
      // called out explicitly here since the only visible cue otherwise is
      // a small red "Deactivate" button, which reads to a lot of people as
      // "click this to activate" and does the opposite of what they meant.
      setNotice(`✓ ${addedName} was added and can log in right away — no activation needed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    }
  }

  async function toggleActive(u: AppUser) {
    if (u.active) {
      if (!window.confirm(`Deactivate ${u.name}? They won't be able to log in until reactivated.`)) {
        return;
      }
    }
    setNotice(null);
    try {
      await api.put(`/users/${u.id}`, { active: u.active ? 0 : 1 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  async function deleteUser(u: AppUser) {
    if (!window.confirm(`Permanently delete ${u.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  function startEdit(u: AppUser) {
    setError(null);
    setEditingId(u.id);
    setEditDraft({ name: u.name, username: u.username, password: "", role: u.role });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: number) {
    if (!editDraft) return;
    if (!editDraft.name.trim() || !editDraft.username.trim()) return;
    if (editDraft.password && editDraft.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    try {
      await api.put(`/users/${id}`, {
        name: editDraft.name.trim(),
        username: editDraft.username.trim(),
        role: editDraft.role,
        ...(editDraft.password ? { password: editDraft.password } : {}),
      });
      cancelEdit();
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
      {notice && (
        <div className="mb-4 text-sm text-sarini-sage bg-sarini-sage-bg border border-sarini-sage-border rounded-md px-3 py-2">
          {notice}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Full name"
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
          }}
          placeholder="Username"
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <input
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          type="password"
          placeholder="Password"
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <RoleSelect
          role={role}
          onChange={(r) => setRole(r)}
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <button
          onClick={addUser}
          className="px-4 py-2 rounded-md bg-sarini-yellow text-black font-medium hover:bg-sarini-yellow-dark"
        >
          + Add User
        </button>
      </div>

      <div className="space-y-2">
        {users.map((u) =>
          editingId === u.id && editDraft ? (
            <div
              key={u.id}
              className="bg-sarini-panel border border-sarini-yellow/50 rounded-lg px-4 py-3"
            >
              <div className="flex flex-wrap gap-2 mb-2">
                <input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  placeholder="Full name"
                  className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white text-sm"
                />
                <input
                  value={editDraft.username}
                  onChange={(e) => setEditDraft({ ...editDraft, username: e.target.value })}
                  placeholder="Username"
                  className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white text-sm"
                />
                <input
                  value={editDraft.password}
                  onChange={(e) => setEditDraft({ ...editDraft, password: e.target.value })}
                  type="password"
                  placeholder="New password (leave blank to keep)"
                  className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white text-sm"
                />
                <RoleSelect
                  role={editDraft.role}
                  onChange={(r) => setEditDraft({ ...editDraft, role: r })}
                  className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(u.id)}
                  className="px-3 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1.5 rounded-md border border-gray-600 text-gray-300 text-sm hover:bg-sarini-panel-light"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={u.id}
              className="flex items-center justify-between bg-sarini-panel border border-black/30 rounded-lg px-4 py-3"
            >
              <div>
                <div className="text-white font-medium flex items-center gap-2">
                  {u.name} <span className="text-gray-500 text-sm">@{u.username}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      u.active
                        ? "bg-sarini-sage-bg text-sarini-sage"
                        : "bg-sarini-terracotta-bg text-sarini-terracotta"
                    }`}
                  >
                    {u.active ? "Active — can log in" : "Inactive — can't log in"}
                  </span>
                </div>
                <div className="text-xs text-gray-400 uppercase">{u.role}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(u)}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-600 text-gray-300 hover:bg-sarini-panel-light"
                >
                  Edit
                </button>
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
                <button
                  onClick={() => deleteUser(u)}
                  disabled={u.id === currentUser?.id}
                  className="text-xs px-3 py-1.5 rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
