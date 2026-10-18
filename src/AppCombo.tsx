import { useEffect, useRef, useState } from "react";
import { createPortal } from "../shim/react-dom.js";
import { AnimatePresence, motion } from "framer-motion";
import { type AppProc } from "../shim/bridge.js";

/**
 * Editable app picker: type a process name, or open a styled dropdown of
 * running apps aligned to the field. Auto-refreshes the app list on open.
 *
 * The dropdown is portalled to <body> and placed from the field's screen rect: inside the
 * program's row it sat under the row's overflow-hidden (the open/close animation needs it), so
 * a long list was cut off at the row's bottom edge.
 */
export function AppCombo({
  value, onChange, apps, onRefresh, pickField = "name", placeholder = "slack", onPickName,
}: {
  value: string;
  onChange: (v: string) => void;
  apps: AppProc[];
  onRefresh: () => void;
  pickField?: "name" | "path";   // what a picked row writes into the field
  placeholder?: string;
  onPickName?: (name: string) => void;  // optional: also receive the picked app's name
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; width: number; top?: number; bottom?: number; up: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const openMenu = () => {
    onRefresh();
    // Open upward if there isn't ~240px of room below the field.
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) {
      const up = window.innerHeight - r.bottom < 240;
      setAt(up
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4, up }
        : { left: r.left, width: r.width, top: r.bottom + 4, up });
    }
    setOpen(true);
  };

  useEffect(() => {
    const inside = (t: EventTarget | null) =>
      !!(t instanceof Node && (wrapRef.current?.contains(t) || listRef.current?.contains(t)));
    const onDoc = (e: MouseEvent) => { if (!inside(e.target)) setOpen(false); };
    // Placed once from the field's rect, so a scroll of the page under it would leave it behind.
    // Scrolling the list itself is fine.
    const onScroll = (e: Event) => { if (!listRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q
    ? apps.filter((a) => a.name.toLowerCase().includes(q) || a.title.toLowerCase().includes(q))
    : apps;

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); if (!open) openMenu(); }}
        onFocus={openMenu}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-strong bg-elev px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:shadow-glow"
      />
      {createPortal(
        <AnimatePresence>
          {open && at && filtered.length > 0 && (
            <motion.ul
              ref={listRef}
              initial={{ opacity: 0, y: at.up ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: at.up ? 4 : -4 }}
              transition={{ duration: 0.12 }}
              className="scroll-thin fixed z-[120] max-h-40 overflow-y-auto rounded-[10px] border border-subtle p-1 shadow-2xl"
              style={{ left: at.left, width: at.width, top: at.top, bottom: at.bottom, background: "var(--bg-card)" }}
            >
              {filtered.map((a) => (
                <li key={a.name}>
                  <button
                    type="button"
                    onClick={() => { onChange(pickField === "path" ? a.path : a.name); onPickName?.(a.name); setOpen(false); }}
                    className="flex w-full flex-col items-start rounded-[6px] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="text-[12.5px] text-text-primary">{a.name}</span>
                    {(a.title || a.path) && <span className="w-full truncate text-[11px] text-text-muted">{a.title || a.path}</span>}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
