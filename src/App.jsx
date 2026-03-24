import { useState, useEffect, useMemo } from "react";

/* ═══════════════════ DATA ═══════════════════ */
const PROVS = {
  ON: { n: "Ontario", esa: "Employment Standards Act, 2000", tw: y => Math.min(Math.floor(y), 8), sw: (y, e) => e && y >= 5 ? Math.min(Math.floor(y), 26) : 0, hs: true, sn: "Ontario is one of the few provinces with a separate severance pay on top of termination pay. Applies when employer payroll exceeds $2.5M or 50+ employees severed within 6 months, and you have 5+ years of service.", kc: "Waksdale v. Swegon North America Inc., 2020 ONCA 391" },
  BC: { n: "British Columbia", esa: "Employment Standards Act, RSBC 1996", tw: y => y < .25 ? 0 : y < 1 ? 1 : y < 3 ? 2 : Math.min(Math.floor(y), 8), sw: () => 0, hs: false, kc: "Bardal v. Globe & Mail Ltd." },
  AB: { n: "Alberta", esa: "Employment Standards Code, RSA 2000", tw: y => y < .25 ? 0 : y < 2 ? 1 : y < 4 ? 2 : y < 6 ? 4 : y < 8 ? 5 : y < 10 ? 6 : 8, sw: () => 0, hs: false, kc: "Bardal factors" },
  FED: { n: "Federal (CLC)", esa: "Canada Labour Code, Part III", tw: y => y >= 1 ? 2 : 0, sw: y => y >= 1 ? Math.max(Math.round(y * 5 / 7), 2) : 0, hs: true, sn: "Under the Canada Labour Code, federally regulated employees get both termination pay and severance pay after 12 months.", kc: "s. 240 CLC" },
  QC: { n: "Quebec", esa: "Act respecting labour standards", tw: y => y < .25 ? 0 : y < 1 ? 1 : y < 5 ? 2 : y < 10 ? 4 : 8, sw: () => 0, hs: false, kc: "Civil law principles" },
  SK: { n: "Saskatchewan", esa: "Saskatchewan Employment Act", tw: y => y < .25 ? 0 : y < 3 ? Math.min(Math.floor(y), 2) : y < 5 ? Math.min(Math.floor(y), 4) : y < 10 ? Math.min(Math.floor(y), 6) : 8, sw: () => 0, hs: false, kc: "Bardal principles" },
  MB: { n: "Manitoba", esa: "Employment Standards Code", tw: y => y < .25 ? 0 : y < 3 ? Math.min(Math.floor(y), 2) : y < 5 ? 4 : y < 10 ? 6 : 8, sw: () => 0, hs: false, kc: "Bardal principles" },
  NS: { n: "Nova Scotia", esa: "Labour Standards Code", tw: y => y < .25 ? 0 : y < 2 ? 1 : y < 5 ? 2 : y < 10 ? 4 : 8, sw: () => 0, hs: false, kc: "Bardal factors" },
  NB: { n: "New Brunswick", esa: "Employment Standards Act", tw: y => y < .5 ? 0 : y < 5 ? 2 : 4, sw: () => 0, hs: false, kc: "Common law principles" },
  NL: { n: "Newfoundland & Labrador", esa: "Labour Standards Act, RSNL 1990", tw: y => y < .25 ? 0 : y < 2 ? 1 : y < 5 ? 2 : y < 10 ? 3 : y < 15 ? 4 : 6, sw: () => 0, hs: false, kc: "Bardal factors" },
  PE: { n: "Prince Edward Island", esa: "Employment Standards Act, RSPEI 1988", tw: y => y < .5 ? 0 : y < 5 ? 2 : y < 10 ? 4 : y < 15 ? 6 : 8, sw: () => 0, hs: false, kc: "Bardal factors" },
  YT: { n: "Yukon", esa: "Employment Standards Act, RSY 2002", tw: y => y < .5 ? 0 : y < 1 ? 1 : y < 3 ? 2 : Math.min(Math.floor(y), 8), sw: () => 0, hs: false, kc: "Common law principles", tr: true },
  NT: { n: "Northwest Territories", esa: "Employment Standards Act, SNWT 2007", tw: y => y < .25 ? 0 : y < 3 ? 2 : Math.min(Math.floor(y), 8), sw: () => 0, hs: false, kc: "Limited territorial case law", tr: true },
  NU: { n: "Nunavut", esa: "Labour Standards Act, RSNWT (Nu) 1988", tw: y => y < .25 ? 0 : y < 3 ? 2 : Math.min(Math.floor(y), 8), sw: () => 0, hs: false, kc: "Limited territorial case law", tr: true },
};
const ROLES = [
  { id: "ic", l: "Individual contributor", d: "No direct reports. You do the work yourself. Limited decision-making authority.", mL: .45, mM: .65, mH: .85 },
  { id: "exp", l: "Experienced professional / team lead", d: "Work independently or lead small teams. Trusted with day-to-day decisions.", mL: .65, mM: .9, mH: 1.15 },
  { id: "mgmt", l: "Management / senior leadership", d: "Manage people or departments. Involved in strategy, budgets, major decisions.", mL: .85, mM: 1.1, mH: 1.4 },
  { id: "exec", l: "Executive / C-Suite", d: "Report to board or CEO. Major business function responsibility.", mL: 1.1, mM: 1.45, mH: 1.8 },
];
const REASONS = [
  { id: "wc", l: "Without cause", i: "Standard entitlements" }, { id: "re", l: "Restructuring / role eliminated", i: "Standard; may strengthen position" },
  { id: "cd", l: "Constructive dismissal", i: "Full notice if established" }, { id: "pf", l: "Alleged performance", i: "Heavy burden on employer" }, { id: "un", l: "Not sure / other", i: "Assumes without cause" },
];
const INDS = ["Technology", "Finance / Banking", "Legal / Professional", "Healthcare", "Energy / Resources", "Manufacturing", "Retail / Consumer", "Government", "Other"];
const BENS = [
  { id: "health", l: "Health / dental", t: "Typically terminates on last day unless extended in severance. Contact insurer within 30 days for guaranteed conversion to individual plan. Check if spouse\u2019s plan can add you." },
  { id: "pension", l: "Pension / RRSP match", t: "Matching stops immediately. Vested benefits preserved. Request pension statement. Transfer group RRSP/DCPP to personal RRSP or LIRA." },
  { id: "stock", l: "Stock options / RSUs", t: "Unvested equity typically lapses 30\u201390 days post-termination. Check plan documents immediately. Negotiate accelerated vesting if significant." },
  { id: "life", l: "Life insurance", t: "Terminates on last day. Most policies offer 30-day conversion without underwriting. Contact insurer." },
  { id: "disability", l: "Disability", t: "Terminates immediately. Cannot file new LTD claim after last day. If pre-existing condition, file before termination. Consider private coverage." },
  { id: "car", l: "Car allowance", t: "Stops on termination. Should be included in total compensation for severance calculation." },
];
function aMod(a) { return a < 35 ? { l: .82, m: .88, h: .92 } : a < 45 ? { l: .92, m: 1, h: 1.05 } : a < 55 ? { l: 1.05, m: 1.15, h: 1.22 } : { l: 1.18, m: 1.3, h: 1.4 }; }
function cRisk(d) {
  if (!d.hasContract || !d.contractTerms) return { m: 1, note: "No written termination clause. The full range of court-awarded notice likely applies." };
  if (d.contractAge === "old") return { m: .8, note: "Older clause \u2014 more likely enforceable, but courts still scrutinize closely." };
  if (d.contractAge === "recent" && d.province === "ON") return { m: .9, note: "Post-Waksdale, many Ontario clauses have been invalidated. Worth reviewing." };
  return { m: .85, note: "Enforceability uncertain. Lawyer should assess." };
}
function calc(d) {
  const p = PROVS[d.province], r = ROLES.find(x => x.id === d.role);
  const yrs = (parseFloat(d.years) || 0) + (parseFloat(d.months) || 0) / 12;
  const a = parseInt(d.age) || 30, s = parseFloat(d.salary) || 0, b = parseFloat(d.bonus) || 0, tc = s + b;
  const wk = tc / 52, tw = p.tw(yrs), sw = p.sw(yrs, d.sevElig), totW = tw + sw;
  const am = aMod(a), mo = tc / 12, ind = d.induced && yrs < 3 ? (yrs < 1 ? 1.25 : yrs < 2 ? 1.18 : 1.10) : 1, ci = cRisk(d), bf = d.badFaith ? 1.1 : 1;
  const cL = Math.min(Math.max(yrs * r.mL * am.l * ind * ci.m * bf, 1), 26);
  const cM = Math.min(Math.max(yrs * r.mM * am.m * ind * ci.m * bf, 1), 26);
  const cH = Math.min(Math.max(yrs * r.mH * am.h * ind * bf, 2), 26);
  let off = null;
  if (d.hasOffer) { if (d.offFmt === "amt") off = parseFloat(d.offAmt) || 0; else if (d.offFmt === "wks") off = (parseFloat(d.offWks) || 0) * wk; else off = (parseFloat(d.offMos) || 0) * mo; }
  const vd = parseFloat(d.vacDays) || 0;
  const indPct = d.induced && yrs < 3 ? Math.round((ind - 1) * 100) : 0;
  return { pn: p.n, esa: p.esa, tw, sw, totW, esaAmt: Math.round(totW * wk), wk: Math.round(wk), cL: Math.round(cL * 10) / 10, cM: Math.round(cM * 10) / 10, cH: Math.round(cH * 10) / 10, cLA: Math.round(cL * mo), cMA: Math.round(cM * mo), cHA: Math.round(cH * mo), off, offMo: off !== null && mo > 0 ? Math.round(off / mo * 10) / 10 : null, mo: Math.round(mo), hs: p.hs, sn: p.sn, kc: p.kc, sal: s, bonus: b, tc, yrs: Math.round(yrs * 10) / 10, age: a, rl: r.l, ind: d.induced && yrs < 3, indPct, ci, reason: d.reason, bens: d.bens || [], jt: d.jobTitle, industry: d.industry, sr: d.signedRelease, dl: d.deadline, dlDays: d.deadlineDays, prov: d.province, vd, vp: Math.round(vd * (s / 260)), bf: d.badFaith, newJob: d.newJob, nc: d.nonCompete, hasContract: d.hasContract, contractAge: d.contractAge, tr: !!p.tr };
}
const $ = n => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
const T = "#0A6B5C", Td = "#085041", Tl = "#9FE1CB";

/* ═══════════════════ UI ═══════════════════ */
function Fade({ children, delay = 0 }) { const [s, setS] = useState(false); useEffect(() => { const t = setTimeout(() => setS(true), delay); return () => clearTimeout(t); }, [delay]); return <div style={{ opacity: s ? 1 : 0, transform: s ? "translateY(0)" : "translateY(8px)", transition: "all .4s cubic-bezier(.25,1,.5,1)" }}>{children}</div>; }

function Sel({ on, onClick, children, sub }) {
  return <button onClick={onClick} style={{ display: "flex", alignItems: "flex-start", width: "100%", textAlign: "left", padding: sub ? "12px 14px" : "11px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13.5, border: on ? "2px solid " + T : "1.5px solid #D3D1C7", background: on ? "rgba(10,107,92,.04)" : "#fff", color: "#1A1A18", fontWeight: on ? 500 : 400, marginBottom: 5, transition: "all .12s" }}>
    <div style={{ width: 17, height: 17, borderRadius: 17, marginRight: 11, flexShrink: 0, marginTop: sub ? 2 : 0, border: on ? "5px solid " + T : "2px solid #D3D1C7", background: on ? T : "#fff", boxSizing: "border-box" }} />
    <div style={{ flex: 1 }}><span>{children}</span>{sub && <p style={{ fontSize: 10.5, color: "#999", margin: "2px 0 0", lineHeight: 1.3, fontWeight: 400 }}>{sub}</p>}</div>
    {on && <span style={{ color: T, fontSize: 13, marginLeft: 5, flexShrink: 0 }}>{"\u2713"}</span>}
  </button>;
}

function Fld({ label, value, onChange, type, prefix, placeholder, help, suffix }) {
  const [f, setF] = useState(false);
  return <div style={{ marginBottom: 14, minWidth: 0 }}>
    {label && <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</label>}
    <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 9, border: f ? "2px solid " + T : "1.5px solid #D3D1C7", padding: f ? "0 12px" : "0 13px", boxShadow: f ? "0 0 0 3px rgba(10,107,92,.06)" : "none", transition: "all .12s", minWidth: 0 }}>
      {prefix && <span style={{ color: "#888", fontSize: 14, marginRight: 4 }}>{prefix}</span>}
      <input type={type || "text"} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} style={{ flex: 1, border: "none", outline: "none", fontSize: 14, padding: "9px 0", background: "transparent", color: "#1A1A18", minWidth: 0, width: "100%" }} />
      {suffix && <span style={{ color: "#999", fontSize: 11, flexShrink: 0 }}>{suffix}</span>}
    </div>
    {help && <p style={{ fontSize: 10, color: "#999", marginTop: 2, marginBottom: 0, lineHeight: 1.3 }}>{help}</p>}
  </div>;
}

