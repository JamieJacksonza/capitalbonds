"use client";

import { useEffect, useState } from "react";

const USERS = ["Kristie", "Elmarie", "Cindy", "Chelsea"];
const KEY = "capital_bonds_current_user_v1";

function normalize(v: string) {
  const name = String(v || "").trim();
  const match = USERS.find((u) => u.toLowerCase() === name.toLowerCase());
  return match || "";
}

export default function UserSwitcher() {
  const [user, setUser] = useState<string>(USERS[0]);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      const norm = v ? normalize(v) : "";
      setUser(norm || USERS[0]);
      if (!norm) window.localStorage.setItem(KEY, USERS[0]);
    } catch {
      setUser(USERS[0]);
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-xs font-extrabold text-black/70">Logged in as</div>
      <select
        value={user}
        onChange={(e) => {
          const next = normalize(e.target.value) || USERS[0];
          setUser(next);
          try {
            window.localStorage.setItem(KEY, next);
          } catch {}
        }}
        className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30"
      >
        {USERS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}
