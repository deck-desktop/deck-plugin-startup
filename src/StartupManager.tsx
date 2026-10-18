import { useEffect, useRef, useState } from "react";
import { listen } from "../shim/event.js";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Plus, Trash2, FolderOpen, Check, Power } from "lucide-react";
import {
  configRead, configWrite, pickExe, listInstalled,
  type StartupProgram, type AppProc,
} from "../shim/bridge.js";
import { TextInput, TimeInput, DayPicker, Toggle, ConfirmDialog, type ConfirmState } from "../shim/ui.js";
import { AppCombo } from "./AppCombo";
import { fmtTime } from "./timeFormat";

function summarizeDays(days: string[]): string {
  if (days.length === 7) return "Every day";
  const wd = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  if (days.length === 5 && wd.every((d) => days.includes(d))) return "Mon–Fri";
  return days.map((d) => d.slice(0, 2)).join(", ");
}

// Would this program launch right now (today in Days, now within Start–End)?
function launchesNow(p: StartupProgram): boolean {
  if (!p.Enabled) return false;
  const now = new Date();
  const today = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
  if (!p.Days.includes(today)) return false;
  const [sh, sm] = p.Start.split(":").map(Number);
  const [eh, em] = p.End.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= sh * 60 + sm && mins <= eh * 60 + em;
}

const EMPTY: StartupProgram = {
  Name: "", Path: "", Args: [], Days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  Start: "08:00", End: "17:00", Enabled: true,
};