function Tog({ opts, val, onChange }) { return <div style={{ display: "flex", background: "#F1EFE8", borderRadius: 8, padding: 2, marginBottom: 10 }}>{opts.map(o => <button key={o.v} onClick={() => onChange(o.v)} style={{ flex: 1, padding: "7px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: val === o.v ? 500 : 400, background: val === o.v ? "#fff" : "transparent", color: val === o.v ? T : "#888", boxShadow: val === o.v ? "0 1px 2px rgba(0,0,0,.06)" : "none" }}>{o.l}</button>)}</div>; }

function Btn({ onClick, disabled, children, full, secondary }) {
  return <button onClick={disabled ? undefined : onClick} style={{ background: secondary ? "transparent" : disabled ? "#ccc" : T, color: secondary ? "#5F5E5A" : "#fff", border: secondary ? "1.5px solid #D3D1C7" : "none", padding: "11px 20px", borderRadius: 10, fontSize: 13.5, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", width: full ? "100%" : "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{children}</button>;
}

function Dots({ c, t }) { return <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "8px 0 2px" }}>{Array.from({ length: t }, (_, i) => <div key={i} style={{ width: i === c ? 20 : 6, height: 6, borderRadius: 3, background: i === c ? T : i < c ? Tl : "#D3D1C7", transition: "all .25s" }} />)}</div>; }

function Pill({ on, onClick, children }) { return <button onClick={onClick} style={{ padding: "6px 11px", borderRadius: 14, fontSize: 11, cursor: "pointer", border: on ? "1.5px solid " + T : "1.5px solid #D3D1C7", background: on ? "rgba(10,107,92,.06)" : "#fff", color: on ? T : "#5F5E5A", fontWeight: on ? 500 : 400 }}>{on ? "\u2713 " : ""}{children}</button>; }

/* Expandable legal term tooltip */
function Whats({ children, tip }) {
  const [open, setOpen] = useState(false);
  return <span>
    {children} <button onClick={() => setOpen(!open)} style={{ background: "rgba(10,107,92,.08)", border: "none", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: T, cursor: "pointer", fontWeight: 500 }}>{open ? "\u2013" : "?"}</button>
    {open && <span style={{ display: "block", fontSize: 11, color: "#888", lineHeight: 1.45, marginTop: 3, padding: "6px 10px", background: "#FAFAF7", borderRadius: 7, border: "1px solid #F1EFE8" }}>{tip}</span>}
  </span>;
}

function BViz({ bars }) { const mx = Math.max(...bars.map(b => b.a), 1); const [g, setG] = useState(false); useEffect(() => { setTimeout(() => setG(true), 50); }, []); return <div>{bars.map((b, i) => <div key={i} style={{ marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}><span style={{ color: "#5F5E5A", fontWeight: 500 }}>{b.l}</span><span style={{ fontWeight: 600, color: b.tc || "#1A1A18" }}>{$(b.a)}</span></div><div style={{ background: "#F1EFE8", borderRadius: 5, height: 20, overflow: "hidden" }}><div style={{ width: g ? (b.a / mx * 100) + "%" : "0%", height: "100%", background: b.c, borderRadius: 5, transition: "width .6s cubic-bezier(.25,1,.5,1)", transitionDelay: (i * .06) + "s" }} /></div></div>)}</div>; }

function MC({ l, v, s, a, delay }) { return <Fade delay={delay || 0}><div style={{ background: a ? "rgba(10,107,92,.05)" : "#fff", borderRadius: 11, padding: "12px 13px", border: a ? "1.5px solid rgba(10,107,92,.2)" : "1px solid #E8E6E0" }}><p style={{ fontSize: 9, fontWeight: 600, color: a ? T : "#888", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</p><p style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 400, margin: "0 0 1px", color: a ? T : "#1A1A18" }}>{v}</p>{s && <p style={{ fontSize: 9, color: "#B4B2A9", margin: 0 }}>{s}</p>}</div></Fade>; }

const SL = { fontSize: 10, fontWeight: 600, color: "#5F5E5A", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".04em" };
const CD = { background: "#fff", borderRadius: 12, border: "1px solid #E8E6E0", padding: "15px", marginBottom: 11 };

/* Brand header for step pages */
function TopBar({ step, onBack }) {
  return <div>
    <div style={{ background: T, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Logo size={18} color="#fff" />
        <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>Parachute</span>
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>{step + " of " + TS}</span>
    </div>
    {/* Visible disclaimer banner */}
    <div style={{ background: "#FFF8E7", padding: "7px 20px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid #F0E6C8" }}>
      <span style={{ fontSize: 11, color: "#854F0B" }}>{"\u2696"}</span>
      <span style={{ fontSize: 10.5, color: "#854F0B" }}>For informational purposes only. This is not legal advice.</span>
    </div>
    <div style={{ padding: "8px 20px 0" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#888", padding: 0 }}>{"\u2190 Back"}</button>
    </div>
  </div>;
}

/* ═══════════════════ LOGO SVG ═══════════════════ */
function Logo({ size = 32, color = "#fff" }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 4C12 4 5.5 10 4.2 18c-.1.8.5 1.5 1.3 1.5h13V33c0 1.7-1.3 3-3 3s-3-1.3-3-3c0-.6-.4-1-1-1s-1 .4-1 1c0 2.8 2.2 5 5 5s5-2.2 5-5V19.5h13.5c.8 0 1.4-.7 1.3-1.5C34.5 10 28 4 20 4z" fill={color} fillOpacity=".9"/>
  </svg>;
}

/* ═══════════════════ LANDING ═══════════════════ */
function Landing({ onStart }) {
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [hov, setHov] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    setTimeout(() => setLoaded(true), 80);
  }, []);

  const DF = "'DM Serif Display', Georgia, serif";

  const features = [
    { k: "calc", t: "Legal minimums + court estimates", d: "Statutory floor and Bardal-factor range, explained in plain English", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
    { k: "letter", t: "Negotiation letter", d: "Five tone variants matched to your offer, from aggressive to strategic", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
    { k: "plan", t: "Action plan + checklists", d: "Timed steps from day one through your first lawyer meeting", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
    { k: "report", t: "Lawyer report", d: "Structured intake summary formatted for counsel. Save time and money.", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  ];

  return <div style={{ minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", overflow: "hidden" }}>
    {/* Multi-layer background */}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #032E27 0%, #064E3E 20%, #0A6B5C 40%, #0D7D6A 55%, #0A6B5C 70%, #073D34 100%)", zIndex: 0 }} />
    {/* Mesh overlay for depth */}
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 20%, rgba(16,180,140,.2) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(6,78,62,.6) 0%, transparent 50%), radial-gradient(ellipse at 50% 0%, rgba(159,225,203,.1) 0%, transparent 40%)", zIndex: 0 }} />
    {/* Noise grain texture */}
    <div style={{ position: "absolute", inset: 0, opacity: .035, zIndex: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px 128px" }} />
    {/* Animated ambient light */}
    <div style={{ position: "absolute", top: "-20%", right: "-5%", width: 550, height: 550, borderRadius: "50%", background: "radial-gradient(circle, rgba(159,225,203,.14) 0%, transparent 60%)", filter: "blur(60px)", animation: "float1 9s ease-in-out infinite", zIndex: 0 }} />
    <div style={{ position: "absolute", bottom: "-15%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(10,180,130,.1) 0%, transparent 60%)", filter: "blur(70px)", animation: "float2 11s ease-in-out infinite", zIndex: 0 }} />
    <div style={{ position: "absolute", top: "30%", left: "55%", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.04) 0%, transparent 60%)", filter: "blur(40px)", animation: "float3 7s ease-in-out infinite", zIndex: 0 }} />
    {/* Subtle top highlight */}
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, background: "linear-gradient(180deg, rgba(159,225,203,.06) 0%, transparent 100%)", zIndex: 0 }} />
    <style>{`
      @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-25px, 20px) scale(1.03); } }
      @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px, -25px) scale(1.05); } }
      @keyframes float3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-15px, -18px); } }
    `}</style>

    {/* Content */}
    <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 460, width: "100%" }}>

      {/* Logo */}
      <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(-12px)", transition: "all .6s cubic-bezier(.25,1,.5,1)", display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 36, padding: "8px 18px 8px 12px", borderRadius: 50, background: "rgba(255,255,255,.07)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.1)" }}>
        <Logo size={26} color="#fff" />
        <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: ".04em" }}>Parachute</span>
      </div>

      {/* Headline */}
      <h1 style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(16px)", transition: "all .8s cubic-bezier(.25,1,.5,1) .1s", fontFamily: DF, fontSize: "clamp(34px, 9vw, 52px)", fontWeight: 400, margin: "0 0 18px", lineHeight: 1.06, letterSpacing: "-0.005em" }}>
        Know what<br />you're owed.
      </h1>

      {/* Sub */}
      <p style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(12px)", transition: "all .7s cubic-bezier(.25,1,.5,1) .2s", fontSize: 15.5, color: "rgba(255,255,255,.7)", lineHeight: 1.65, maxWidth: 350, margin: "0 auto 40px", fontWeight: 400 }}>
        Free severance analysis built on Canadian employment law. In 2 minutes, not 2 billable hours.
      </p>

      {/* Stats */}
      <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(12px)", transition: "all .6s cubic-bezier(.25,1,.5,1) .3s", display: "flex", justifyContent: "center", gap: 0, marginBottom: 40 }}>
        {[{ n: "14", l: "Jurisdictions" }, { n: "2 min", l: "To complete" }, { n: "Free", l: "Always" }].map((s, i) => <div key={s.l} style={{ textAlign: "center", padding: "0 26px", borderRight: i < 2 ? "1px solid rgba(255,255,255,.15)" : "none" }}>
          <p style={{ fontSize: 24, fontWeight: 400, margin: "0 0 3px", fontFamily: DF }}>{s.n}</p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,.5)", margin: 0, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 500 }}>{s.l}</p>
        </div>)}
      </div>

      {/* Feature cards */}
      <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(16px)", transition: "all .7s cubic-bezier(.25,1,.5,1) .4s", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 36, textAlign: "left" }}>
        {features.map(f => <div
          key={f.k}
          onMouseEnter={() => setHov(f.k)}
          onMouseLeave={() => setHov(null)}
          style={{
            background: hov === f.k ? "rgba(255,255,255,.13)" : "rgba(255,255,255,.06)",
            borderRadius: 14,
            padding: "15px 16px",
            minHeight: 120,
            border: "1px solid " + (hov === f.k ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.08)"),
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            transform: hov === f.k ? "translateY(-2px)" : "translateY(0)",
            boxShadow: hov === f.k ? "0 10px 30px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.12)" : "0 2px 8px rgba(0,0,0,.06)",
            transition: "all .2s cubic-bezier(.25,1,.5,1)",
            cursor: "default",
          }}>
          <div style={{ color: hov === f.k ? "#fff" : "rgba(255,255,255,.55)", marginBottom: 8, transition: "color .2s" }}>{f.icon}</div>
          <p style={{ fontSize: 12.5, fontWeight: 600, margin: "0 0 4px", lineHeight: 1.3 }}>{f.t}</p>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", margin: 0, lineHeight: 1.4 }}>{f.d}</p>
        </div>)}
      </div>

      {/* CTA */}
      <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(12px)", transition: "all .7s cubic-bezier(.25,1,.5,1) .55s" }}>
        {!showTerms ? <button
          onMouseEnter={() => setHov("cta")}
          onMouseLeave={() => setHov(null)}
          onClick={() => setShowTerms(true)}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 14,
            border: "none",
            background: hov === "cta" ? "#fff" : "rgba(255,255,255,.95)",
            color: "#064E3E",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            transform: hov === "cta" ? "translateY(-1px)" : "translateY(0)",
            boxShadow: hov === "cta" ? "0 14px 36px rgba(0,0,0,.3), 0 4px 12px rgba(0,0,0,.15)" : "0 4px 16px rgba(0,0,0,.12)",
            transition: "all .2s cubic-bezier(.25,1,.5,1)",
            letterSpacing: ".01em",
          }}>Start your free analysis →</button>
        : <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 16, padding: "20px", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.1)" }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Terms of Use & Disclaimer</p>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", margin: "0 0 10px" }}>Please read carefully before proceeding.</p>
          <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "14px 15px", marginBottom: 14, maxHeight: 200, overflowY: "auto", border: "1px solid rgba(255,255,255,.06)" }}>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)", margin: 0, lineHeight: 1.65, whiteSpace: "pre-line" }}>{"1. NOT LEGAL ADVICE\nThis tool provides general information about severance and termination entitlements under Canadian federal, provincial, and territorial employment standards legislation and common law principles. It is provided strictly for educational and informational purposes. Nothing generated by this tool constitutes legal advice, a legal opinion, or a recommendation to pursue or refrain from pursuing any particular course of action. No solicitor-client, attorney-client, or other professional relationship is created by your use of this tool.\n\n2. NO WARRANTY; ACCURACY NOT GUARANTEED\nAll estimates, calculations, ranges, and outputs are provided on an \"as is\" and \"as available\" basis, without warranty of any kind, whether express, implied, statutory, or otherwise, including without limitation any warranty of merchantability, fitness for a particular purpose, accuracy, completeness, or non-infringement. The information presented may be inaccurate, incomplete, outdated, or inapplicable to your specific circumstances. Employment legislation, regulations, and case law are subject to change at any time, and this tool may not reflect the most current legal developments in any jurisdiction.\n\n3. LIMITATION OF LIABILITY\nTo the maximum extent permitted by applicable law, the creators, developers, operators, and affiliates of this tool shall not be liable for any direct, indirect, incidental, special, consequential, punitive, or exemplary damages of any kind, including without limitation damages for loss of income, loss of employment benefits, litigation costs, emotional distress, or any other losses arising out of or in connection with your use of or reliance on this tool or any information, content, materials, or outputs made available through it, whether based on contract, tort, negligence, strict liability, or any other legal theory, even if advised of the possibility of such damages.\n\n4. NO RELIANCE\nYou acknowledge and agree that you will not rely on this tool as a substitute for qualified legal counsel. The outputs, including but not limited to severance estimates, negotiation letters, lawyer reports, checklists, benefits guidance, and tax considerations, are templates and general references only. You are solely responsible for verifying all information independently and for retaining a qualified employment lawyer licensed in your jurisdiction before making any decisions regarding your employment, severance, or legal rights.\n\n5. TEMPLATE DOCUMENTS\nAny negotiation letters, demand letters, lawyer reports, or other documents generated by this tool are generic templates that have not been reviewed by a lawyer in connection with your individual circumstances. Sending, relying on, or acting upon these documents without independent legal review is done entirely at your own risk. The use of legal terminology, case law references, or statutory citations within these templates does not render them legal advice.\n\n6. JURISDICTIONAL LIMITATIONS\nCanadian employment law varies significantly across federal, provincial, and territorial jurisdictions. This tool attempts to address multiple jurisdictions but may not accurately capture all applicable legislation, regulations, collective agreement provisions, or case law developments in every jurisdiction. Users in Quebec should note that civil law principles apply, and common law reasonable notice analysis may not apply in the same manner.\n\n7. DATA & PRIVACY\nAll data you enter into this tool is processed entirely within your web browser. No personal information, employment data, or inputs of any kind are transmitted to, collected by, stored on, or accessible by any server, database, third party, or the operators of this tool. Nothing is logged, tracked, or retained.\n\n8. INDEMNIFICATION\nBy using this tool, you agree to indemnify, defend, and hold harmless the creators, developers, operators, and affiliates of this tool from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or in any way connected with your use of or reliance on this tool.\n\n9. GOVERNING LAW\nThese terms shall be governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles.\n\n10. ACCEPTANCE\nBy checking the box below and proceeding, you confirm that you have read, understood, and agree to be bound by all of the foregoing terms and conditions."}</p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 14 }}>
            <div onClick={() => setAgreed(!agreed)} style={{ width: 22, height: 22, borderRadius: 6, border: agreed ? "none" : "2px solid rgba(255,255,255,.3)", background: agreed ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all .15s", boxShadow: agreed ? "0 2px 8px rgba(0,0,0,.15)" : "none" }}>{agreed && <span style={{ color: T, fontSize: 13, fontWeight: 700 }}>{"\u2713"}</span>}</div>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.8)" }}>I have read and agree to these terms</span>
          </label>
          <button
            onMouseEnter={() => agreed && setHov("go")}
            onMouseLeave={() => setHov(null)}
            onClick={agreed ? onStart : undefined}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 10,
              border: "none",
              background: agreed ? (hov === "go" ? "#fff" : "rgba(255,255,255,.95)") : "rgba(255,255,255,.12)",
              color: agreed ? "#064E3E" : "rgba(255,255,255,.3)",
              fontSize: 14,
              fontWeight: 600,
              cursor: agreed ? "pointer" : "not-allowed",
              transform: hov === "go" ? "translateY(-1px)" : "translateY(0)",
              boxShadow: hov === "go" ? "0 8px 24px rgba(0,0,0,.25)" : "none",
              transition: "all .2s cubic-bezier(.25,1,.5,1)",
            }}>{"I understand \u2014 let\u2019s go \u2192"}</button>
        </div>}
        <p style={{ fontSize: 11, color: "rgba(255,255,255,.45)", textAlign: "center", marginTop: 18, lineHeight: 1.4 }}>Your data stays in your browser. Nothing is stored or sent anywhere.</p>
      </div>
    </div>
  </div>;
}

