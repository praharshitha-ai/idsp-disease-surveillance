import { useEffect, useRef, useState } from "react";

const MODEL = "openai/gpt-oss-120b";
const ENV_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

const nf = (v) => Math.round(v).toLocaleString();

// Build a grounded context sized for Groq's token/min limit: an always-on summary
// (all states × year + the biggest districts) plus the specific districts/states
// the question mentions — so any district is reachable without sending all 600+.
function buildContext({ diseases, disease, ts, question }) {
  const q = (question || "").toLowerCase();
  const years = ts.years;
  const dl = diseases.map((d) => `${d.name}: ${d.totalCases.toLocaleString()}`).join("; ");

  const stateYear = new Map();
  for (const d of ts.districts) {
    let arr = stateYear.get(d.state);
    if (!arr) { arr = years.map(() => 0); stateYear.set(d.state, arr); }
    for (let i = 0; i < years.length; i++) arr[i] += d.cases[i];
  }
  const rankedStates = [...stateYear.entries()]
    .map(([s, arr]) => [s, arr, arr.reduce((a, b) => a + b, 0)])
    .sort((a, b) => b[2] - a[2]);
  const stateTotals = rankedStates.map(([s, , t]) => `${s}: ${nf(t)}`).join("; ");
  const stateMatrix = rankedStates.map(([s, arr]) => `${s}: ${arr.map((v) => Math.round(v)).join(",")}`).join("\n");
  const byYear = years.map((y, i) => `${y}: ${nf(ts.districts.reduce((a, d) => a + d.cases[i], 0))}`).join("; ");

  // Districts: top 30 by total + any district/state named in the question (capped).
  const withTot = ts.districts
    .map((d) => ({ d, tot: d.cases.reduce((a, b) => a + b, 0) }))
    .filter((x) => x.tot > 0).sort((a, b) => b.tot - a.tot);
  const top = withTot.slice(0, 12);
  const chosen = new Set(top.map((x) => x.d.code));
  const matched = [];
  for (const x of withTot) {
    if (chosen.has(x.d.code) || matched.length >= 60) continue;
    const dn = x.d.district.toLowerCase(), sn = x.d.state.toLowerCase();
    if ((dn.length >= 4 && q.includes(dn)) || (sn.length >= 4 && q.includes(sn))) {
      matched.push(x); chosen.add(x.d.code);
    }
  }
  const row = (x) => `${x.d.district} (${x.d.state}): ${x.d.cases.map((v) => Math.round(v)).join(",")}`;
  const districtRows = [...top, ...matched].map(row).join("\n");

  return `All tracked diseases (total reported cases, all years): ${dl}.
Currently selected disease: ${disease}.
Year columns, in order: ${years.join(",")}.
${disease} — national reported cases by year: ${byYear}.
${disease} — total reported cases by state, all years (highest first): ${stateTotals}.
${disease} — reported cases BY STATE AND YEAR (row "State: v1,v2,..." = cases for the year columns above, same order):
${stateMatrix}
${disease} — reported cases BY DISTRICT AND YEAR (row "District (State): v1,v2,..."; this lists the largest districts plus any district/state mentioned in the question — if a specific district you need isn't here, ask about it by name and it will be included):
${districtRows}`;
}

async function askGroq(apiKey, messages) {
  const res = await fetch("/groq/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 600, reasoning_effort: "low" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Rate limit reached (free Groq tier ≈ 8k tokens/min). Please wait ~30 seconds, then ask again.");
    if (res.status === 413) throw new Error("That question pulled in too much data. Try asking about a specific state, district, or year.");
    if (res.status === 401) throw new Error("Groq rejected the API key (401). Check the key in .env.");
    throw new Error(`Groq API ${res.status}: ${t.slice(0, 200) || res.statusText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "(empty response)";
}

export default function ChatBot({ diseases, disease, ts }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(() => ENV_KEY || localStorage.getItem("groq_key") || "");
  const [keyDraft, setKeyDraft] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: "assistant", content: `Hi! Ask me about ${disease} or any tracked disease — national, state, or district case counts and trends.` },
  ]);
  const bodyRef = useRef(null);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, busy, open]);

  const saveKey = () => { const k = keyDraft.trim(); if (!k) return; localStorage.setItem("groq_key", k); setKey(k); setKeyDraft(""); };

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    const context = buildContext({ diseases, disease, ts, question: q });
    const system = {
      role: "system",
      content:
        "You are an analyst assistant for an IDSP (India) disease-surveillance dashboard. The DATA below contains, for the currently selected disease, full case counts by state-and-year AND by district-and-year for every district in India, plus totals for all tracked diseases. Answer questions about reported case counts across India, its states, districts and years using ONLY this DATA. These are reported outbreak-surveillance counts, not true prevalence/incidence — say so if relevant. Be concise, lead with the specific numbers, and if the data genuinely doesn't cover the question (e.g. a different disease's district detail), say what is available instead. Never invent figures.\n\nDATA:\n" +
        context,
    };
    try {
      const history = next.filter((m) => m.role !== "system").slice(-8);
      const answer = await askGroq(key, [system, ...history]);
      setMsgs((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "error", content: String(e.message || e) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label="Open assistant" title="Ask the data assistant">
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="chat-panel" role="dialog" aria-label="Data assistant">
          <div className="chat-head">
            <div>
              <strong>Data assistant</strong>
              <span className="chat-sub">Grounded in IDSP dashboard data · Groq</span>
            </div>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          {!key ? (
            <div className="chat-keygate">
              <p>Enter your <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Groq API key</a> to start. It's stored only in this browser.</p>
              <input type="password" placeholder="gsk_…" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && saveKey()} />
              <button onClick={saveKey}>Save key</button>
            </div>
          ) : (
            <>
              <div className="chat-body" ref={bodyRef}>
                {msgs.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
                ))}
                {busy && <div className="chat-msg assistant chat-typing">Thinking…</div>}
              </div>
              <div className="chat-input">
                <textarea rows={1} placeholder={`Ask about ${disease}…`} value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button onClick={send} disabled={busy || !input.trim()}>Send</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
