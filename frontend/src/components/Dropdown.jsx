import { useEffect, useRef, useState } from "react";

// Styled select dropdown: a pill button with a chevron that opens a panel of
// options, the active one highlighted. Light-theme, for the main content area.
export default function Dropdown({ value, options, onChange, placeholder = "Select…", ariaLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const cur = options.find((o) => o.value === value);

  return (
    <div className={`ui-dd${open ? " open" : ""}`} ref={ref}>
      <button className="ui-dd-btn" onClick={() => setOpen((o) => !o)}
              aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}>
        <span className="ui-dd-label">{cur ? cur.label : placeholder}</span>
        <svg className="ui-dd-chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="ui-dd-panel" role="listbox">
          {options.map((o) => (
            <li key={o.value}>
              <button className={`ui-dd-item${o.value === value ? " active" : ""}`}
                      role="option" aria-selected={o.value === value}
                      onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
