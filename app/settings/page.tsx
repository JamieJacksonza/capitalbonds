"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "admin" | "consultant";

type Me = {
  name: string;
  email?: string | null;
  role: Role;
};

type UserRow = {
  id: string | null;
  name: string;
  email: string | null;
  role: Role;
};

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function roleBadge(role: Role) {
  return role === "admin"
    ? "bg-black text-white border-black"
    : "bg-white text-black border-black/15";
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("consultant");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserMsg, setCreateUserMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isAdmin = me?.role === "admin";

  async function loadMe() {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to load profile");
      if (!json?.user) throw new Error("No active session");
      setMe({
        name: String(json.user.name || "").trim() || "User",
        email: json.user.email ? String(json.user.email).trim() : null,
        role: String(json.user.role || "").toLowerCase() === "admin" ? "admin" : "consultant",
      });
    } catch (e: any) {
      setLoadErr(e?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    setUsersErr(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to load users");
      const rows = Array.isArray(json?.users) ? json.users : [];
      setUsers(
        rows.map((u: any) => ({
          id: u?.id ? String(u.id) : null,
          name: String(u?.name || "").trim() || "Unknown",
          email: u?.email ? String(u.email).trim() : null,
          role: String(u?.role || "").toLowerCase() === "admin" ? "admin" : "consultant",
        }))
      );
    } catch (e: any) {
      setUsersErr(e?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);

    if (!currentPassword || !newPassword) {
      setPasswordMsg({ type: "err", text: "Current and new password are required." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "err", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "err", text: "New password and confirm password must match." });
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Failed to reset password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "ok", text: "Password updated." });
    } catch (e: any) {
      setPasswordMsg({ type: "err", text: e?.message || "Failed to reset password" });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function updateRole(user: UserRow, role: Role) {
    const key = user.id || user.email || user.name;
    setSavingRoleId(String(key));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, email: user.email, name: user.name, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Failed to update access");
      }

      setUsers((prev) =>
        prev.map((u) => {
          const same = (u.id && user.id && u.id === user.id) || (!u.id && !user.id && u.name === user.name);
          if (!same) return u;
          return { ...u, role };
        })
      );
    } catch (e: any) {
      setUsersErr(e?.message || "Failed to update access");
    } finally {
      setSavingRoleId(null);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateUserMsg(null);
    setUsersErr(null);

    if (!newUserName.trim()) {
      setCreateUserMsg({ type: "err", text: "Name is required." });
      return;
    }
    if (!newUserPassword) {
      setCreateUserMsg({ type: "err", text: "Password is required." });
      return;
    }
    if (newUserPassword.length < 6) {
      setCreateUserMsg({ type: "err", text: "Password must be at least 6 characters." });
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim() || null,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Failed to create user");
      }

      const u = json?.user || {};
      const added: UserRow = {
        id: u?.id ? String(u.id) : null,
        name: String(u?.name || newUserName).trim(),
        email: u?.email ? String(u.email).trim() : newUserEmail.trim() || null,
        role: String(u?.role || newUserRole).toLowerCase() === "admin" ? "admin" : "consultant",
      };
      setUsers((prev) => [added, ...prev]);

      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("consultant");
      setCreateUserMsg({ type: "ok", text: "User added." });
    } catch (e: any) {
      setCreateUserMsg({ type: "err", text: e?.message || "Failed to create user" });
    } finally {
      setCreatingUser(false);
    }
  }

  async function removeUser(user: UserRow) {
    const key = String(user.id || user.email || user.name);
    const yes = window.confirm(`Remove user '${user.name}'?`);
    if (!yes) return;

    setRemovingUserId(key);
    setUsersErr(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Failed to remove user");
      }

      setUsers((prev) => prev.filter((u) => String(u.id || u.email || u.name) !== key));
    } catch (e: any) {
      setUsersErr(e?.message || "Failed to remove user");
    } finally {
      setRemovingUserId(null);
    }
  }

  const heading = useMemo(() => {
    if (loading) return "Loading settings...";
    return "Settings";
  }, [loading]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#142037]/55">Workspace settings</div>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#142037]">{heading}</h1>
            {loadErr ? <div className="mt-3 text-sm font-semibold text-red-600">{loadErr}</div> : null}
          </div>
          {me ? (
            <div className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-black/45">Current user</div>
              <div className="mt-1 font-semibold text-black">{me.name}</div>
              <div className="text-black/60">{me.email || "No email set"}</div>
              <span className={cls("mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-extrabold uppercase", roleBadge(me.role))}>
                {me.role}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="text-lg font-bold text-[#142037]">Reset password</div>
        <p className="mt-1 text-sm font-medium text-slate-500">Update your account password securely.</p>

        <form onSubmit={changePassword} className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-black outline-none transition focus:border-black/35"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-black outline-none transition focus:border-black/35"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-black outline-none transition focus:border-black/35"
          />
          <div className="lg:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={passwordSaving}
              className="rounded-2xl bg-black px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {passwordSaving ? "Saving..." : "Update password"}
            </button>
            {passwordMsg ? (
              <span className={passwordMsg.type === "ok" ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-600"}>
                {passwordMsg.text}
              </span>
            ) : null}
          </div>
        </form>
      </div>

      {isAdmin ? (
        <div className="mt-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-[#142037]">Admin controls</div>
              <p className="mt-1 text-sm font-medium text-slate-500">Manage permissions and team access from one place.</p>
            </div>
            <span className="rounded-full border border-black/15 bg-black px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">
              Admin mode
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4">
              <div className="text-[13px] font-extrabold text-black">Deal controls</div>
              <div className="mt-1 text-xs font-semibold text-black/60">Delete deals and move deals backward from deal view.</div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4">
              <div className="text-[13px] font-extrabold text-black">Access control</div>
              <div className="mt-1 text-xs font-semibold text-black/60">Promote consultants to admin or remove admin rights.</div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4">
              <div className="text-[13px] font-extrabold text-black">User lifecycle</div>
              <div className="mt-1 text-xs font-semibold text-black/60">Create users and remove users when required.</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-black/10 bg-zinc-50 p-4">
            <div className="text-sm font-extrabold text-black">Add new user</div>
            <form onSubmit={createUser} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Full name"
                className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black outline-none transition focus:border-black/35"
              />
              <input
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Email (optional)"
                className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black outline-none transition focus:border-black/35"
              />
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Temporary password"
                className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black outline-none transition focus:border-black/35"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value === "admin" ? "admin" : "consultant")}
                className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black outline-none transition focus:border-black/35"
              >
                <option value="consultant">Consultant</option>
                <option value="admin">Admin</option>
              </select>
              <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="rounded-2xl bg-black px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {creatingUser ? "Adding..." : "Add user"}
                </button>
                {createUserMsg ? (
                  <span className={createUserMsg.type === "ok" ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-600"}>
                    {createUserMsg.text}
                  </span>
                ) : null}
              </div>
            </form>
          </div>

          {usersErr ? <div className="mt-3 text-sm font-semibold text-red-600">{usersErr}</div> : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-black/10">
            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-zinc-50">
                  <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/55">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Permissions</th>
                    <th className="px-4 py-3">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {usersLoading ? (
                    <tr>
                      <td className="px-4 py-4 font-semibold text-black/60" colSpan={5}>Loading users...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 font-semibold text-black/60" colSpan={5}>No users found.</td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const key = u.id || u.email || u.name;
                      const busy = savingRoleId === String(key);
                      const removing = removingUserId === String(key);
                      return (
                        <tr key={String(key)} className="hover:bg-zinc-50/80">
                          <td className="px-4 py-3 font-extrabold text-black">{u.name}</td>
                          <td className="px-4 py-3 font-semibold text-black/70">{u.email || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={cls("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase", roleBadge(u.role))}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => updateRole(u, u.role === "admin" ? "consultant" : "admin")}
                              disabled={busy}
                              className="rounded-xl border border-black/15 bg-white px-3 py-1.5 text-xs font-extrabold text-black transition hover:border-black/35 disabled:opacity-60"
                            >
                              {busy ? "Saving..." : u.role === "admin" ? "Remove admin" : "Make admin"}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removeUser(u)}
                              disabled={removing}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                            >
                              {removing ? "Removing..." : "Remove user"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
