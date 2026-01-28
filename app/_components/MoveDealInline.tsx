"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES, stageMeta, type Stage } from "../lib/deals";
import { getCurrentUserClient } from "../lib/user";

type DealLike = {
  id?: string | null;
  stage?: Stage | string | null;
  banks?: any[] | null;
  [key: string]: any;
};

type Msg = { type: "ok" | "err"; text: string };
import MoveStageCards from "./MoveStageCards";

export default function MoveDealInline({ deal }: { deal: DealLike }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  
  const [stageData, setStageData] = useState<any>({});
const [nextStage, setNextStage] = useState<Stage | "">("");
const [saving, setSaving] = useState(false);
  const [showStagePrompt, setShowStagePrompt] = useState(false);
  const [stageConfirmed, setStageConfirmed] = useState(false);
  
const [msg, setMsg] = useState<Msg | null>(null);

  async function resolveMovedBy() {
    const local = getCurrentUserClient();
    if (local && local !== "System") return local;
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const name = String(json?.user?.name || "").trim();
      if (name) {
        try {
          localStorage.setItem("cb_user", name);
        } catch {}
        return name;
      }
    } catch {}
    return local || "System";
  }

  const currentStage = (deal?.stage || "") as Stage;

  const options = useMemo(() => {
    if (currentStage === "instructed") return ["ntu"] as Stage[];
    if (currentStage === "submitted") return ["aip", "ntu"] as Stage[];
    if (currentStage === "aip") return ["granted", "ntu"] as Stage[];
    if (currentStage === "granted") return ["instructed", "ntu"] as Stage[];
    return STAGES.filter((s) => s !== currentStage);
  }, [currentStage]);

  function requiresStageInputs(stage: Stage | "" | string) {
    return ["aip", "granted", "instructed", "registrations", "ntu"].includes(String(stage));
  }

  async function submit() {
    const dealId = String(deal?.id || "").trim();
    if (!dealId) {
      setMsg({ type: "err", text: "Missing deal id." });
      return;
    }
    if (!nextStage) {
      setMsg({ type: "err", text: "Choose a next status." });
      return;
    }
    if (requiresStageInputs(nextStage) && !stageConfirmed) {
      setShowStagePrompt(true);
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const movedBy = await resolveMovedBy();
      if (!movedBy || movedBy === "System") {
        setMsg({ type: "err", text: "Please log in again so we can record who moved this deal." });
        return;
      }

      const res = await fetch("/api/deals/move", {
        method: "POST",
        headers: { "content-type": "application/json", "x-cb-user": movedBy || "" },
        cache: "no-store",
        body: JSON.stringify({
          dealId,
          toStage: nextStage,
        data: stageData,
        stageData: stageData,
          movedBy,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || json?.message || "Move failed");
      }

      const title = stageMeta[nextStage as Stage]?.title || String(nextStage);
      setMsg({ type: "ok", text: `Moved to ${title} ` });
      setTimeout(() => setMsg(null), 2000);

      setOpen(false);
      setNextStage("");
      setStageConfirmed(false);
      router.refresh();
    } catch (e: unknown) {
      const text =
        e instanceof Error && e.message
          ? e.message
          : typeof e === "string"
          ? e
          : "Move failed";
      setMsg({ type: "err", text });
    } finally {
      setSaving(false);
    }
  }

  const toast = msg ? (
    <div
      className={
        "mt-2 w-[320px] rounded-xl border px-3 py-2 text-xs font-extrabold " +
        (msg.type === "ok"
          ? "border-black/10 bg-black/[0.03] text-black"
          : "border-red-200 bg-red-50 text-red-700")
      }
    >
      {msg.text}
    </div>
  ) : null;

  return (
    <div className="inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20 disabled:opacity-60"
        type="button"
      >
        {saving ? "Moving..." : "Move"}
      </button>

      {!open ? toast : null}

      {open && (
        <div className="mt-2 w-[320px] rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-black/70">Move deal</div>

          {msg ? toast : null}

          <div className="mt-3">
            <div className="text-[11px] font-extrabold text-black">Next status</div>
                        <div className="mt-2 text-[10px] font-mono text-black/60">
            </div>
<select
              value={nextStage}
              onChange={(e) => {
                setNextStage(e.target.value as Stage);
                setStageConfirmed(false);
              }}
              disabled={saving}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black outline-none focus:border-black/30 disabled:opacity-60"
            >
              <option value="" disabled>
                Choose next status
              </option>
              {options.map((s) => (
                <option key={s} value={s}>
                  {stageMeta[s].title}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={saving || !nextStage}
              className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-60"
              type="button"
            >
              {saving ? "Moving..." : "Move"}
            </button>

            <button
              onClick={() => setOpen(false)}
              disabled={saving}
              className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20 disabled:opacity-60"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showStagePrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="text-sm font-extrabold text-black">Additional details required</div>
            <div className="mt-1 text-xs font-semibold text-black/60">
              Please complete the required inputs for this status.
            </div>

            <div className="mt-3">
              <MoveStageCards
                toStage={nextStage}
                deal={deal}
                setStageData={setStageData}
                stageData={stageData}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90"
                onClick={() => {
                  setStageConfirmed(true);
                  setShowStagePrompt(false);
                  submit();
                }}
              >
                Continue
              </button>
              <button
                type="button"
                className="flex-1 rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black hover:border-black/20"
                onClick={() => {
                  setShowStagePrompt(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}















