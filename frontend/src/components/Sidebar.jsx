import DiseasePicker from "./DiseasePicker.jsx";

const TABS = [
  { id: "india", label: "India Level", sub: "National overview", icon: IconGlobe },
  { id: "state", label: "State Level", sub: "Per-state deep dive", icon: IconLayers },
  { id: "district", label: "District Level", sub: "Single-district metrics", icon: IconPin },
];

export default function Sidebar({ tab, setTab, diseases, diseaseSlug, onDisease, collapsed, onToggleCollapse, onSignOut }) {
  return (
    <nav className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-head">
        <div className="brand">
          <span className="brand-mark" />
          {!collapsed && <span>Disease<br />Surveillance</span>}
        </div>
        <button className="collapse-btn" onClick={onToggleCollapse}
                title={collapsed ? "Expand" : "Collapse"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <ul className="nav-tabs">
        {TABS.map((t) => (
          <li key={t.id}>
            <button className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}
                    title={collapsed ? t.label : undefined}>
              <span className="nav-ic"><t.icon /></span>
              {!collapsed && (
                <span className="nav-txt">
                  <span className="nav-label">{t.label}</span>
                  <span className="nav-sub">{t.sub}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {!collapsed && <DiseasePicker diseases={diseases} value={diseaseSlug} onChange={onDisease} />}

      <div className="sidebar-foot">
        <button className="signout-btn" onClick={onSignOut} title="Sign out">
          <span className="nav-ic"><IconSignOut /></span>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </nav>
  );
}

function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-6-3.8-9S9.5 5.5 12 3z" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
    </svg>
  );
}
