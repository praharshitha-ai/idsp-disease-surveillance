import { useEffect, useMemo, useRef, useState } from "react";

// Disease selector dropdown (styled like the reference): a light pill button with
// a chevron; opening reveals an A–Z search and a plain list, the selected disease
// highlighted in light purple.
export default function DiseasePicker({ diseases, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const current = diseases.find((d) => d.slug === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const list = useMemo(() => {
    const sorted = [...diseases].sort((a, b) => a.name.localeCompare(b.name));
    const term = q.trim().toLowerCase();
    return term ? sorted.filter((d) => d.name.toLowerCase().includes(term)) : sorted;
  }, [diseases, q]);

  const select = (slug) => { onChange(slug); setOpen(false); setQ(""); };

  return (
    <div className={`disease-picker${open ? " open" : ""}`} ref={ref}>
      <div className="dp-label">Disease</div>
      <button className="dp-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox">
        <span className="dp-current">Disease search</span>
        <svg className="dp-chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="dp-panel" role="listbox">
          <input
            className="dp-search" autoFocus type="search" placeholder="Search A–Z…"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search diseases"
          />
          <ul className="dp-list">
            {list.map((d) => (
              <li key={d.slug}>
                <button className={d.slug === value ? "active" : ""} onClick={() => select(d.slug)}
                        role="option" aria-selected={d.slug === value}>
                  <span className="dp-name">{d.name}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="dp-empty">No disease matches “{q}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
