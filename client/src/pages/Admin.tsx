import { useState } from "react";
import { AdminMenu } from "./admin/AdminMenu";
import { AdminTables } from "./admin/AdminTables";
import { AdminUsers } from "./admin/AdminUsers";

const TABS = [
  { key: "menu", label: "Menu" },
  { key: "tables", label: "Tables" },
  { key: "users", label: "Users" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function Admin() {
  const [tab, setTab] = useState<TabKey>("menu");

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-4">Admin</h1>
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              tab === t.key
                ? "bg-sarini-yellow text-black"
                : "bg-sarini-panel text-gray-300 hover:bg-sarini-panel-light"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "menu" && <AdminMenu />}
      {tab === "tables" && <AdminTables />}
      {tab === "users" && <AdminUsers />}
    </div>
  );
}