/* ═══════════════════ STEPS ═══════════════════ */
const TS = 5;

function S1({ d, setD }) {
  const provKeys = Object.entries(PROVS).filter(([c, p]) => !p.tr && c !== "FED");
  const terrKeys = Object.entries(PROVS).filter(([, p]) => p.tr);
  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 1 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>Where do you work?</h2>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Each province and territory has its own employment rules.</p></Fade>
    <Fade delay={10}><p style={{ fontSize: 9, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 6px" }}>Provinces</p></Fade>
    {provKeys.map(([c, p], i) => <Fade key={c} delay={20 + i * 10}><Sel on={d.province === c} onClick={() => setD({ ...d, province: c })}>{p.n}</Sel></Fade>)}
    <Fade delay={20 + provKeys.length * 10}><p style={{ fontSize: 9, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: ".06em", margin: "10px 0 6px" }}>Territories</p></Fade>
    {terrKeys.map(([c, p], i) => <Fade key={c} delay={30 + provKeys.length * 10 + i * 10}><Sel on={d.province === c} onClick={() => setD({ ...d, province: c })}>{p.n}</Sel></Fade>)}
    <Fade delay={30 + (provKeys.length + terrKeys.length) * 10}><p style={{ fontSize: 9, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: ".06em", margin: "10px 0 6px" }}>Federal</p></Fade>
    <Fade delay={40 + (provKeys.length + terrKeys.length) * 10}><Sel on={d.province === "FED"} onClick={() => setD({ ...d, province: "FED" })} sub="Airlines, banks, telecom, railways, and other federally regulated employers">Canada Labour Code</Sel></Fade>
  </div>;
}

function S2({ d, setD }) {
  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 2 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>Employment details</h2>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>We use these to estimate what you're owed.</p></Fade>
    <Fade delay={25}><Fld label="Age" type="number" value={d.age} onChange={v => setD({ ...d, age: v })} placeholder="e.g. 42" /></Fade>
    <Fade delay={40}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>How long you worked there</label><div style={{ display: "flex", gap: 7, marginBottom: 10 }}><div style={{ flex: 1, minWidth: 0 }}><Fld value={d.years} onChange={v => setD({ ...d, years: v })} type="number" placeholder="Years" suffix="yrs" /></div><div style={{ flex: 1, minWidth: 0 }}><Fld value={d.months} onChange={v => setD({ ...d, months: v })} type="number" placeholder="Months" suffix="mo" /></div></div></Fade>
    <Fade delay={55}><Fld label="Job title" value={d.jobTitle} onChange={v => setD({ ...d, jobTitle: v })} placeholder="e.g. Senior Marketing Manager" /></Fade>
    <Fade delay={70}><Fld label="Annual base salary" type="number" value={d.salary} onChange={v => setD({ ...d, salary: v })} prefix="$" placeholder="e.g. 95000" suffix="CAD" /></Fade>
    <Fade delay={85}><Fld label="Annual bonus / commission" type="number" value={d.bonus} onChange={v => setD({ ...d, bonus: v })} prefix="$" placeholder="0" suffix="CAD" help="Average annual variable pay. Enter 0 if none." /></Fade>
    <Fade delay={95}><Fld label="Unused vacation days" type="number" value={d.vacDays} onChange={v => setD({ ...d, vacDays: v })} placeholder="e.g. 10" suffix="days" help="Your employer must pay these out. This is separate from severance." /></Fade>
    <Fade delay={110}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Your level of responsibility</label><p style={{ fontSize: 10.5, color: "#999", marginTop: 0, marginBottom: 6, lineHeight: 1.35 }}>Based on authority, not salary. Courts care about how hard you are to replace.</p>{ROLES.map(r => <Sel key={r.id} on={d.role === r.id} onClick={() => setD({ ...d, role: r.id })} sub={r.d}>{r.l}</Sel>)}</Fade>
    <Fade delay={125}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Industry</label><div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>{INDS.map(i => <Pill key={i} on={d.industry === i} onClick={() => setD({ ...d, industry: i })}>{i}</Pill>)}</div></Fade>
    {d.province === "ON" && <Fade delay={140}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Ontario: extra severance pay eligibility</label><Sel on={d.sevElig === true} onClick={() => setD({ ...d, sevElig: true })}>Employer payroll $2.5M+ or 50+ severed</Sel><Sel on={d.sevElig === false} onClick={() => setD({ ...d, sevElig: false })}>Not eligible / unsure</Sel></Fade>}
  </div>;
}

function S3({ d, setD }) {
  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 3 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>Your circumstances</h2>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>These affect how much you may be owed.</p></Fade>

    <Fade delay={25}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Why were you let go?</label>{REASONS.map(r => <Sel key={r.id} on={d.reason === r.id} onClick={() => setD({ ...d, reason: r.id })} sub={r.i}>{r.l}</Sel>)}</Fade>
    {((parseFloat(d.years) || 0) + (parseFloat(d.months) || 0) / 12) < 3 && <Fade delay={50}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Did they recruit you away from a previous job?</label><p style={{ fontSize: 10.5, color: "#999", marginTop: 0, marginBottom: 5, lineHeight: 1.35 }}>Since you were there under 3 years, this matters. If they convinced you to leave a stable position and then let you go quickly, courts often award significantly more than your short tenure alone would suggest.</p><Sel on={d.induced === true} onClick={() => setD({ ...d, induced: true })}>Yes, I was recruited away</Sel><Sel on={d.induced === false} onClick={() => setD({ ...d, induced: false })}>No</Sel></Fade>}

    <Fade delay={75}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Your employment contract</label><p style={{ fontSize: 10.5, color: "#999", marginTop: 0, marginBottom: 5, lineHeight: 1.35 }}>Many contracts try to limit what you get. Courts throw them out more often than you'd expect.</p>
      <Sel on={d.hasContract === true} onClick={() => setD({ ...d, hasContract: true, contractTerms: false, contractAge: "" })}>I signed a written contract or offer letter</Sel>
      {d.hasContract === true && <div style={{ marginLeft: 24, borderLeft: "2px solid " + Tl, paddingLeft: 12, marginTop: 3, marginBottom: 6 }}>
        <p style={{ fontSize: 10.5, color: "#999", margin: "0 0 5px", lineHeight: 1.35 }}>Look for sections titled "Termination", "Notice", or "Severance" in your contract.</p>
        <Sel on={d.contractTerms === true} onClick={() => setD({ ...d, contractTerms: true })}>Yes, it mentions termination</Sel>
        {d.contractTerms === true && <div style={{ marginLeft: 20, borderLeft: "2px solid #E8E6E0", paddingLeft: 10, marginTop: 3, marginBottom: 6 }}>
          <p style={{ fontSize: 10.5, color: "#999", margin: "0 0 5px", lineHeight: 1.35 }}>When did you sign this contract?</p>
          <Sel on={d.contractAge === "recent"} onClick={() => setD({ ...d, contractAge: "recent" })}>In the last 3 years</Sel>
          <Sel on={d.contractAge === "old"} onClick={() => setD({ ...d, contractAge: "old" })}>More than 3 years ago</Sel>
          <Sel on={d.contractAge === "unsure"} onClick={() => setD({ ...d, contractAge: "unsure" })}>Not sure</Sel>
        </div>}
        <Sel on={d.contractTerms === false} onClick={() => setD({ ...d, contractTerms: false, contractAge: "" })}>No / can't tell</Sel>
      </div>}
      <Sel on={d.hasContract === false} onClick={() => setD({ ...d, hasContract: false, contractTerms: false, contractAge: "" })}>No written contract / not sure</Sel>
    </Fade>

    <Fade delay={100}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Was the termination handled badly?</label><p style={{ fontSize: 10.5, color: "#999", marginTop: 0, marginBottom: 5, lineHeight: 1.35 }}>Escorted out, humiliated, lied to, or announced to others before you were told. Courts can award extra damages.</p><Sel on={d.badFaith === true} onClick={() => setD({ ...d, badFaith: true })}>Yes</Sel><Sel on={d.badFaith === false} onClick={() => setD({ ...d, badFaith: false })}>No / reasonably handled</Sel></Fade>
    <Fade delay={120}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Have you signed a release?</label><p style={{ fontSize: 10.5, color: "#999", marginTop: 0, marginBottom: 5, lineHeight: 1.35 }}>A release is where you give up your right to sue in exchange for the severance. This is critical.</p><Sel on={d.signedRelease === true} onClick={() => setD({ ...d, signedRelease: true })} sub="May limit options, but can sometimes be undone">Already signed</Sel><Sel on={d.signedRelease === false} onClick={() => setD({ ...d, signedRelease: false })}>Not yet</Sel></Fade>
    <Fade delay={140}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Have you found new work?</label><Sel on={d.newJob === "yes"} onClick={() => setD({ ...d, newJob: "yes" })} sub="Reduces notice, but you're still owed the difference">Yes</Sel><Sel on={d.newJob === "looking"} onClick={() => setD({ ...d, newJob: "looking" })}>Actively looking</Sel><Sel on={d.newJob === "no"} onClick={() => setD({ ...d, newJob: "no" })}>Not yet</Sel></Fade>
    <Fade delay={155}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Non-compete or non-solicit clause?</label><Sel on={d.nonCompete === true} onClick={() => setD({ ...d, nonCompete: true })} sub="Many are unenforceable in Canada">Yes</Sel><Sel on={d.nonCompete === false} onClick={() => setD({ ...d, nonCompete: false })}>No / not sure</Sel></Fade>
    <Fade delay={170}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Benefits while employed</label><p style={{ fontSize: 10.5, color: "#999", marginTop: 0, marginBottom: 5, lineHeight: 1.35 }}>Select all that apply. We'll explain what happens to each one.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{BENS.map(b => { const on = (d.bens || []).includes(b.id); return <Pill key={b.id} on={on} onClick={() => { const c = d.bens || []; setD({ ...d, bens: on ? c.filter(x => x !== b.id) : [...c, b.id] }); }}>{b.l}</Pill>; })}</div></Fade>
  </div>;
}

function S4({ d, setD }) {
  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 4 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>Your offer</h2>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>If you have one, we'll compare it and draft a response.</p></Fade>
    <Fade delay={30}><Sel on={d.hasOffer === true} onClick={() => setD({ ...d, hasOffer: true })}>Yes, I have an offer</Sel><Sel on={d.hasOffer === false} onClick={() => setD({ ...d, hasOffer: false })}>No offer yet</Sel></Fade>
    {d.hasOffer === true && <Fade delay={60}><div style={{ marginTop: 6 }}><Tog opts={[{ v: "amt", l: "$ Amount" }, { v: "wks", l: "Weeks" }, { v: "mos", l: "Months" }]} val={d.offFmt} onChange={v => setD({ ...d, offFmt: v })} />
      {d.offFmt === "amt" && <Fld type="number" value={d.offAmt} onChange={v => setD({ ...d, offAmt: v })} prefix="$" placeholder="e.g. 45000" />}
      {d.offFmt === "wks" && <Fld type="number" value={d.offWks} onChange={v => setD({ ...d, offWks: v })} placeholder="e.g. 12" suffix="weeks" />}
      {d.offFmt === "mos" && <Fld type="number" value={d.offMos} onChange={v => setD({ ...d, offMos: v })} placeholder="e.g. 3" suffix="months" />}
      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#5F5E5A", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Deadline to accept?</label>
      <Sel on={d.deadline === true} onClick={() => setD({ ...d, deadline: true })}>Yes</Sel><Sel on={d.deadline === false} onClick={() => setD({ ...d, deadline: false, deadlineDays: "" })}>No</Sel>
      {d.deadline === true && <Fld label="Days remaining" type="number" value={d.deadlineDays} onChange={v => setD({ ...d, deadlineDays: v })} placeholder="e.g. 7" suffix="days" help="Under 7 days is a red flag." />}
    </div></Fade>}
    {d.hasOffer === false && <Fade delay={60}><div style={{ marginTop: 6, background: "rgba(186,117,23,.07)", borderRadius: 10, padding: "11px 14px", fontSize: 12, color: "#633806", lineHeight: 1.45 }}>We'll show you the full range so you're prepared.</div></Fade>}
  </div>;
}

/* ═══════════════════ EMAIL ═══════════════════ */
function buildEmail(r) {
  const title = r.jt || r.rl;
  const bens = (r.bens || []).length > 0 ? r.bens.map(id => (BENS.find(b => b.id === id) || {}).l || id).join(", ").toLowerCase() : null;
  const profile = title + " with " + r.yrs + " years of service" + (r.ind ? ", having been induced to leave secure employment" : "") + ", considering my age (" + r.age + "), seniority, total compensation of " + $(r.tc) + (r.bonus > 0 ? " (inclusive of variable pay)" : "") + ", and availability of comparable roles in the " + (r.industry || "") + " market";
  const waksdale = r.ci && r.ci.m < 1 && r.prov === "ON" ? "\nRegarding the termination provision in my contract: in light of Waksdale v. Swegon North America Inc., 2020 ONCA 391, its enforceability is in serious doubt. I proceed on common law entitlements.\n" : "";
  const dlNote = r.dl ? "\nThe " + ((parseInt(r.dlDays) || 0) <= 7 ? "extremely short" : (parseInt(r.dlDays) || 0) <= 14 ? "very limited" : "") + " deadline" + (r.dlDays ? " of " + r.dlDays + " days" : "") + " is inconsistent with the duty of good faith (Wallace; Honda Canada v. Keays). I expect it to be withdrawn.\n" : "";
  const bfNote = r.bf ? "\nThe manner of my dismissal fell below the standard of good faith and fair dealing (Wallace; Honda Canada v. Keays), which may give rise to additional damages.\n" : "";

  function demands(tgt, tgtA) {
    let d = "", n = 1;
    d += n + ". Lump-sum payment of " + tgt + " months' total compensation (" + $(tgtA) + "), less statutory deductions.\n"; n++;
    if (bens) { d += n + ". Benefits continuation (" + bens + ") for " + tgt + " months, or a lump-sum equivalent.\n"; n++; }
    if (r.bonus > 0) { d += n + ". Pro-rated bonus for the current year.\n"; n++; }
    if (r.vd > 0) { d += n + ". Vacation payout: " + r.vd + " days (" + $(r.vp) + ").\n"; n++; }
    d += n + ". Positive or neutral reference.\n";
    return d;
  }

  /* ── TIER 1: Below statutory minimum ── */
  if (r.off !== null && r.off < r.esaAmt) {
    let e = "Dear [Name],\n\nI write in response to the separation package presented on [date]. I have reviewed the terms carefully and obtained independent advice.\n\n";
    e += "I must be direct: the proposed " + $(r.off) + " falls below the statutory minimum under the " + r.esa + ". The legislated floor for my " + r.yrs + " years of service is " + r.totW + " weeks (" + $(r.esaAmt) + "). This amount is non-waivable. Any release executed on inadequate consideration is unenforceable, and presenting an offer below the statutory minimum raises serious concerns about the good faith of this process.\n\n";
    e += "I cannot execute a release on these terms, and I will not be negotiating against an offer that does not meet the legal floor.\n\n";
    e += "For context, as " + profile + ", the case law supports " + r.cL + " to " + r.cH + " months' notice, with a midpoint of " + r.cM + " months. The current offer of " + $(r.off) + " (" + r.offMo + " months) is " + $(r.cMA - r.off) + " below that midpoint.\n";
    e += bfNote + waksdale + dlNote;
    e += "\nI am prepared to resolve this matter without litigation, and trust the company shares that preference. To that end, I require:\n\n";
    e += demands(r.cH, r.cHA);
    e += "\nI expect a revised proposal within seven (7) business days. Absent a good-faith response, I will pursue all available legal channels without further notice.\n\nYours truly,\n[Your Name]\n\ncc: [Your Lawyer]";
    return { text: e, tone: "aggressive", label: "Below the legal minimum", desc: "This letter takes a firm, assertive tone. The offer does not meet the statutory floor, so the letter leads with that non-compliance and demands a significant correction. It opens high." };
  }

  /* ── TIER 2: Below court range ── */
  if (r.off !== null && r.off < r.cLA) {
    let e = "Dear [Name],\n\nI write in response to the separation package presented on [date]. I have reviewed the terms and obtained independent advice.\n\n";
    e += "I will be direct: the current proposal does not reflect my common law entitlements, and I cannot execute a release on these terms.\n\n";
    e += "The offer of " + $(r.off) + " (" + r.offMo + " months) falls well below what courts in " + r.pn + " routinely award in comparable circumstances. As " + profile + ", the case law supports " + r.cL + " to " + r.cH + " months' reasonable notice, with a midpoint of " + r.cM + " months (" + $(r.cMA) + "). The current offer is " + $(r.cMA - r.off) + " below that midpoint.\n";
    e += bfNote + waksdale + dlNote;
    e += "\nI am prepared to resolve this without litigation, and trust the company prefers to avoid the cost of proceedings. I require:\n\n";
    e += demands(r.cM, r.cMA);
    e += "\nI expect a response within ten (10) business days. Failing resolution, I will pursue all available legal channels.\n\nYours truly,\n[Your Name]\n\ncc: [Your Lawyer]";
    return { text: e, tone: "firm", label: "Below the court range", desc: "This letter is firm and direct. The offer falls short of what courts would award. It states the gap plainly and targets the midpoint." };
  }

  /* ── TIER 3: Below midpoint ── */
  if (r.off !== null && r.off < r.cMA) {
    let e = "Dear [Name],\n\nI write in response to the separation package presented on [date]. I have reviewed the terms and had the opportunity to obtain independent advice.\n\n";
    e += "After careful analysis, the proposal of " + $(r.off) + " (" + r.offMo + " months) falls below what I believe reflects the full scope of my entitlements.\n\n";
    e += "As " + profile + ", the case law supports " + r.cL + " to " + r.cH + " months' reasonable notice, with a midpoint of " + r.cM + " months (" + $(r.cMA) + "). The current offer sits " + $(r.cMA - r.off) + " below that midpoint.\n";
    e += bfNote + waksdale + dlNote;
    e += "\nI would like to resolve this constructively, and I am confident we can reach a fair outcome without the expense and disruption of litigation. I am seeking:\n\n";
    e += demands(r.cM, r.cMA);
    e += "\nI am available to discuss this at your convenience and would appreciate a response within ten (10) business days.\n\nYours truly,\n[Your Name]";
    return { text: e, tone: "measured", label: "In the range, but below midpoint", desc: "This letter is professional and measured. The offer is in the ballpark but falls short, and the letter makes a clear, reasoned case for more. It targets the midpoint without threatening litigation upfront." };
  }

  /* ── TIER 4: At or above midpoint ── */
  if (r.off !== null && r.off >= r.cMA) {
    const extras = [];
    if (bens) extras.push("continuation of benefits (" + bens + ") for the full notice period, or a lump-sum equivalent");
    if (r.bonus > 0) extras.push("a pro-rated bonus for the current year");
    if (r.vd > 0) extras.push("vacation payout of " + r.vd + " days (" + $(r.vp) + ")");
    extras.push("a positive or neutral reference");
    if (r.nc) extras.push("mutual release of any non-compete or non-solicitation obligations");
    let e = "Dear [Name],\n\nI write in response to the separation terms presented on [date]. I have reviewed the proposal and obtained independent advice.\n\n";
    e += "I am prepared to work toward a resolution, subject to the inclusion of several items that are important to me and that I would expect in a package of this nature.\n\n";
    e += "Specifically, I require the following:\n\n";
    extras.forEach((x, i) => { e += (i + 1) + ". " + x.charAt(0).toUpperCase() + x.slice(1) + ".\n"; });
    e += waksdale;
    if (r.dl) e += "\nI would also ask that the acceptance deadline be extended to allow adequate time to finalize these details.\n";
    e += "\nI would welcome the opportunity to discuss these points at your convenience. I am available to connect within the next week.\n\nYours truly,\n[Your Name]";
    return { text: e, tone: "strategic", label: "Solid offer", desc: "This letter takes a strategic tone. Rather than validating the number, it pivots directly to negotiating the extras: benefits, bonus, vacation, reference, and restrictive covenants. Never tell the other side their offer is good." };
  }

  /* ── TIER 5: No offer yet ── */
  let e = "Dear [Name],\n\nI write following our conversation on [date] regarding the end of my employment. I would like to address next steps.\n\n";
  e += "I have not yet received a formal separation proposal. Before one is presented, I want to share my perspective on what a fair package would look like, so that we can work toward a resolution efficiently.\n\n";
  e += "As " + profile + ", the case law in " + r.pn + " supports " + r.cL + " to " + r.cH + " months' reasonable notice. I would expect a proposal that reflects those factors.\n";
  e += bfNote + waksdale;
  e += "\nA proposal in the range of " + r.cM + " months' total compensation (" + $(r.cMA) + ") would allow us to resolve this promptly. I would also expect:\n\n";
  let n = 1;
  if (bens) { e += n + ". Benefits continuation (" + bens + ") for the notice period.\n"; n++; }
  if (r.bonus > 0) { e += n + ". Pro-rated bonus for the current year.\n"; n++; }
  if (r.vd > 0) { e += n + ". Vacation payout: " + r.vd + " days (" + $(r.vp) + ").\n"; n++; }
  e += n + ". Positive or neutral reference.\n";
  e += "\nI am hopeful we can reach an agreement without the need for formal proceedings. I would appreciate receiving a written proposal within ten (10) business days.\n\nYours truly,\n[Your Name]";
  return { text: e, tone: "preemptive", label: "No offer yet", desc: "This letter sets expectations before a number is on the table. It establishes your range early so the employer's first offer is anchored against your position, not the other way around." };
}

/* ═══════════════════ LAWYER REPORT ═══════════════════ */
function buildLawyerReport(r) {
  let rpt = "PRIVILEGED & CONFIDENTIAL\nPREPARED FOR COUNSEL\n" + "=".repeat(50) + "\n\n";
  rpt += "CLIENT INTAKE SUMMARY\nGenerated by Parachute Severance Analyzer\n\n";
  rpt += "1. CLIENT PROFILE\n";
  rpt += "   Name: [Client Name]\n";
  rpt += "   Age: " + r.age + "\n";
  rpt += "   Title: " + (r.jt || r.rl) + "\n";
  rpt += "   Employer: [Employer Name]\n";
  rpt += "   Industry: " + (r.industry || "Not specified") + "\n";
  rpt += "   Tenure: " + r.yrs + " years\n";
  rpt += "   Base salary: " + $(r.sal) + "\n";
  if (r.bonus > 0) rpt += "   Variable compensation: " + $(r.bonus) + "\n";
  rpt += "   Total compensation: " + $(r.tc) + "\n";
  rpt += "   Role level: " + r.rl + "\n";
  if (r.vd > 0) rpt += "   Accrued vacation: " + r.vd + " days (" + $(r.vp) + ")\n";
  rpt += "\n2. TERMINATION DETAILS\n";
  rpt += "   Jurisdiction: " + r.pn + " (" + r.esa + ")\n";
  rpt += "   Reason: " + (REASONS.find(x => x.id === r.reason) || {}).l + "\n";
  rpt += "   Inducement: " + (r.ind ? "Yes \u2014 client reports being recruited from prior position" : "No") + "\n";
  rpt += "   Bad faith in manner: " + (r.bf ? "Yes \u2014 client reports improper conduct in termination process" : "No / not reported") + "\n";
  rpt += "   Release signed: " + (r.sr ? "YES \u2014 ASSESS ENFORCEABILITY IMMEDIATELY" : "No") + "\n";
  rpt += "   New employment: " + (r.newJob === "yes" ? "Secured" : r.newJob === "looking" ? "Actively searching" : "Not yet") + "\n";
  rpt += "   Non-compete/non-solicit: " + (r.nc ? "Yes \u2014 review for enforceability" : "No / not reported") + "\n";
  rpt += "\n3. CONTRACT ANALYSIS\n";
  if (!r.hasContract || r.ci.m === 1) { rpt += "   No written termination clause identified.\n   Common law reasonable notice applies in full.\n"; }
  else { rpt += "   Written contract: Yes\n   Termination clause: Present\n   Age of contract: " + (r.contractAge || "Unknown") + "\n   Preliminary assessment: " + r.ci.note + "\n   ACTION: Review clause for Waksdale compliance and ESA floor issues.\n"; }
  rpt += "\n4. QUANTUM ASSESSMENT\n";
  rpt += "   Statutory minimum (ESA):\n";
  rpt += "     Termination pay: " + r.tw + " weeks (" + $(r.tw * r.wk) + ")\n";
  if (r.hs) rpt += "     Severance pay: " + r.sw + " weeks (" + $(r.sw * r.wk) + ")\n";
  rpt += "     Total statutory: " + r.totW + " weeks (" + $(r.esaAmt) + ")\n\n";
  rpt += "   Common law reasonable notice (Bardal factors):\n";
  rpt += "     Conservative: " + r.cL + " months (" + $(r.cLA) + ")\n";
  rpt += "     Midpoint:     " + r.cM + " months (" + $(r.cMA) + ")\n";
  rpt += "     Aggressive:   " + r.cH + " months (" + $(r.cHA) + ")\n\n";
  rpt += "   Factors applied:\n";
  rpt += "     Age modifier: " + (r.age >= 55 ? "High" : r.age >= 45 ? "Moderate-high" : r.age >= 35 ? "Moderate" : "Low") + "\n";
  rpt += "     Role modifier: " + r.rl + "\n";
  if (r.ind) rpt += "     Inducement uplift: +" + r.indPct + "%\n";
  if (r.bf) rpt += "     Bad faith uplift: +10%\n";
  if (r.ci.m < 1) rpt += "     Contract discount: " + Math.round((1 - r.ci.m) * 100) + "% (subject to enforceability review)\n";
  if (r.off !== null) {
    rpt += "\n5. OFFER ANALYSIS\n";
    rpt += "   Offer: " + $(r.off) + " (" + r.offMo + " months equivalent)\n";
    rpt += "   vs. statutory floor: " + (r.off >= r.esaAmt ? "ABOVE" : "BELOW \u2014 NON-COMPLIANT") + "\n";
    rpt += "   vs. CL midpoint: " + (r.off >= r.cMA ? "at or above" : $(r.cMA - r.off) + " below") + "\n";
    rpt += "   Assessment: " + (r.off < r.esaAmt ? "Below statutory minimum. Strong position." : r.off < r.cLA ? "Below common law range. Strong negotiation position." : r.off < r.cMA ? "Below midpoint. Room to negotiate." : "At or above midpoint.") + "\n";
  }
  rpt += "\n6. RECOMMENDED STRATEGY\n";
  if (r.sr) rpt += "   PRIORITY: Assess release enforceability. Consider: duress, independent legal advice, adequacy of consideration, compliance with ESA floor.\n";
  rpt += "   Target: " + r.cM + " months (" + $(r.cMA) + ")\n";
  rpt += "   Opening position: " + r.cH + " months (" + $(r.cHA) + ")\n";
  rpt += "   Floor (do not accept below): " + r.cL + " months (" + $(r.cLA) + ")\n";
  if ((r.bens || []).length > 0) rpt += "   Include: benefits continuation, pro-rated bonus, vacation payout, reference\n";
  if (r.dl) rpt += "   NOTE: Client reports a signing deadline" + (r.dlDays ? " of " + r.dlDays + " days" : "") + ". Consider requesting extension.\n";
  rpt += "\n7. DOCUMENTS TO REQUEST FROM CLIENT\n";
  rpt += "   \u2610 Employment contract (all versions)\n";
  rpt += "   \u2610 Termination letter\n";
  rpt += "   \u2610 Severance offer and any release\n";
  rpt += "   \u2610 Last 3 pay stubs\n";
  rpt += "   \u2610 T4 for last 2 years\n";
  rpt += "   \u2610 Benefits booklet\n";
  rpt += "   \u2610 Stock option/RSU plan documents\n";
  rpt += "   \u2610 Performance reviews (last 2 years)\n";
  rpt += "   \u2610 ROE (Record of Employment)\n";
  rpt += "   \u2610 Any correspondence re: termination\n";
  rpt += "   \u2610 Non-compete / non-solicitation agreements\n";
  rpt += "\n" + "=".repeat(50) + "\nDISCLAIMER: Generated by Parachute for informational purposes.\nNot a substitute for independent legal analysis.\n";
  return rpt;
}

/* ═══════════════════ WHAT-IF SLIDER ═══════════════════ */
function WhatIf({ res }) {
  const maxMo = Math.max(Math.ceil(res.cH) + 2, 6);
  const [val, setVal] = useState(res.cM);
  const amt = Math.round(val * res.mo);
  const pct = v => Math.min((v / maxMo) * 100, 100);
  const esaMo = res.totW / 4.33;
  const markers = [
    { v: esaMo, l: "Floor", c: "#D3D1C7" },
    { v: res.cL, l: "Low", c: Tl },
    { v: res.cM, l: "Mid", c: T },
    { v: res.cH, l: "High", c: Td },
  ];
  if (res.off !== null && res.offMo !== null) markers.push({ v: res.offMo, l: "Offer", c: res.off < res.cLA ? "#D85A30" : res.off < res.cMA ? "#BA7517" : T });
  return <div style={CD}>
    <p style={SL}>What-if explorer</p>
    <p style={{ fontSize: 11, color: "#666", margin: "0 0 12px", lineHeight: 1.4 }}>Drag the slider to explore different notice periods and see the dollar impact.</p>
    <div style={{ textAlign: "center", marginBottom: 10 }}>
      <span style={{ fontSize: 28, fontFamily: "Georgia,serif", fontWeight: 400, color: T }}>{$(amt)}</span>
      <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>{Math.round(val * 10) / 10} months</span>
    </div>
    <div style={{ position: "relative", padding: "0 2px", marginBottom: 28 }}>
      {/* Track background */}
      <div style={{ position: "absolute", top: 14, left: 0, right: 0, height: 6, borderRadius: 3, background: "#F1EFE8" }} />
      {/* Filled track */}
      <div style={{ position: "absolute", top: 14, left: 0, width: pct(val) + "%", height: 6, borderRadius: 3, background: "linear-gradient(90deg, " + Tl + ", " + T + ")", transition: "width .05s" }} />
      {/* Markers */}
      {markers.map((m, i) => <div key={i} style={{ position: "absolute", left: pct(m.v) + "%", top: 6, transform: "translateX(-50%)", zIndex: 1, pointerEvents: "none" }}>
        <div style={{ width: 2, height: 22, background: m.c, borderRadius: 1, margin: "0 auto" }} />
        <p style={{ fontSize: 8, color: m.c, margin: "2px 0 0", textAlign: "center", fontWeight: 600, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em" }}>{m.l}</p>
      </div>)}
      {/* Range input */}
      <input type="range" min={0} max={maxMo} step={0.1} value={val} onChange={e => setVal(parseFloat(e.target.value))}
        style={{ width: "100%", position: "relative", zIndex: 2, appearance: "none", WebkitAppearance: "none", background: "transparent", height: 34, cursor: "pointer", margin: 0 }} />
      <style>{`
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 11px; background: ${T}; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); cursor: grab; margin-top: -8px; }
        input[type=range]::-moz-range-thumb { width: 22px; height: 22px; border-radius: 11px; background: ${T}; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); cursor: grab; }
        input[type=range]::-webkit-slider-runnable-track { height: 6px; background: transparent; border-radius: 3px; }
        input[type=range]::-moz-range-track { height: 6px; background: transparent; border-radius: 3px; }
      `}</style>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#B4B2A9" }}>
      <span>0 mo</span><span>{maxMo} mo</span>
    </div>
    {val < esaMo && val > 0 && <p style={{ fontSize: 10.5, color: "#993C1D", margin: "8px 0 0", lineHeight: 1.4, fontWeight: 500 }}>Below the legal minimum. Your employer cannot offer less than {$(res.esaAmt)}.</p>}
    {val >= esaMo && val < res.cL && <p style={{ fontSize: 10.5, color: "#854F0B", margin: "8px 0 0", lineHeight: 1.4 }}>Above the statutory floor but below the typical court range. Room to negotiate.</p>}
    {val >= res.cL && val < res.cM && <p style={{ fontSize: 10.5, color: "#854F0B", margin: "8px 0 0", lineHeight: 1.4 }}>In the lower range of what courts award. Midpoint is {res.cM} months ({$(res.cMA)}).</p>}
    {val >= res.cM && val < res.cH && <p style={{ fontSize: 10.5, color: T, margin: "8px 0 0", lineHeight: 1.4 }}>At or above the midpoint. Strong territory.</p>}
    {val >= res.cH && <p style={{ fontSize: 10.5, color: T, margin: "8px 0 0", lineHeight: 1.4 }}>At or above the high end of the estimated range.</p>}
  </div>;
}

/* ═══════════════════ RESULTS ═══════════════════ */
function Res({ res, onReset }) {
  const [eml, setEml] = useState(false);
  const [lrpt, setLrpt] = useState(false);
  const [chk, setChk] = useState(false);
  const [ben, setBen] = useState(false);
  const [docs, setDocs] = useState(false);
  const [cp, setCp] = useState(null);
  const [printView, setPrintView] = useState(false);
  const bars = useMemo(() => {
    const it = [{ l: "Legal floor", a: res.esaAmt, c: "#D3D1C7", tc: "#5F5E5A" }, { l: "Court award (low)", a: res.cLA, c: Tl, tc: Td }, { l: "Court award (mid)", a: res.cMA, c: T, tc: T }, { l: "Court award (high)", a: res.cHA, c: Td, tc: Td }];
    if (res.off !== null) { const c = res.off < res.cLA ? "#D85A30" : res.off < res.cMA ? "#BA7517" : T; it.push({ l: "Your offer", a: res.off, c, tc: c }); }
    return it;
  }, [res]);
  const asmnt = useMemo(() => {
    if (res.off === null) return null;
    if (res.off < res.esaAmt) return { l: "Below the legal minimum", c: "#993C1D", bg: "rgba(216,90,48,.07)", d: "This offer is below what the law requires. Strong grounds to push back.", i: "!" };
    if (res.off < res.cLA) return { l: "Below what courts typically award", c: "#993C1D", bg: "rgba(216,90,48,.07)", d: "Above the legal minimum, but below what a court would likely give you. Significant room to negotiate.", i: "!" };
    if (res.off < res.cMA) return { l: "In the range, but below midpoint", c: "#854F0B", bg: "rgba(186,117,23,.07)", d: "You're in the ballpark, but there's room to do better.", i: "~" };
    if (res.off < res.cHA) return { l: "Solid offer", c: T, bg: "rgba(10,107,92,.05)", d: "In the upper range of what courts typically award.", i: "\u2713" };
    return { l: "Above typical range", c: T, bg: "rgba(10,107,92,.05)", d: "Meets or exceeds what courts would likely award.", i: "\u2713" };
  }, [res]);
  const email = useMemo(() => buildEmail(res), [res]);
  const lawyerRpt = useMemo(() => buildLawyerReport(res), [res]);
  const roi = useMemo(() => { const f = Math.max(3000, Math.round(res.cMA * .08)), u = res.off !== null ? res.cMA - res.off : Math.round(res.cMA * .4); return u - f > 0 ? { f, u, r: Math.round(u / f * 10) / 10 } : null; }, [res]);
  function copy(t, l) { try { navigator.clipboard.writeText(t); setCp(l); setTimeout(() => setCp(null), 2000); } catch (e) {} }
  const selBens = (res.bens || []).map(id => BENS.find(b => b.id === id)).filter(Boolean);

  if (printView) {
    const R = ({ k, v, accent, alert: al }) => <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12.5, borderBottom: "1px solid #F1EFE8" }}><span style={{ color: "#888" }}>{k}</span><span style={{ fontWeight: 500, color: al ? "#993C1D" : accent ? T : "#1A1A18", textAlign: "right", maxWidth: "60%" }}>{v}</span></div>;
    const Sec = ({ n, title, children }) => <div style={{ marginBottom: 20 }}><p style={{ fontSize: 11, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 8px", paddingBottom: 4, borderBottom: "2px solid " + Tl }}>{n}. {title}</p>{children}</div>;

    return <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px", fontFamily: "Georgia, serif", color: "#1A1A18", lineHeight: 1.6, fontSize: 13 }}>
      <button onClick={() => setPrintView(false)} style={{ background: T, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", marginBottom: 16 }}>{"\u2190"} Back to results</button>
      <p style={{ fontSize: 11, color: "#888", marginBottom: 20, background: "#FFF8E7", padding: "8px 12px", borderRadius: 6 }}>To save as PDF: press <strong>Ctrl+P</strong> (Windows) or <strong>Cmd+P</strong> (Mac) and select "Save as PDF" as the destination.</p>

      {/* Report header */}
      <div style={{ background: "#333", color: "#fff", padding: "20px 24px", borderRadius: 10, marginBottom: 24 }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 4px" }}>Privileged & confidential</p>
        <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 2px" }}>Client Intake Summary</p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)", margin: 0 }}>Prepared by Parachute Severance Analyzer</p>
      </div>

      <Sec n={1} title="Client profile">
        <R k="Age" v={res.age + ""} /><R k="Title" v={res.jt || res.rl} /><R k="Industry" v={res.industry || "Not specified"} />
        <R k="Tenure" v={res.yrs + " years"} /><R k="Base salary" v={$(res.sal)} />
        {res.bonus > 0 && <R k="Variable compensation" v={$(res.bonus)} />}
        <R k="Total compensation" v={$(res.tc)} accent />
        <R k="Role level" v={res.rl} />
        {res.vd > 0 && <R k="Accrued vacation" v={res.vd + " days (" + $(res.vp) + ")"} />}
      </Sec>

      <Sec n={2} title="Termination details">
        <R k="Jurisdiction" v={res.pn + " (" + res.esa + ")"} />
        <R k="Reason" v={(REASONS.find(x => x.id === res.reason) || {}).l || ""} />
        <R k="Inducement" v={res.ind ? "Yes \u2014 recruited from prior position" : "No"} />
        <R k="Bad faith in manner" v={res.bf ? "YES \u2014 improper conduct reported" : "Not reported"} alert={res.bf} />
        <R k="Release signed" v={res.sr ? "YES \u2014 ASSESS ENFORCEABILITY" : "No"} alert={res.sr} />
        <R k="New employment" v={res.newJob === "yes" ? "Secured" : res.newJob === "looking" ? "Searching" : "Not yet"} />
        <R k="Non-compete/non-solicit" v={res.nc ? "Yes \u2014 review enforceability" : "No"} />
      </Sec>

      <Sec n={3} title="Contract analysis">
        <p style={{ fontSize: 12, color: "#555", margin: "0 0 4px" }}>{res.ci.note}</p>
        {res.ci.m < 1 && <p style={{ fontSize: 12, color: "#993C1D", fontWeight: 600, margin: "4px 0 0" }}>ACTION: Review clause for Waksdale compliance and ESA floor issues.</p>}
      </Sec>

      <Sec n={4} title="Quantum assessment">
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", margin: "0 0 6px" }}>Statutory minimum</p>
        <R k="Termination pay" v={res.tw + " weeks (" + $(res.tw * res.wk) + ")"} />
        {res.hs && <R k="Severance pay" v={res.sw + " weeks (" + $(res.sw * res.wk) + ")"} />}
        <R k="Total statutory" v={res.totW + " weeks (" + $(res.esaAmt) + ")"} accent />
        <div style={{ height: 12 }} />
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", margin: "0 0 6px" }}>Common law reasonable notice (Bardal factors)</p>
        <R k="Conservative" v={res.cL + " months (" + $(res.cLA) + ")"} />
        <R k="Midpoint" v={res.cM + " months (" + $(res.cMA) + ")"} accent />
        <R k="Aggressive" v={res.cH + " months (" + $(res.cHA) + ")"} />
        <div style={{ height: 8 }} />
        <p style={{ fontSize: 11, color: "#555" }}>
          {"Modifiers: Age=" + (res.age >= 55 ? "High" : res.age >= 45 ? "Mod-high" : res.age >= 35 ? "Moderate" : "Low")}
          {res.ind && " | Inducement +" + res.indPct + "%"}{res.bf && " | Bad faith +10%"}{res.ci.m < 1 && " | Contract -" + Math.round((1 - res.ci.m) * 100) + "%"}
        </p>
      </Sec>

      {res.off !== null && <Sec n={5} title="Offer analysis">
        <R k="Offer" v={$(res.off) + " (" + res.offMo + " months)"} />
        <R k="vs. statutory floor" v={res.off >= res.esaAmt ? "ABOVE" : "BELOW"} alert={res.off < res.esaAmt} accent={res.off >= res.esaAmt} />
        <R k="vs. CL midpoint" v={res.off >= res.cMA ? "At or above" : $(res.cMA - res.off) + " below"} alert={res.off < res.cMA} accent={res.off >= res.cMA} />
      </Sec>}

      <Sec n={res.off !== null ? 6 : 5} title="Recommended strategy">
        {res.sr && <p style={{ fontSize: 12, color: "#993C1D", fontWeight: 600, margin: "0 0 8px" }}>PRIORITY: Assess release enforceability (duress, independent advice, adequacy, ESA floor)</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "8px 0 12px" }}>
          {[["Opening", res.cH, res.cHA], ["Target", res.cM, res.cMA], ["Floor", res.cL, res.cLA]].map(([label, mo, amt]) => (
            <div key={label} style={{ textAlign: "center", padding: "12px 8px", borderRadius: 8, border: label === "Target" ? "2px solid " + T : "1px solid #E8E6E0" }}>
              <p style={{ fontSize: 10, color: label === "Target" ? T : "#888", margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600 }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1px", color: label === "Target" ? T : "#1A1A18" }}>{mo} mo</p>
              <p style={{ fontSize: 11, color: "#B4B2A9", margin: 0 }}>{$(amt)}</p>
            </div>
          ))}
        </div>
        {(res.bens || []).length > 0 && <p style={{ fontSize: 12, color: "#555" }}>Include: benefits continuation, pro-rated bonus, vacation payout, reference</p>}
        {res.dl && <p style={{ fontSize: 12, color: "#993C1D" }}>NOTE: Signing deadline{res.dlDays ? " (" + res.dlDays + " days)" : ""} reported. Consider extension.</p>}
      </Sec>

      <Sec n={res.off !== null ? 7 : 6} title="Documents to request from client">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {["Employment contract (all versions)", "Termination letter", "Severance offer / release", "Last 3 pay stubs", "T4s (last 2 years)", "Benefits booklet", "Stock/RSU plan docs", "Performance reviews (last 2 years)", "Record of Employment", "Relevant correspondence", "Non-compete / non-solicit"].map(d => <div key={d} style={{ fontSize: 11, color: "#555", display: "flex", gap: 5 }}><span style={{ color: "#D3D1C7" }}>{"\u2610"}</span>{d}</div>)}
        </div>
      </Sec>

      <div style={{ borderTop: "1px solid #E8E6E0", paddingTop: 12, marginTop: 12 }}>
        <p style={{ fontSize: 10, color: "#888", margin: 0, lineHeight: 1.5 }}>Generated by Parachute Severance Analyzer. For informational purposes only. Not a substitute for independent legal analysis.</p>
      </div>
    </div>;
  }

  return <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 20px" }}>
    {/* Header */}
    <div style={{ background: T, margin: "-10px -20px 0", padding: "14px 20px 16px", borderRadius: "0 0 16px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}><Logo size={18} color="#fff" /><span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>Parachute</span></div>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px", color: "#fff" }}>Your analysis</h2>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,.6)", margin: 0 }}>{res.pn} {"\u2014"} {res.jt || res.rl}, age {res.age}, {res.yrs}y</p>
    </div>
    <div style={{ background: "#FFF8E7", padding: "6px 16px", marginBottom: 12, borderRadius: "0 0 8px 8px", display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 10, color: "#854F0B" }}>{"\u2696"}</span><span style={{ fontSize: 10, color: "#854F0B" }}>For informational purposes only. Not legal advice.</span></div>

    {res.sr && <Fade delay={20}><div style={{ background: "rgba(216,90,48,.08)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, fontSize: 12, color: "#712B13", lineHeight: 1.45 }}><strong>{"\u26A0"} You signed a release.</strong> Consult a lawyer urgently. Releases can sometimes be set aside.</div></Fade>}
    {asmnt && <Fade delay={35}><div style={{ background: asmnt.bg, borderRadius: 11, padding: "13px 15px", marginBottom: 10, display: "flex", gap: 10 }}><div style={{ width: 30, height: 30, borderRadius: 7, background: asmnt.c, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 14, fontWeight: 700 }}>{asmnt.i}</div><div><p style={{ fontSize: 12.5, fontWeight: 600, color: asmnt.c, margin: "0 0 2px" }}>{asmnt.l}</p><p style={{ fontSize: 11.5, color: "#444", margin: 0, lineHeight: 1.4 }}>{asmnt.d}</p></div></div></Fade>}

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
      <MC l={"Legal floor"} v={$(res.esaAmt)} s={<Whats tip="Every province sets a bare minimum your employer must pay. This is the absolute floor \u2014 your employer cannot legally offer less than this.">{res.totW + " weeks (statutory minimum)"}</Whats>} delay={55} />
      <MC l={"What a court would likely award"} v={$(res.cMA)} s={<Whats tip="When courts decide severance cases, they consider your age, how long you worked there, your role, and how easy it is to find a similar job. This is called 'common law reasonable notice'. It's almost always higher than the statutory minimum.">{res.cM + " months (common law mid)"}</Whats>} a delay={70} />
      <MC l="Court award range" v={res.cL + "\u2013" + res.cH + " mo"} s={$(res.cLA) + "\u2013" + $(res.cHA)} delay={85} />
      {res.off !== null ? <MC l="Your offer" v={$(res.off)} s={res.offMo + " mo equiv."} delay={100} /> : <MC l="Monthly comp" v={$(res.mo)} delay={100} />}
    </div>

    <Fade delay={115}><div style={CD}><p style={SL}>Comparison</p><BViz bars={bars} /></div></Fade>

    {/* WHAT-IF SLIDER */}
    <Fade delay={120}><WhatIf res={res} /></Fade>

    {/* TERRITORY NOTE */}
    {res.tr && <Fade delay={122}><div style={{ background: "rgba(186,117,23,.07)", borderRadius: 10, padding: "11px 14px", marginBottom: 10, fontSize: 11, color: "#633806", lineHeight: 1.45 }}>Territorial case law on reasonable notice is limited compared to provincial jurisdictions. Courts in the territories generally apply Bardal factors, but with fewer local precedents to draw from. An employment lawyer familiar with your territory can give you the sharpest estimate.</div></Fade>}

    {/* NEGOTIATION EMAIL */}
    <Fade delay={130}><div style={{ ...CD, border: "1.5px solid " + T, background: "rgba(10,107,92,.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><p style={{ ...SL, color: T, margin: 0 }}>{"\u2709"} Negotiation letter</p><button onClick={() => setEml(!eml)} style={{ background: "rgba(10,107,92,.08)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: T, fontWeight: 500, cursor: "pointer" }}>{eml ? "Hide \u25B2" : "View \u25BC"}</button></div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: email.tone === "aggressive" ? "#993C1D" : email.tone === "firm" ? "#854F0B" : email.tone === "strategic" ? T : "#5F5E5A", textTransform: "uppercase", letterSpacing: ".04em", padding: "3px 7px", borderRadius: 4, background: email.tone === "aggressive" ? "rgba(153,60,29,.08)" : email.tone === "firm" ? "rgba(133,79,11,.08)" : email.tone === "strategic" ? "rgba(10,107,92,.06)" : "#F1EFE8" }}>{email.label}</span>
      </div>
      <p style={{ fontSize: 11, color: "#666", margin: 0, lineHeight: 1.4 }}>{email.desc}</p>
      <div style={{ background: "#FFF8E7", borderRadius: 7, padding: "8px 11px", marginTop: 6, marginBottom: eml ? 0 : 0 }}>
        <p style={{ fontSize: 10.5, color: "#854F0B", margin: 0, lineHeight: 1.45 }}><strong>Important:</strong> If you plan to hire a lawyer, share this analysis with them and let them handle the communication. A lawyer will position your case more strategically than a self-sent letter. If you are negotiating on your own, this gives you a strong starting point, but understand that once you put a number on the table, that becomes your anchor.</p>
      </div>
      {eml && <div style={{ marginTop: 8 }}><pre style={{ background: "#FAFAF7", borderRadius: 7, padding: "12px 14px", fontSize: 11, lineHeight: 1.5, color: "#333", whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid #E8E6E0", fontFamily: "Georgia,serif", margin: "0 0 7px" }}>{email.text}</pre><button onClick={() => copy(email.text, "e")} style={{ background: T, color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer", width: "100%" }}>{cp === "e" ? "\u2713 Copied" : "Copy to clipboard"}</button></div>}
    </div></Fade>

    {/* LAWYER REPORT */}
    <Fade delay={145}><div style={{ ...CD, border: "1.5px solid #444", background: "rgba(0,0,0,.01)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><p style={{ ...SL, color: "#333", margin: 0 }}>{"\uD83D\uDCCB"} Report for your lawyer</p><button onClick={() => setLrpt(!lrpt)} style={{ background: "rgba(0,0,0,.06)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#444", fontWeight: 500, cursor: "pointer" }}>{lrpt ? "Hide \u25B2" : "View \u25BC"}</button></div>
      <p style={{ fontSize: 11, color: "#666", margin: 0, lineHeight: 1.4 }}>A structured intake summary formatted for your employment lawyer. Send this ahead of your first meeting to save time and money.</p>
      {lrpt && <div style={{ marginTop: 8 }}>
        <div style={{ background: "#FAFAF7", borderRadius: 8, border: "1px solid #E8E6E0", overflow: "hidden", marginBottom: 7 }}>
          {/* Header */}
          <div style={{ background: "#333", padding: "12px 14px", color: "#fff" }}>
            <p style={{ fontSize: 9, fontWeight: 600, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".06em", color: "rgba(255,255,255,.5)" }}>Privileged & confidential</p>
            <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 1px" }}>Client intake summary</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,.5)", margin: 0 }}>Prepared by Parachute Severance Analyzer</p>
          </div>

          {/* Sections */}
          {[
            { title: "1. Client profile", rows: [
              ["Age", res.age + ""], ["Title", res.jt || res.rl], ["Industry", res.industry || "Not specified"],
              ["Tenure", res.yrs + " years"], ["Base salary", $(res.sal)],
              ...(res.bonus > 0 ? [["Variable comp", $(res.bonus)]] : []),
              ["Total compensation", $(res.tc)], ["Role level", res.rl],
              ...(res.vd > 0 ? [["Accrued vacation", res.vd + " days (" + $(res.vp) + ")"]] : []),
            ]},
            { title: "2. Termination details", rows: [
              ["Jurisdiction", res.pn + " (" + res.esa + ")"],
              ["Reason", (REASONS.find(x => x.id === res.reason) || {}).l || ""],
              ["Inducement", res.ind ? "Yes \u2014 recruited from prior position" : "No"],
              ["Bad faith", res.bf ? "Yes \u2014 improper conduct reported" : "Not reported"],
              ["Release signed", res.sr ? "YES \u2014 ASSESS ENFORCEABILITY" : "No"],
              ["New employment", res.newJob === "yes" ? "Secured" : res.newJob === "looking" ? "Searching" : "Not yet"],
              ["Non-compete", res.nc ? "Yes \u2014 review enforceability" : "No"],
            ]},
            { title: "3. Contract analysis", rows: [
              ["Written contract", res.hasContract ? "Yes" : "No"],
              ...(res.ci.m < 1 ? [["Termination clause", "Present"], ["Preliminary assessment", res.ci.note]] : [["Termination clause", "None identified"], ["Impact", "Common law notice applies in full"]]),
              ...(res.ci.m < 1 ? [["ACTION", "Review clause for Waksdale compliance"]] : []),
            ]},
          ].map(section => (
            <div key={section.title} style={{ padding: "12px 14px", borderBottom: "1px solid #E8E6E0" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>{section.title}</p>
              {section.rows.map(([k, v], i) => (
                <div key={k + i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, gap: 8 }}>
                  <span style={{ color: "#888" }}>{k}</span>
                  <span style={{ fontWeight: v.includes("YES") || v.includes("ACTION") ? 600 : 400, color: v.includes("YES") || v.includes("ACTION") ? "#993C1D" : "#333", textAlign: "right", maxWidth: "65%" }}>{v}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Quantum */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #E8E6E0" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>4. Quantum assessment</p>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#888", margin: "0 0 4px" }}>Statutory minimum</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "#888" }}>Termination pay</span><span>{res.tw} weeks ({$(res.tw * res.wk)})</span></div>
            {res.hs && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "#888" }}>Severance pay</span><span>{res.sw} weeks ({$(res.sw * res.wk)})</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0", fontWeight: 500 }}><span style={{ color: T }}>Total statutory</span><span style={{ color: T }}>{res.totW} weeks ({$(res.esaAmt)})</span></div>
            <div style={{ height: 1, background: "#E8E6E0", margin: "8px 0" }} />
            <p style={{ fontSize: 10, fontWeight: 600, color: "#888", margin: "0 0 4px" }}>Common law (Bardal factors)</p>
            {[["Conservative", res.cL, res.cLA], ["Midpoint", res.cM, res.cMA], ["Aggressive", res.cH, res.cHA]].map(([label, mo, amt]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "#888" }}>{label}</span><span style={{ fontWeight: label === "Midpoint" ? 500 : 400 }}>{mo} months ({$(amt)})</span></div>
            ))}
            <div style={{ height: 1, background: "#E8E6E0", margin: "8px 0" }} />
            <p style={{ fontSize: 10, fontWeight: 600, color: "#888", margin: "0 0 4px" }}>Modifiers applied</p>
            <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>
              {"Age: " + (res.age >= 55 ? "High" : res.age >= 45 ? "Moderate-high" : res.age >= 35 ? "Moderate" : "Low")}
              {res.ind && " | Inducement: +" + res.indPct + "%"}{res.bf && " | Bad faith: +10%"}{res.ci.m < 1 && " | Contract: -" + Math.round((1 - res.ci.m) * 100) + "% (pending review)"}
            </div>
          </div>

          {/* Offer */}
          {res.off !== null && <div style={{ padding: "12px 14px", borderBottom: "1px solid #E8E6E0" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>5. Offer analysis</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "#888" }}>Offer</span><span>{$(res.off)} ({res.offMo} months)</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "#888" }}>vs. statutory floor</span><span style={{ color: res.off >= res.esaAmt ? T : "#993C1D", fontWeight: 500 }}>{res.off >= res.esaAmt ? "ABOVE" : "BELOW"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "#888" }}>vs. CL midpoint</span><span style={{ color: res.off >= res.cMA ? T : "#993C1D" }}>{res.off >= res.cMA ? "At or above" : $(res.cMA - res.off) + " below"}</span></div>
          </div>}

          {/* Strategy */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #E8E6E0" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>{res.off !== null ? "6" : "5"}. Recommended strategy</p>
            {res.sr && <p style={{ fontSize: 11, color: "#993C1D", fontWeight: 500, margin: "0 0 4px" }}>PRIORITY: Assess release enforceability (duress, independent advice, adequacy, ESA floor)</p>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
              {[["Opening", res.cH + " mo", $(res.cHA)], ["Target", res.cM + " mo", $(res.cMA)], ["Floor", res.cL + " mo", $(res.cLA)]].map(([label, mo, amt]) => (
                <div key={label} style={{ textAlign: "center", padding: "7px 4px", borderRadius: 6, background: label === "Target" ? "rgba(10,107,92,.06)" : "#fff", border: "1px solid #E8E6E0" }}>
                  <p style={{ fontSize: 9, color: label === "Target" ? T : "#888", margin: "0 0 1px", textTransform: "uppercase" }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 0px", color: label === "Target" ? T : "#333" }}>{mo}</p>
                  <p style={{ fontSize: 9, color: "#B4B2A9", margin: 0 }}>{amt}</p>
                </div>
              ))}
            </div>
            {(res.bens || []).length > 0 && <p style={{ fontSize: 10.5, color: "#555", margin: "0 0 3px" }}>Include: benefits continuation, pro-rated bonus, vacation payout, reference</p>}
            {res.dl && <p style={{ fontSize: 10.5, color: "#993C1D", margin: "3px 0 0" }}>NOTE: Signing deadline reported{res.dlDays ? " (" + res.dlDays + " days)" : ""}. Consider extension request.</p>}
          </div>

          {/* Documents */}
          <div style={{ padding: "12px 14px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>{res.off !== null ? "7" : "6"}. Documents to request</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
              {["Employment contract", "Termination letter", "Severance offer / release", "Last 3 pay stubs", "T4s (last 2 years)", "Benefits booklet", "Stock/RSU plan docs", "Performance reviews", "ROE", "Relevant correspondence", "Non-compete agreements"].map(d => (
                <div key={d} style={{ fontSize: 10, color: "#555", display: "flex", gap: 4, alignItems: "baseline" }}><span style={{ color: "#D3D1C7" }}>{"\u2610"}</span>{d}</div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => copy(lawyerRpt, "lr")} style={{ flex: 1, background: "#333", color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{cp === "lr" ? "\u2713 Copied" : "Copy as text"}</button>
          <button onClick={() => { setPrintView(true); window.scrollTo(0, 0); }} style={{ flex: 1, background: T, color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>View printable report</button>
        </div>
      </div>}
    </div></Fade>

    {/* STATUTORY */}
    <Fade delay={160}><div style={CD}>
      <p style={SL}><Whats tip="Every province has legislation that sets a minimum amount your employer must pay when they let you go. Think of it as the legal floor. They cannot offer you less. But courts usually award much more, which is why the 'court award' number above is typically more important.">The legal floor (statutory minimum)</Whats></p>
      {[{ k: res.esa, v: "", x: "The law that applies in " + res.pn },
        { k: "Termination pay", v: res.tw + "wk (" + $(res.tw * res.wk) + ")", x: "Minimum notice your employer must give based on " + res.yrs + " years" },
        res.hs ? { k: "Severance pay", v: res.sw + "wk (" + $(res.sw * res.wk) + ")", x: "Additional payment on top of termination pay" } : null,
        { k: "Total floor", v: res.totW + "wk (" + $(res.esaAmt) + ")", x: "Anything below this is illegal", a: true },
        res.vd > 0 ? { k: "Vacation payout", v: res.vd + "d (" + $(res.vp) + ")", x: "Owed separately. This is wages you already earned." } : null,
      ].filter(Boolean).map((row, i, arr) => <div key={row.k} style={{ padding: "5px 0", borderBottom: i < arr.length - 1 ? "1px solid #F1EFE8" : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 6 }}><span style={{ color: "#5F5E5A" }}>{row.k}</span><span style={{ fontWeight: 500, color: row.a ? T : "#1A1A18", fontSize: 11 }}>{row.v}</span></div>
        <p style={{ fontSize: 10, color: "#999", margin: "1px 0 0", lineHeight: 1.3 }}>{row.x}</p>
      </div>)}
      {res.sn && <p style={{ fontSize: 10, color: "#888", margin: "7px 0 0", fontStyle: "italic", lineHeight: 1.4, background: "#FAFAF7", borderRadius: 6, padding: "7px 10px" }}>{res.sn}</p>}
    </div></Fade>

    {/* BENEFITS */}
    {selBens.length > 0 && <Fade delay={175}><div style={{ ...CD, cursor: "pointer" }} onClick={() => setBen(!ben)}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p style={{ ...SL, margin: 0 }}>What happens to your benefits</p><span style={{ fontSize: 10, color: "#888" }}>{ben ? "\u25B2" : "\u25BC"}</span></div>{ben && <div style={{ marginTop: 8 }}>{selBens.map(b => <div key={b.id} style={{ padding: "8px 10px", borderRadius: 7, background: "#FAFAF7", marginBottom: 5 }}><p style={{ fontSize: 11, fontWeight: 600, color: "#444", margin: "0 0 2px" }}>{b.l}</p><p style={{ fontSize: 10, color: "#888", margin: 0, lineHeight: 1.45 }}>{b.t}</p></div>)}</div>}</div></Fade>}

    {/* LAWYER ROI */}
    {roi && <Fade delay={190}><div style={CD}><p style={SL}>Is hiring a lawyer worth it?</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 5 }}>{[{ l: "Est. fee", v: $(roi.f) }, { l: "Potential uplift", v: $(roi.u), c: T }, { l: "ROI", v: roi.r + "x", c: T }].map(x => <div key={x.l} style={{ textAlign: "center", padding: "8px 3px", borderRadius: 7, background: "#FAFAF7" }}><p style={{ fontSize: 8, color: x.c || "#888", margin: "0 0 1px", textTransform: "uppercase" }}>{x.l}</p><p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: x.c || "#1A1A18" }}>{x.v}</p></div>)}</div><p style={{ fontSize: 10, color: "#999", margin: 0, lineHeight: 1.35 }}>Most offer free initial consultations.</p></div></Fade>}

    {/* DOCUMENT CHECKLIST */}
    <Fade delay={205}><div style={{ ...CD, cursor: "pointer" }} onClick={() => setDocs(!docs)}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p style={{ ...SL, margin: 0 }}>Bring to your first lawyer meeting</p><span style={{ fontSize: 10, color: "#888" }}>{docs ? "\u25B2" : "\u25BC"}</span></div>{docs && <div style={{ marginTop: 8 }}>{["Employment contract (all versions and amendments)", "Termination letter", "Severance offer and any release document", "Last 3 pay stubs", "T4 slips for the last 2 years", "Benefits booklet or summary", "Stock option / RSU plan documents", "Performance reviews (last 2 years)", "Record of Employment (ROE) if received", "Any emails or messages about the termination", "Non-compete / non-solicitation agreements"].map((d, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3, fontSize: 11, color: "#444", lineHeight: 1.35 }}><span style={{ color: "#D3D1C7", flexShrink: 0 }}>{"\u2610"}</span><span>{d}</span></div>)}</div>}</div></Fade>

    {/* ACTION PLAN */}
    <Fade delay={220}><div style={{ ...CD, cursor: "pointer" }} onClick={() => setChk(!chk)}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p style={{ ...SL, margin: 0 }}>{"\u2611"} Post-termination action plan</p><span style={{ fontSize: 10, color: "#888" }}>{chk ? "\u25B2" : "\u25BC"}</span></div>{chk && <div style={{ marginTop: 8 }}>
      {[{ t: "Immediately", i: ["Do NOT sign any release until reviewed", "Request copies of contract, amendments, termination letter", "Save relevant documents and emails from work accounts"] },
        { t: "Within 1 week", i: ["Apply for EI through Service Canada \u2014 even with a lump sum (lump sums don't delay EI; salary continuation does, but apply now because processing takes weeks)", "Contact benefit insurers about 30-day conversion options", "Check stock option/RSU deadlines \u2014 these can lapse in 30-90 days"] },
        { t: "Within 2 weeks", i: ["Consult an employment lawyer (most offer free consultations)", "Review pension/RRSP contributions", "Start documenting your job search \u2014 courts expect mitigation"] },
        { t: "Within 30 days", i: ["Respond to offer or have lawyer respond", "Convert group insurance to individual if needed", "Review restrictive covenants for enforceability"] },
      ].map(s => <div key={s.t} style={{ marginBottom: 8 }}><p style={{ fontSize: 11, fontWeight: 600, color: T, margin: "0 0 3px" }}>{s.t}</p>{s.i.map((it, j) => <div key={j} style={{ display: "flex", gap: 5, marginBottom: 2, fontSize: 10.5, color: "#444", lineHeight: 1.35 }}><span style={{ color: "#D3D1C7", flexShrink: 0 }}>{"\u2610"}</span><span>{it}</span></div>)}</div>)}
    </div>}</div></Fade>

    {/* TAX */}
    <Fade delay={235}><div style={CD}><p style={SL}>Tax considerations</p><p style={{ fontSize: 11, color: "#555", margin: 0, lineHeight: 1.45 }}>Lump-sum payments are taxed as employment income, potentially pushing you into a higher bracket. Salary continuation may lower your effective tax. Pre-1996 service retiring allowances may qualify for RRSP transfer. Ask your accountant about the optimal structure.</p></div></Fade>

    {/* DISCLAIMER */}
    <Fade delay={250}><div style={{ background: "#FFF8E7", borderRadius: 11, padding: "13px 15px", marginBottom: 10, border: "1px solid #F0E6C8" }}>
      <p style={{ fontSize: 10.5, fontWeight: 600, color: "#854F0B", margin: "0 0 3px" }}>{"\u2696"} Important legal disclaimer</p>
      <p style={{ fontSize: 9.5, color: "#854F0B", margin: 0, lineHeight: 1.55, opacity: .85 }}>This analysis is for informational purposes only. It does not constitute legal advice, a legal opinion, or a recommendation, and does not create a solicitor-client relationship. All estimates, calculations, letters, and reports are provided "as is" without warranty of any kind. Information may be inaccurate, incomplete, or not current. You accepted the full Terms of Use before using this tool. Consult a qualified employment lawyer licensed in your jurisdiction before making any decisions.</p>
    </div></Fade>

    <Fade delay={265}><div style={{ display: "flex", gap: 7, marginBottom: 32 }}>
      <Btn secondary onClick={onReset} full>Start over</Btn>
      <Btn onClick={() => {
        let sm = "MY SEVERANCE ANALYSIS (from Parachute)\n\n";
        sm += "I worked as " + (res.jt || res.rl) + " in " + res.pn + " for " + res.yrs + " years.\n";
        sm += "My total annual compensation was " + $(res.tc) + ".\n\n";
        sm += "THE KEY NUMBERS:\n\n";
        sm += "\u2022 The legal minimum my employer MUST pay: " + $(res.esaAmt) + " (" + res.totW + " weeks). This is the floor set by law \u2014 anything below this is illegal.\n\n";
        sm += "\u2022 What a court would likely award: between " + $(res.cLA) + " and " + $(res.cHA) + " (" + res.cL + " to " + res.cH + " months), with a midpoint of " + $(res.cMA) + " (" + res.cM + " months). This is based on my age (" + res.age + "), tenure, role level, and how hard it is to find a similar job.\n\n";
        if (res.off !== null) {
          sm += "\u2022 My employer offered me: " + $(res.off) + " (" + res.offMo + " months). ";
          if (res.off < res.esaAmt) sm += "This is BELOW THE LEGAL MINIMUM. I have strong grounds to push back.\n\n";
          else if (res.off < res.cLA) sm += "This is above the legal minimum but below what courts typically award. There is significant room to negotiate.\n\n";
          else if (res.off < res.cMA) sm += "This is in the range but below the midpoint. There may be room for improvement.\n\n";
          else sm += "This is a solid offer, at or above the midpoint of what courts typically award.\n\n";
        }
        if (res.vd > 0) sm += "\u2022 My employer also owes me " + $(res.vp) + " for " + res.vd + " unused vacation days. This is separate from severance.\n\n";
        sm += "NEXT STEPS:\n";
        sm += "1. Do NOT sign a release until I have reviewed everything\n";
        sm += "2. Consider consulting an employment lawyer (most offer free initial consultations)\n";
        sm += "3. Apply for EI through Service Canada\n\n";
        sm += "This was generated by Parachute (parachute.ca) for informational purposes only. It is not legal advice.";
        copy(sm, "s");
      }} full>{cp === "s" ? "\u2713 Copied!" : "Copy summary"}</Btn>
    </div></Fade>
  </div>;
}

/* ═══════════════════ APP ═══════════════════ */
export default function App() {
  const [step, setStep] = useState(-1);
  const [d, setD] = useState({
    province: "", age: "", years: "", months: "", salary: "", bonus: "", role: "", jobTitle: "",
    sevElig: false, hasOffer: null, offFmt: "amt", offAmt: "", offWks: "", offMos: "",
    reason: "", induced: null, hasContract: null, contractTerms: false, contractAge: "",
    bens: [], industry: "", vacDays: "",
    signedRelease: null, deadline: null, deadlineDays: "", hasDependents: null,
    badFaith: null, newJob: "", nonCompete: null,
  });
  const [res, setRes] = useState(null);
  const [fade, setFade] = useState(false);

  function go(s) { setFade(true); setTimeout(() => { if (s === 5) setRes(calc(d)); setStep(s); window.scrollTo(0, 0); setTimeout(() => setFade(false), 25); }, 150); }

  const tenure = (parseFloat(d.years) || 0) + (parseFloat(d.months) || 0) / 12;
  const ok = step <= 0 ? true : step === 1 ? !!d.province : step === 2 ? !!(d.age && (d.years || d.months) && d.salary && d.role) : step === 3 ? !!(d.reason && (tenure >= 3 || d.induced !== null) && d.hasContract !== null) : step === 4 ? d.hasOffer !== null && (d.hasOffer === false || !!((d.offFmt === "amt" && d.offAmt) || (d.offFmt === "wks" && d.offWks) || (d.offFmt === "mos" && d.offMos))) : false;

  function reset() { setStep(-1); setRes(null); setD({ province: "", age: "", years: "", months: "", salary: "", bonus: "", role: "", jobTitle: "", sevElig: false, hasOffer: null, offFmt: "amt", offAmt: "", offWks: "", offMos: "", reason: "", induced: null, hasContract: null, contractTerms: false, contractAge: "", bens: [], industry: "", vacDays: "", signedRelease: null, deadline: null, deadlineDays: "", hasDependents: null, badFaith: null, newJob: "", nonCompete: null }); }

  if (step === -1) return <Landing onStart={() => setStep(1)} />;

  return <div style={{ minHeight: "100vh", background: "linear-gradient(165deg, #FAFAF7 0%, #F4F2ED 40%, #EDE9E1 100%)", color: "#1A1A18", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
    {step > 0 && step < 5 && <TopBar step={step} onBack={() => go(step === 1 ? -1 : step - 1)} />}
    {step > 0 && step < 5 && <Dots c={step - 1} t={TS} />}
    <div style={{ opacity: fade ? 0 : 1, transform: fade ? "translateX(8px)" : "translateX(0)", transition: "all .15s ease", paddingTop: step === 5 ? 10 : 8, paddingBottom: step >= 1 && step <= 4 ? 72 : 14 }}>
      {step === 1 && <S1 d={d} setD={setD} />}
      {step === 2 && <S2 d={d} setD={setD} />}
      {step === 3 && <S3 d={d} setD={setD} />}
      {step === 4 && <S4 d={d} setD={setD} />}
      {step === 5 && res && <Res res={res} onReset={reset} />}
    </div>
    {step >= 1 && step <= 4 && <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 20px 16px", background: "linear-gradient(transparent, #F4F2ED 30%)" }}><div style={{ maxWidth: 430, margin: "0 auto" }}><Btn onClick={() => go(step + 1)} disabled={!ok} full>{step === 4 ? "Analyze my severance \u2192" : "Continue \u2192"}</Btn></div></div>}
  </div>;
}
