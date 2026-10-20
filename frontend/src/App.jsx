import { useEffect, useMemo, useState } from "react";
import { useJson } from "./hooks/useJson.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatBot from "./components/ChatBot.jsx";
import IndiaView from "./views/IndiaView.jsx";
import StateView from "./views/StateView.jsx";
import DistrictView from "./views/DistrictView.jsx";

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem("idsp_auth") === "1");
  const [collapsed, setCollapsed] = useState(false);

  const index = useJson(authed ? "/data/diseases.json" : null);
  const stateGeo = useJson(authed ? "/data/india_states.geojson" : null);

  const [diseaseSlug, setDiseaseSlug] = useState(null);
  const [tab, setTab] = useState("india");
  const [stateFilter, setStateFilter] = useState(null);
  const [districtFilter, setDistrictFilter] = useState(null);
  const [visitedGeo, setVisitedGeo] = useState(false);

  useEffect(() => {
    if (index.data && !diseaseSlug) setDiseaseSlug(index.data.diseases[0].slug);
  }, [index.data, diseaseSlug]);

  const disease = useJson(authed && diseaseSlug ? `/data/diseases/${diseaseSlug}.json` : null);

  useEffect(() => { if (tab === "state") setVisitedGeo(true); }, [tab]);
  const districtGeo = useJson(authed && visitedGeo ? "/data/india_districts.geojson" : null);

  const baseLoading = index.loading || stateGeo.loading;
  const error = index.error || stateGeo.error || disease.error;

  const composed = useMemo(() => {
    if (!index.data || !disease.data) return null;
    const m = index.data.meta, dd = disease.data;
    return {
      disease: dd.disease,
      ts: { years: m.years, states: dd.states, crosswalk: m.crosswalk, districts: dd.districts },
      insights: { months: m.months, years: m.years, maxYear: m.maxYear, maxMonthIdx: m.maxMonthIdx, scopes: dd.insights.scopes },
    };
  }, [index.data, disease.data]);

  const topState = useMemo(() => {
    if (!composed) return null;
    const m = new Map();
    for (const d of composed.ts.districts) m.set(d.state, (m.get(d.state) || 0) + d.cases.reduce((a, b) => a + b, 0));
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? composed.ts.states[0];
  }, [composed]);

  useEffect(() => { setStateFilter(null); setDistrictFilter(null); }, [diseaseSlug]);
  useEffect(() => {
    if (composed && (!stateFilter || !composed.ts.states.includes(stateFilter))) setStateFilter(topState);
  }, [composed, stateFilter, topState]);

  const pickState = (dataState) => {
    if (composed?.ts.states.includes(dataState)) { setStateFilter(dataState); setTab("state"); }
  };
  const openDistrict = (code) => { setDistrictFilter(code); setTab("district"); };

  const login = () => { localStorage.setItem("idsp_auth", "1"); setAuthed(true); };
  const signOut = () => { localStorage.removeItem("idsp_auth"); setAuthed(false); };

  if (!authed) return <Login onLogin={login} />;

  return (
    <div className="layout">
      <Sidebar
        tab={tab} setTab={setTab}
        diseases={index.data?.diseases ?? []} diseaseSlug={diseaseSlug} onDisease={setDiseaseSlug}
        collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} onSignOut={signOut}
      />
      <main className="main">
        {baseLoading && <div className="state-msg">Loading…</div>}
        {error && <div className="state-msg">Failed to load data: {String(error.message || error)}</div>}
        {!baseLoading && !error && !composed && <div className="state-msg">Loading disease data…</div>}
        {!baseLoading && !error && composed && stateFilter && (
          tab === "india" ? (
            <IndiaView ts={composed.ts} disease={composed.disease} stateGeo={stateGeo.data}
                       insights={composed.insights} onPickState={pickState} />
          ) : tab === "state" ? (
            <StateView districtGeo={districtGeo} ts={composed.ts} disease={composed.disease}
                       insights={composed.insights} stateFilter={stateFilter} setStateFilter={setStateFilter}
                       onOpenDistrict={openDistrict} />
          ) : (
            <DistrictView districtGeo={districtGeo} ts={composed.ts} disease={composed.disease}
                          insights={composed.insights} stateFilter={stateFilter} setStateFilter={setStateFilter}
                          districtFilter={districtFilter} setDistrictFilter={setDistrictFilter} />
          )
        )}
      </main>
      {composed && (
        <ChatBot diseases={index.data?.diseases ?? []} disease={composed.disease} ts={composed.ts} />
      )}
    </div>
  );
}