export default function StartupManager() {
  const [list, setList] = useState<StartupProgram[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [running, setRunning] = useState<AppProc[]>([]);
  const ensureInstalled = () => { if (running.length === 0) listInstalled().then(setRunning).catch((e) => console.warn("[startup] installed apps load failed", e)); };
  // Last text we read-from / wrote-to disk. Autosave only fires when the list
  // actually differs from this — so loads (mount or config-changed) never echo
  // back a write, and there's no fragile "hydrating" flag race.
  const lastSynced = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A load that started before the newest edit must not apply its stale result on top of it.
  // config-changed fires on Deck's OWN writes too, so several loads are routinely in flight at
  // once; without this the last one to resolve wins rather than the newest one to start.
  const loadTicket = useRef(0);
  const load = () => {
    const ticket = ++loadTicket.current;
    return configRead("startup").then((t) => {
      if (ticket !== loadTicket.current) return; // a newer load started; this result is stale
      try {
        // No file yet reads as nothing: an empty list, and a loaded one, so the first edit saves.
        const a = t.trim() ? JSON.parse(t) : [];
        const arr = Array.isArray(a) ? a : [];
        lastSynced.current = JSON.stringify(arr);
        setList(arr);
      } catch { /* leave current on parse error */ }
    }).catch((e) => { console.warn("[startup] list load failed", e); /* leave current */ });
  };
  useEffect(() => {
    load();
    let unlisten: (() => void) | undefined;
    listen<string[]>("config-changed", (e) => { if (e.payload.includes("startup")) load(); }).then((u) => (unlisten = u));
    return () => unlisten?.();
    /* eslint-disable-next-line */
  }, []);

  // Autosave (debounced) only when the list differs from what's on disk.
  useEffect(() => {
    const cur = JSON.stringify(list);
    if (lastSynced.current === null || cur === lastSynced.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      // Claim the value BEFORE the write, not after. The write itself trips the config watcher,
      // which fires `config-changed` and re-runs load() — and until lastSynced names what we are
      // writing, that load reads the pre-write file and setLists it back over the edit. The user
      // sees a change they just made silently revert, which reads as "it isn't saving".
      lastSynced.current = cur;
      loadTicket.current++; // invalidate any in-flight load; disk is about to be older than us
      await configWrite("startup", JSON.stringify(list, null, 2));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1400);
    }, 500);
  }, [list]);

  const update = (i: number, patch: Partial<StartupProgram>) =>
    setList((l) => l.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const remove = (i: number) => setConfirm({
    title: `Remove ${list[i]?.Name || "this program"}?`,
    body: "It will no longer start when you log in. The program itself stays installed.",
    confirmLabel: "Remove",
    onConfirm: () => { setList((l) => l.filter((_, idx) => idx !== i)); setOpenIdx(null); },
  });
  const add = () => { setList((l) => [...l, { ...EMPTY }]); setOpenIdx(list.length); };

  const browse = async (i: number) => { const p = await pickExe(); if (p) update(i, { Path: p }); };

  const label = "mb-1 block text-[12px] font-medium text-text-secondary";
  const green = "rgb(var(--tone-green-400))";
  // Read from disk at least once: before that an empty list is not yet known to be empty.
  const empty = lastSynced.current !== null && list.length === 0;

  return (
    <div className="relative flex h-full w-full flex-col">
      <AnimatePresence>
        {savedFlash && (
          <motion.span
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute right-0 top-0 z-10 flex items-center gap-1 text-[11.5px]" style={{ color: "var(--accent)" }}
          >
            <Check size={12} /> Saved
          </motion.span>
        )}
      </AnimatePresence>

      {/* What this is, and the way to add to it; the button is the page's one accent action while
          the list is empty, and a quiet one beside a list. */}
      <div className="flex shrink-0 items-center gap-3 pb-4 pt-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-semibold text-text-primary">Startup</h1>
          <p className="mt-0.5 text-[12.5px] text-text-muted">Programs that start when you log in, on the days and within the hours you choose.</p>
        </div>
        {!empty && lastSynced.current !== null && (
          <button onClick={add}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-subtle bg-elev px-3 text-[12.5px] text-text-secondary transition-colors hover:border-strong hover:text-text-primary">
            <Plus size={13} /> New program
          </button>
        )}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
       {empty ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-subtle px-6 py-12 text-center">
          <span className="grid size-11 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Power size={20} />
          </span>
          <div className="flex max-w-sm flex-col gap-1">
            <span className="text-[13.5px] font-medium text-text-primary">Nothing starts at logon yet</span>
            <span className="text-[12.5px] leading-relaxed text-text-muted">Add a program, then pick its days and hours. Deck starts it when you log in within that window, and leaves it alone outside it.</span>
          </div>
          <button onClick={add}
            className="mt-1 flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-medium text-white transition hover:brightness-110"
            style={{ background: "var(--accent)" }}>
            <Plus size={13} /> New program
          </button>
        </div>
       ) : list.length > 0 && (
       <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle" style={{ background: "var(--bg-card-glass)" }}>
        {list.map((p, i) => {
          const open = openIdx === i;
          const live = launchesNow(p);
          return (
            <motion.div
              key={i}
              layout
              className="overflow-hidden transition-colors"
              style={{ background: open ? "color-mix(in srgb, var(--accent) 5%, var(--bg-card))" : "transparent" }}
            >
              {/* Row header */}
              <button
                onClick={() => setOpenIdx(open ? null : i)}
                className="flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-white/5"
              >
                <span
                  className="relative size-2 shrink-0 rounded-full"
                  style={{ background: p.Enabled ? green : "var(--border-strong)" }}
                >
                  {live && (
                    <span className="absolute inset-0 animate-ping rounded-full" style={{ background: green }} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={"truncate text-[12.5px] font-medium " + (p.Name ? "text-text-primary" : "text-text-muted")}>
                      {p.Name || "(unnamed)"}
                    </span>
                    {live && (
                      <span className="shrink-0 rounded-full px-1.5 py-px text-[10.5px]"
                        style={{ color: green, background: `color-mix(in srgb, ${green} 14%, transparent)` }}>
                        Would launch now
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {summarizeDays(p.Days)} · {fmtTime(p.Start)}–{fmtTime(p.End)}
                  </div>
                </div>
                {/* enabled toggle. Its click stays here, or it would also open the row. */}
                <span className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Toggle on={p.Enabled} onChange={(v) => update(i, { Enabled: v })} />
                </span>
                <ChevronDown
                  size={15}
                  className="shrink-0 text-text-muted transition-transform"
                  style={{ transform: open ? "rotate(180deg)" : "none" }}
                />
              </button>

              {/* Inline editor */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* Editor: constrained column, aligned under the row title. Short fields
                        pair into a 2-col grid (reference style); long path field is full-width. */}
                    <div className="border-t border-subtle py-4 pl-[34px] pr-3.5">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <label className="block">
                          <span className={label}>Name</span>
                          <TextInput value={p.Name} onChange={(e) => update(i, { Name: e.target.value })} placeholder="Display name" />
                        </label>
                        <label className="block">
                          <span className={label}>Arguments <span className="font-normal text-text-muted">· optional</span></span>
                          <TextInput type="text" value={p.Args.join(" ")}
                            onChange={(e) => update(i, { Args: e.target.value.split(" ").filter(Boolean) })}
                            placeholder="Space-separated" />
                        </label>

                        <label className="col-span-2 block">
                          <span className={label}>Application</span>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <AppCombo
                                value={p.Path}
                                onChange={(v) => update(i, { Path: v })}
                                onPickName={(name) => update(i, { Name: list[i].Name || name })}
                                apps={running}
                                onRefresh={ensureInstalled}
                                pickField="path"
                                placeholder="Search installed apps or type a path…"
                              />
                            </div>
                            <button onClick={() => browse(i)} title="Browse for .exe"
                              className="grid h-9 w-10 shrink-0 place-items-center rounded-md border border-subtle bg-elev text-text-secondary transition-colors hover:border-strong hover:text-text-primary">
                              <FolderOpen size={15} />
                            </button>
                          </div>
                        </label>

                        <div className="col-span-2">
                          <span className={label}>Active days</span>
                          <DayPicker value={p.Days} onChange={(d) => update(i, { Days: d })} />
                        </div>

                        <label className="block">
                          <span className={label}>Start</span>
                          <TimeInput value={p.Start} onChange={(v) => update(i, { Start: v })} className="w-full" />
                        </label>
                        <label className="block">
                          <span className={label}>End</span>
                          <TimeInput value={p.End} onChange={(v) => update(i, { End: v })} className="w-full" />
                        </label>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button onClick={() => remove(i)}
                          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] text-text-muted transition-colors hover:bg-white/5 hover:text-red-400">
                          <Trash2 size={13} /> Remove program
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
       </div>
       )}

      </div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
