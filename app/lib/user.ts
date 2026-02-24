export const CONSULTANTS = ["Kristie", "Elmarie", "Cindy", "Chelsea"] as const;
export type ConsultantName = string;

export const CURRENT_USER_KEY = "capital_bonds_current_user_v1";

export function getCurrentUserClient(): ConsultantName {
  if (typeof window === "undefined") return "System";
  const primary = window.localStorage.getItem("cb_user");
  if (primary && primary.trim()) return primary.trim();
  const v = window.localStorage.getItem(CURRENT_USER_KEY);
  if (v && v.trim()) return v.trim();
  return "System";
}

export function setCurrentUserClient(name: ConsultantName) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CURRENT_USER_KEY, name);
}
