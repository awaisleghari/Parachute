import { useState, useEffect, useMemo, useRef } from "react";
import html2pdf from "html2pdf.js";

/* ═══════════════════ DATA ═══════════════════ */
const PROVS = {
  ON: { n: "Ontario", esa: "Employment Standards Act, 2000", tw: y => Math.min(Math.floor(y), 8), sw: (y, e) => e && y >= 5 ? Math.min(Math.floor(y), 26) : 0, hs: true, sn: "Ontario is one of the few provinces with a separate severance pay on top of termination pay. Applies when employer payroll exceeds $2.5M or 50+ employees severed within 6 months, and you have 5+ years of service.", kc: "Waksdale v. Swegon North America Inc., 2020 ONCA 391" },
  BC: { n: "British Columbia", esa: "Employment Standards Act, RSBC 1996", tw: y => y < .25 ? 0 : y < 1 ? 1 : y < 3 ? 2 : Math.min(Math.floor(y), 8), sw: () => 0, hs: false, kc: "Bardal v. Globe & Mail Ltd." },
  AB: { n: "Alberta", esa: "Employment Standards Code, RSA 2000", tw: y => y < .25 ? 0 : y < 2 ? 1 : y < 4 ? 2 : y < 6 ? 4 : y < 8 ? 5 : y < 10 ? 6 : 8, sw: () => 0, hs: false, kc: "Bardal factors" },
  FED: { n: "Federal (CLC)", esa: "Canada Labour Code, Part III", tw: y => y >= 1 ? 2 : 0, sw: y => y >= 1 ? Math.max(Math.round(y * 5 / 7), 2) : 0, hs: true, sn: "Under the Canada Labour Code, federally regulated employees get both termination pay and severance pay after 12 months.", kc: "s. 240 CLC" },
  QC: { n: "Quebec", esa: "Act respecting labour standards", tw: y => y < .25 ? 0 : y < 1 ? 1 : y < 5 ? 2 : y < 10 ? 4 : 8, sw: () => 0, hs: false, kc: "Civil Code of Québec, art. 2091", civil: true, sn: "Quebec operates under civil law, not common law. The \"reasonable notice\" concept exists under art. 2091 of the Civil Code, but courts apply different factors and precedents than common law provinces. The estimates below use comparable civil law jurisprudence, but a Quebec employment lawyer should be consulted for precise analysis." },
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
  { id: "cd", l: "Constructive dismissal", i: "Full notice if established" }, { id: "pf", l: "Alleged performance", i: "Heavy burden on employer" },
  { id: "fc", l: "Terminated for cause", i: "Employer claims serious misconduct" },
  { id: "un", l: "Not sure / other", i: "Assumes without cause" },
];
const EMP_REASONS = [
  { id: "re", l: "Position elimination / restructuring", i: "Standard severance obligations apply" },
  { id: "wc", l: "Without cause (no specific reason)", i: "Standard severance obligations apply" },
  { id: "pf", l: "Performance issues", i: "Cause rarely established; plan for full severance" },
  { id: "fc", l: "For cause (serious misconduct)", i: "Very high burden of proof on you" },
  { id: "pr", l: "End of probation", i: "Reduced obligations in most provinces" },
];
const INDS = ["Technology", "Finance / Banking", "Legal / Professional", "Healthcare", "Energy / Resources", "Manufacturing", "Retail / Consumer", "Government", "Other"];
const BENS = [
  { id: "health", l: "Health / dental", t: "Typically terminates on last day unless extended in severance. Contact insurer within 30 days for guaranteed conversion to individual plan. Check if spouse\u2019s plan can add you.", et: "Typically terminates on the employee's last day. Standard practice is to continue coverage for the notice period as part of the severance package. Provide the employee with information about conversion to an individual plan within 30 days." },
  { id: "pension", l: "Pension / RRSP match", t: "Matching stops immediately. Vested benefits preserved. Request pension statement. Transfer group RRSP/DCPP to personal RRSP or LIRA.", et: "Employer matching stops on the last day. Vested benefits are preserved and belong to the employee. Provide a pension statement and facilitate transfer of group RRSP/DCPP to a personal RRSP or LIRA." },
  { id: "stock", l: "Stock options / RSUs", t: "Unvested equity typically lapses 30\u201390 days post-termination. Check plan documents immediately. Negotiate accelerated vesting if significant.", et: "Unvested equity typically lapses 30\u201390 days post-termination per the plan documents. Consider offering accelerated vesting as part of the severance package, especially for senior employees where equity is a significant part of total compensation." },
  { id: "life", l: "Life insurance", t: "Terminates on last day. Most policies offer 30-day conversion without underwriting. Contact insurer.", et: "Terminates on the last day. Provide the employee with information about conversion options. Most group policies allow 30-day conversion to an individual plan without underwriting." },
  { id: "disability", l: "Disability", t: "Terminates immediately. Cannot file new LTD claim after last day. If pre-existing condition, file before termination. Consider private coverage.", et: "Terminates immediately. If the employee has a known disability or pending claim, consult counsel before proceeding. Terminating an employee with a pending LTD claim creates significant human rights exposure." },
  { id: "car", l: "Car allowance", t: "Stops on termination. Should be included in total compensation for severance calculation.", et: "Stops on the last day. Must be included in total compensation when calculating severance. Failure to include car allowance in the severance calculation can result in an underpayment claim." },
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
  const sal_t = tc >= 400000 ? 1.12 : tc >= 300000 ? 1.06 : 1;
  const cL = Math.min(Math.max(yrs * r.mL * am.l * ind * ci.m * bf * sal_t, 1), 26);
  const cM = Math.min(Math.max(yrs * r.mM * am.m * ind * ci.m * bf * sal_t, 1), 26);
  const cH = Math.min(Math.max(yrs * r.mH * am.h * ind * bf * sal_t, 2), 26);
  let off = null;
  if (d.hasOffer) { if (d.offFmt === "amt") off = parseFloat(d.offAmt) || 0; else if (d.offFmt === "wks") off = (parseFloat(d.offWks) || 0) * wk; else off = (parseFloat(d.offMos) || 0) * mo; }
  const vd = parseFloat(d.vacDays) || 0;
  const indPct = d.induced && yrs < 3 ? Math.round((ind - 1) * 100) : 0;
  let ujd = null;
  if (d.province === "FED" && yrs >= 1) ujd = { statute: "Canada Labour Code, s. 240", threshold: "12 months", remedy: "Federally regulated employees with 12+ months of continuous service can file an unjust dismissal complaint. Remedies may include reinstatement to the position and compensation for lost wages. This is a separate avenue from the severance entitlements above and may be more favourable. Strict time limits apply. Consult a lawyer promptly." };
  if (d.province === "QC" && yrs >= 2) ujd = { statute: "Act respecting labour standards, s. 124", threshold: "2 years", remedy: "Quebec employees with 2+ years of continuous service who believe they were dismissed without good and sufficient cause can file a complaint. Remedies may include reinstatement and compensation. Note that Quebec operates under civil law, and common law reasonable notice principles may apply differently. Consult a lawyer familiar with Quebec employment law." };
  if (d.province === "NS" && yrs >= 10) { const mgmt = d.role === "mgmt" || d.role === "exec"; ujd = { statute: "Labour Standards Code, s. 71", threshold: "10 years", remedy: "Nova Scotia employees with 10+ years of continuous service have access to an unjust dismissal provision. Remedies may include reinstatement or compensation. This is in addition to your standard termination entitlements." + (mgmt ? " Note: employees in a managerial or supervisory capacity may be excluded from this provision. Consult a lawyer to confirm whether the exemption applies to your role." : " Consult a lawyer to assess whether this applies to your situation.") }; }
  return { pn: p.n, esa: p.esa, tw, sw, totW, esaAmt: Math.round(totW * wk), wk: Math.round(wk), cL: Math.round(cL * 10) / 10, cM: Math.round(cM * 10) / 10, cH: Math.round(cH * 10) / 10, cLA: Math.round(cL * mo), cMA: Math.round(cM * mo), cHA: Math.round(cH * mo), off, offMo: off !== null && mo > 0 ? Math.round(off / mo * 10) / 10 : null, mo: Math.round(mo), hs: p.hs, sn: p.sn, kc: p.kc, sal: s, bonus: b, tc, yrs: Math.round(yrs * 10) / 10, age: a, rl: r.l, ind: d.induced && yrs < 3, indPct, ci, reason: d.reason, bens: d.bens || [], jt: d.jobTitle, industry: d.industry, sr: d.signedRelease, dl: d.deadline, dlDays: d.deadlineDays, prov: d.province, vd, vp: Math.round(vd * (s / 260)), bf: d.badFaith, newJob: d.newJob, nc: d.nonCompete, hasContract: d.hasContract, contractAge: d.contractAge, tr: !!p.tr, ujd, empDocLevel: d.empDocLevel, empHR: d.empHumanRights, empGroup: d.empGroupTerm, empTermStatus: d.empTermStatus, civil: !!p.civil, salTier: sal_t > 1 };
}
const $ = n => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
const T = "#0A6B5C", Td = "#085041", Tl = "#9FE1CB";

function ThemeStyle({ dark }) {
  const vars = dark ? `
    :root {
      --bg-page-1: #141414; --bg-page-2: #1A1A1A; --bg-page-3: #1E1E1E;
      --bg-card: #1E1E1E; --bg-subtle: #1A1A1A; --bg-muted: #252525;
      --bg-input: #252525; --bg-toggle: #2A2A2A;
      --text: #E8E6E0; --text-sec: #B0ADA6; --text-muted: #8A8780;
      --text-dim: #7A7772; --text-faint: #6A6762;
      --border: #3A3A3A; --border-light: #333; --border-lighter: #2A2A2A;
      --nav-fade: #1A1A1A; --shadow: rgba(0,0,0,.3);
      --bg-warning: #2A2210; --border-warning: #3D3520; --text-warning: #D4A853;
      --bg-alert: rgba(216,90,48,.12); --text-alert: #E8734A; --text-alert-dark: #E8734A;
    }
    body { background: #141414; }
  ` : `
    :root {
      --bg-page-1: #FAFAF7; --bg-page-2: #F4F2ED; --bg-page-3: #EDE9E1;
      --bg-card: #ffffff; --bg-subtle: #FAFAF7; --bg-muted: #F1EFE8;
      --bg-input: #ffffff; --bg-toggle: #F1EFE8;
      --text: #1A1A18; --text-sec: #5F5E5A; --text-muted: #888;
      --text-dim: #999; --text-faint: #B4B2A9;
      --border: #D3D1C7; --border-light: #E8E6E0; --border-lighter: #F1EFE8;
      --nav-fade: #F4F2ED; --shadow: rgba(0,0,0,.06);
      --bg-warning: #FFF8E7; --border-warning: #F0E6C8; --text-warning: #854F0B;
      --bg-alert: rgba(216,90,48,.08); --text-alert: #993C1D; --text-alert-dark: #712B13;
    }
    body { background: #FAFAF7; }
  `;
  return <style>{vars + `\n*, *::before, *::after { transition: background-color .2s, border-color .2s, color .15s; }`}</style>;
}

/* ═══════════════════ UI ═══════════════════ */
function Fade({ children, delay = 0 }) { const [s, setS] = useState(false); useEffect(() => { const t = setTimeout(() => setS(true), delay); return () => clearTimeout(t); }, [delay]); return <div style={{ opacity: s ? 1 : 0, transform: s ? "translateY(0)" : "translateY(8px)", transition: "all .4s cubic-bezier(.25,1,.5,1)" }}>{children}</div>; }

function Sel({ on, onClick, children, sub }) {
  return <button onClick={onClick} style={{ display: "flex", alignItems: "flex-start", width: "100%", textAlign: "left", padding: sub ? "12px 14px" : "11px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13.5, border: on ? "2px solid " + T : "1.5px solid var(--border)", background: on ? "rgba(10,107,92,.04)" : "var(--bg-card)", color: "var(--text)", fontWeight: on ? 500 : 400, marginBottom: 5, transition: "all .12s" }}>
    <div style={{ width: 17, height: 17, borderRadius: 17, marginRight: 11, flexShrink: 0, marginTop: sub ? 2 : 0, border: on ? "5px solid " + T : "2px solid var(--border)", background: on ? T : "var(--bg-card)", boxSizing: "border-box" }} />
    <div style={{ flex: 1 }}><span>{children}</span>{sub && <p style={{ fontSize: 10.5, color: "var(--text-dim)", margin: "2px 0 0", lineHeight: 1.3, fontWeight: 400 }}>{sub}</p>}</div>
    {on && <span style={{ color: T, fontSize: 13, marginLeft: 5, flexShrink: 0 }}>{"\u2713"}</span>}
  </button>;
}

function Fld({ label, value, onChange, type, prefix, placeholder, help, suffix }) {
  const [f, setF] = useState(false);
  return <div style={{ marginBottom: 14, minWidth: 0 }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</label>}
    <div style={{ display: "flex", alignItems: "center", background: "var(--bg-card)", borderRadius: 9, border: f ? "2px solid " + T : "1.5px solid var(--border)", padding: f ? "0 12px" : "0 13px", boxShadow: f ? "0 0 0 3px rgba(10,107,92,.06)" : "none", transition: "all .12s", minWidth: 0 }}>
      {prefix && <span style={{ color: "var(--text-muted)", fontSize: 14, marginRight: 4 }}>{prefix}</span>}
      <input type={type || "text"} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} style={{ flex: 1, border: "none", outline: "none", fontSize: 16, padding: "9px 0", background: "transparent", color: "var(--text)", minWidth: 0, width: "100%" }} />
      {suffix && <span style={{ color: "var(--text-dim)", fontSize: 11, flexShrink: 0 }}>{suffix}</span>}
    </div>
    {help && <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, marginBottom: 0, lineHeight: 1.3 }}>{help}</p>}
  </div>;
}

function Tog({ opts, val, onChange }) { return <div style={{ display: "flex", background: "var(--bg-muted)", borderRadius: 8, padding: 2, marginBottom: 10 }}>{opts.map(o => <button key={o.v} onClick={() => onChange(o.v)} style={{ flex: 1, padding: "7px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: val === o.v ? 500 : 400, background: val === o.v ? "var(--bg-card)" : "transparent", color: val === o.v ? T : "var(--text-muted)", boxShadow: val === o.v ? "0 1px 2px rgba(0,0,0,.06)" : "none" }}>{o.l}</button>)}</div>; }

function Btn({ onClick, disabled, children, full, secondary }) {
  return <button onClick={disabled ? undefined : onClick} style={{ background: secondary ? "transparent" : disabled ? "#ccc" : T, color: secondary ? "var(--text-sec)" : "#fff", border: secondary ? "1.5px solid var(--border)" : "none", padding: "11px 20px", borderRadius: 10, fontSize: 13.5, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", width: full ? "100%" : "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{children}</button>;
}

function Dots({ c, t }) { return <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "8px 0 2px" }}>{Array.from({ length: t }, (_, i) => <div key={i} style={{ width: i === c ? 20 : 6, height: 6, borderRadius: 3, background: i === c ? T : i < c ? Tl : "var(--border)", transition: "all .25s" }} />)}</div>; }

function Pill({ on, onClick, children }) { return <button onClick={onClick} style={{ padding: "6px 11px", borderRadius: 14, fontSize: 11, cursor: "pointer", border: on ? "1.5px solid " + T : "1.5px solid var(--border)", background: on ? "rgba(10,107,92,.06)" : "var(--bg-card)", color: on ? T : "var(--text-sec)", fontWeight: on ? 500 : 400 }}>{on ? "\u2713 " : ""}{children}</button>; }

/* Expandable legal term tooltip */
function Whats({ children, tip }) {
  const [open, setOpen] = useState(false);
  return <span>
    {children} <button onClick={() => setOpen(!open)} style={{ background: "rgba(10,107,92,.08)", border: "none", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: T, cursor: "pointer", fontWeight: 500 }}>{open ? "\u2013" : "?"}</button>
    {open && <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 3, padding: "6px 10px", background: "var(--bg-subtle)", borderRadius: 7, border: "1px solid var(--border-lighter)" }}>{tip}</span>}
  </span>;
}

function BViz({ bars }) { const mx = Math.max(...bars.map(b => b.a), 1); const [g, setG] = useState(false); useEffect(() => { setTimeout(() => setG(true), 50); }, []); return <div>{bars.map((b, i) => <div key={i} style={{ marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}><span style={{ color: "var(--text-sec)", fontWeight: 500 }}>{b.l}</span><span style={{ fontWeight: 600, color: b.tc || "var(--text)" }}>{$(b.a)}</span></div><div style={{ background: "var(--bg-muted)", borderRadius: 5, height: 20, overflow: "hidden" }}><div style={{ width: g ? (b.a / mx * 100) + "%" : "0%", height: "100%", background: b.c, borderRadius: 5, transition: "width .6s cubic-bezier(.25,1,.5,1)", transitionDelay: (i * .06) + "s" }} /></div></div>)}</div>; }

function MC({ l, v, s, a, delay }) { return <Fade delay={delay || 0}><div style={{ background: a ? "rgba(10,107,92,.05)" : "var(--bg-card)", borderRadius: 11, padding: "12px 13px", border: a ? "1.5px solid rgba(10,107,92,.2)" : "1px solid var(--border-light)" }}><p style={{ fontSize: 9, fontWeight: 600, color: a ? T : "var(--text-muted)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</p><p style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 400, margin: "0 0 1px", color: a ? T : "var(--text)" }}>{v}</p>{s && <p style={{ fontSize: 9, color: "var(--text-faint)", margin: 0 }}>{s}</p>}</div></Fade>; }

const SL = { fontSize: 10, fontWeight: 600, color: "var(--text-sec)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".04em" };
const CD = { background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-light)", padding: "15px", marginBottom: 11 };

/* Brand header for step pages */
function TopBar({ step, onBack, dark, setDark, onLogoClick }) {
  return <div>
    <div style={{ background: "linear-gradient(135deg, #0A6B5C 0%, #085D50 40%, #0B5A65 100%)", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div onClick={onLogoClick} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
        <Logo size={18} color="#fff" />
        <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>Parachute</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setDark(!dark)} style={{ background: "rgba(255,255,255,.12)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1, color: "#fff" }}>{dark ? "\u2600" : "\u263E"}</button>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>{step + " of " + TS}</span>
      </div>
    </div>
    {/* Visible disclaimer banner */}
    <div style={{ background: "var(--bg-warning)", padding: "7px 20px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid var(--border-warning)" }}>
      <span style={{ fontSize: 11, color: "var(--text-warning)" }}>{"\u2696"}</span>
      <span style={{ fontSize: 10.5, color: "var(--text-warning)" }}>For informational purposes only. This is not legal advice.</span>
    </div>
    <div style={{ padding: "8px 20px 0" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", padding: 0 }}>{"\u2190 Back"}</button>
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
function Landing({ onStart, onGuides }) {
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [curMode, setCurMode] = useState("employee");
  const [hov, setHov] = useState(null);
  const sceneRef = useRef(null);
  const doodleRef = useRef(null);
  const phase1Ref = useRef(null);
  const phase2Ref = useRef(null);
  const phase3Ref = useRef(null);
  const phase4Ref = useRef(null);
  const groundRef = useRef(null);
  const hintRef = useRef(null);
  const cloudRefs = useRef([]);

  useEffect(() => {
    const l1 = document.createElement("link");
    l1.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap";
    l1.rel = "stylesheet";
    document.head.appendChild(l1);

    const phases = [phase1Ref.current, phase2Ref.current, phase3Ref.current, phase4Ref.current];

    function update() {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const sceneH = sceneRef.current ? sceneRef.current.offsetHeight : vh * 3;
      const maxScroll = sceneH - vh;
      const p = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;

      // Doodle
      if (doodleRef.current) {
        const dH = 285;
        const startY = -dH + 20;
        const endY = vh - dH - 30;
        const y = startY + (endY - startY) * p;
        const sx = Math.sin(p * Math.PI * 4) * 25;
        const cx = vw / 2 - 100;
        const rot = Math.sin(p * Math.PI * 3) * 3;
        const sc = 1 - p * 0.15;
        doodleRef.current.style.transform = "translate(" + (cx + sx) + "px," + y + "px)";
        doodleRef.current.firstChild.style.transform = "rotate(" + rot + "deg) scale(" + sc + ")";
      }

      // Phases
      const breaks = [0, 0.28, 0.55, 0.78];
      phases.forEach((el, i) => {
        if (!el) return;
        const active = i === 3 ? p >= breaks[3] : (p >= breaks[i] && p < breaks[i + 1]);
        el.style.opacity = active ? "1" : "0";
        el.style.transform = active ? "translateY(-" + (i === 3 ? "60" : "50") + "%)" : "translateY(-40%)";
        el.style.pointerEvents = active ? "auto" : "none";
      });

      // Clouds
      cloudRefs.current.forEach((el, i) => {
        if (!el) return;
        const showAt = 0.02 + i * 0.07;
        const vis = p > showAt && p < showAt + 0.22;
        const drift = (p - showAt) * 45;
        el.style.opacity = vis ? "1" : "0";
        el.style.transform = "translateX(" + (i % 2 === 0 ? drift : -drift) + "px)";
      });

      // Ground
      if (groundRef.current) groundRef.current.style.opacity = p > 0.85 ? "1" : "0";

      // Scroll hint
      if (hintRef.current) hintRef.current.style.opacity = p > 0.1 ? "0" : "1";
    }

    let ticking = false;
    function onScroll() {
      if (!ticking) { requestAnimationFrame(() => { update(); ticking = false; }); ticking = true; }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", update); };
  }, []);

  const HF = "'Instrument Serif', Georgia, serif";
  const BF = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

  const TERMS = "1. NOT LEGAL ADVICE\nThis tool provides general information about severance and termination entitlements under Canadian federal, provincial, and territorial employment standards legislation and common law principles. It is provided strictly for educational and informational purposes. Nothing generated by this tool constitutes legal advice, a legal opinion, or a recommendation to pursue or refrain from pursuing any particular course of action. No solicitor-client, attorney-client, or other professional relationship is created by your use of this tool.\n\n2. NO WARRANTY; ACCURACY NOT GUARANTEED\nAll estimates, calculations, ranges, and outputs are provided on an \"as is\" and \"as available\" basis, without warranty of any kind, whether express, implied, statutory, or otherwise, including without limitation any warranty of merchantability, fitness for a particular purpose, accuracy, completeness, or non-infringement. The information presented may be inaccurate, incomplete, outdated, or inapplicable to your specific circumstances. Employment legislation, regulations, and case law are subject to change at any time, and this tool may not reflect the most current legal developments in any jurisdiction.\n\n3. LIMITATION OF LIABILITY\nTo the maximum extent permitted by applicable law, the creators, developers, operators, and affiliates of this tool shall not be liable for any direct, indirect, incidental, special, consequential, punitive, or exemplary damages of any kind, including without limitation damages for loss of income, loss of employment benefits, litigation costs, emotional distress, or any other losses arising out of or in connection with your use of or reliance on this tool or any information, content, materials, or outputs made available through it, whether based on contract, tort, negligence, strict liability, or any other legal theory, even if advised of the possibility of such damages.\n\n4. NO RELIANCE\nYou acknowledge and agree that you will not rely on this tool as a substitute for qualified legal counsel. The outputs, including but not limited to severance estimates, negotiation letters, lawyer reports, checklists, benefits guidance, and tax considerations, are templates and general references only. You are solely responsible for verifying all information independently and for retaining a qualified employment lawyer licensed in your jurisdiction before making any decisions regarding your employment, severance, or legal rights.\n\n5. TEMPLATE DOCUMENTS\nAny negotiation letters, demand letters, lawyer reports, or other documents generated by this tool are generic templates that have not been reviewed by a lawyer in connection with your individual circumstances. Sending, relying on, or acting upon these documents without independent legal review is done entirely at your own risk. The use of legal terminology, case law references, or statutory citations within these templates does not render them legal advice.\n\n6. JURISDICTIONAL LIMITATIONS\nCanadian employment law varies significantly across federal, provincial, and territorial jurisdictions. This tool attempts to address multiple jurisdictions but may not accurately capture all applicable legislation, regulations, collective agreement provisions, or case law developments in every jurisdiction. Users in Quebec should note that civil law principles apply, and common law reasonable notice analysis may not apply in the same manner.\n\n7. DATA & PRIVACY\nAll employment data you enter into this tool is processed entirely within your web browser. No personal information, employment data, or inputs of any kind are transmitted to, collected by, stored on, or accessible by any server, database, third party, or the operators of this tool. We use anonymous analytics services (Google Analytics and Microsoft Clarity) to understand how the tool is used and to improve it. These services collect standard usage data such as page views, device type, and interaction patterns. They do not have access to any employment data you enter into the tool.\n\n8. INDEMNIFICATION\nBy using this tool, you agree to indemnify, defend, and hold harmless the creators, developers, operators, and affiliates of this tool from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or in any way connected with your use of or reliance on this tool.\n\n9. GOVERNING LAW\nThese terms shall be governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles.\n\n10. ACCEPTANCE\nBy checking the box below and proceeding, you confirm that you have read, understood, and agree to be bound by all of the foregoing terms and conditions.";

  const cloudData = [
    { top: "8%", left: "4%", w: 130, vb: "0 0 130 40", d: "M8 30 Q30 12 55 25 Q72 10 95 22 Q112 14 125 28" },
    { top: "14%", right: "5%", w: 105, vb: "0 0 105 30", d: "M5 22 Q25 8 50 18 Q68 5 90 20 Q98 14 103 22" },
    { top: "22%", left: "18%", w: 75, vb: "0 0 75 24", d: "M5 18 Q18 6 35 15 Q50 4 72 17" },
    { top: "28%", right: "12%", w: 115, vb: "0 0 115 32", d: "M6 24 Q28 8 50 20 Q70 6 90 18 Q102 10 112 22" },
    { top: "36%", left: "6%", w: 90, vb: "0 0 90 26", d: "M5 20 Q22 6 42 16 Q58 4 78 14 Q86 9 88 18" },
    { top: "42%", right: "8%", w: 65, vb: "0 0 65 20", d: "M4 15 Q18 5 32 12 Q46 3 62 14" },
    { top: "50%", left: "12%", w: 100, vb: "0 0 100 28", d: "M5 22 Q22 8 45 18 Q62 5 82 16 Q92 10 97 20" },
    { top: "56%", right: "16%", w: 55, vb: "0 0 55 18", d: "M4 13 Q15 4 28 11 Q40 3 52 12" },
    { top: "64%", left: "22%", w: 80, vb: "0 0 80 24", d: "M5 18 Q20 6 38 15 Q55 4 75 16" },
    { top: "70%", right: "20%", w: 48, vb: "0 0 48 16", d: "M4 12 Q14 4 24 10 Q34 3 44 11" },
    { top: "78%", left: "8%", w: 60, vb: "0 0 60 18", d: "M4 14 Q16 4 30 12 Q42 3 56 13" },
    { top: "84%", right: "10%", w: 72, vb: "0 0 72 20", d: "M5 15 Q18 5 34 13 Q48 4 68 14" },
  ];

  const PS = { position: "absolute", width: "100%", textAlign: "center", padding: "0 32px", zIndex: 5, top: "50%", opacity: 0, transform: "translateY(-40%)", transition: "opacity .4s ease, transform .4s ease", pointerEvents: "none" };

  return <div style={{ color: "#fff", fontFamily: BF, position: "relative" }}>
    <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg, #021E19 0%, #032F28 25%, #0A6B5C 50%, #085D50 70%, #0B5A65 90%, #0A2540 100%)", zIndex: 0 }} />
    <div style={{ position: "fixed", inset: 0, opacity: .025, zIndex: 0, pointerEvents: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }} />
    <style>{`@keyframes ctaGlow { 0%,100% { opacity: .4; transform: translate(-50%,-50%) scale(1); } 50% { opacity: .6; transform: translate(-50%,-50%) scale(1.1); } } @keyframes scrollPulse { 0%,100% { opacity:.4 } 50% { opacity:.8 } }`}</style>

    {/* SCROLL SCENE */}
    <div ref={sceneRef} style={{ position: "relative", height: "300vh" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", width: "100%", overflow: "hidden", zIndex: 1 }}>

        {/* Clouds */}
        {cloudData.map((c, i) => <div key={i} ref={el => cloudRefs.current[i] = el} style={{ position: "absolute", top: c.top, left: c.left, right: c.right, width: c.w, pointerEvents: "none", opacity: 0, transition: "opacity .6s ease, transform .6s ease" }}>
          <svg viewBox={c.vb} style={{ width: "100%" }}><path d={c.d} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </div>)}

        {/* Doodle */}
        <div ref={doodleRef} style={{ position: "absolute", willChange: "transform", zIndex: 2 }}>
          <div>
            <svg width="200" viewBox="0 0 140 200" fill="none" style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,.3))" }}>
              <path d="M20 60 Q30 10 70 8 Q110 10 120 60" fill="rgba(159,225,203,.12)" stroke="#9FE1CB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M45 12 Q50 35 52 58" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="4 3" opacity=".5" />
              <path d="M70 8 Q70 33 70 56" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="4 3" opacity=".5" />
              <path d="M95 12 Q90 35 88 58" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="4 3" opacity=".5" />
              <line x1="20" y1="60" x2="62" y2="110" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="120" y1="60" x2="78" y2="110" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="52" y1="58" x2="66" y2="110" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="88" y1="58" x2="74" y2="110" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <circle cx="70" cy="118" r="8" fill="none" stroke="#fff" strokeWidth="2" opacity=".85" />
              <line x1="70" y1="126" x2="70" y2="155" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="70" y1="135" x2="52" y2="125" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="70" y1="135" x2="88" y2="125" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="70" y1="155" x2="58" y2="178" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="70" y1="155" x2="82" y2="178" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="58" y1="178" x2="52" y2="180" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
              <line x1="82" y1="178" x2="88" y2="180" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
            </svg>
          </div>
        </div>

        {/* Ground */}
        <div ref={groundRef} style={{ position: "absolute", bottom: 26, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent 10%, rgba(159,225,203,.2) 30%, rgba(159,225,203,.3) 50%, rgba(159,225,203,.2) 70%, transparent 90%)", opacity: 0, transition: "opacity .4s" }} />

        {/* Phase 1 */}
        <div ref={phase1Ref} style={{ ...PS, opacity: 1, transform: "translateY(-50%)" }}>
          <h2 style={{ fontFamily: HF, fontSize: "clamp(36px, 10vw, 60px)", fontWeight: 400, lineHeight: 1.0, letterSpacing: "-.02em", marginBottom: 12 }}>Know what<br /><em style={{ fontStyle: "italic", color: "#9FE1CB" }}>you're owed.</em></h2>
          <p style={{ fontSize: "clamp(14px, 3.5vw, 17px)", color: "rgba(255,255,255,.5)", lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>Free severance analysis for all of Canada. Built on employment law, not guesswork.</p>
        </div>

        {/* Phase 2 */}
        <div ref={phase2Ref} style={PS}>
          <h2 style={{ fontFamily: HF, fontSize: "clamp(36px, 10vw, 60px)", fontWeight: 400, lineHeight: 1.0, letterSpacing: "-.02em", marginBottom: 12 }}>Takes <em style={{ fontStyle: "italic", color: "#9FE1CB" }}>two minutes.</em></h2>
          <p style={{ fontSize: "clamp(14px, 3.5vw, 17px)", color: "rgba(255,255,255,.5)", lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>Answer a few questions about your job, your termination, and your offer. We do the rest.</p>
        </div>

        {/* Phase 3 */}
        <div ref={phase3Ref} style={PS}>
          <h2 style={{ fontFamily: HF, fontSize: "clamp(36px, 10vw, 60px)", fontWeight: 400, lineHeight: 1.0, letterSpacing: "-.02em", marginBottom: 12 }}>Everything you need.<br /><em style={{ fontStyle: "italic", color: "#9FE1CB" }}>Nothing you don't.</em></h2>
          <p style={{ fontSize: "clamp(14px, 3.5vw, 17px)", color: "rgba(255,255,255,.5)", lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>Severance estimates, a negotiation letter, a strategy memo, and a report for your lawyer.</p>
        </div>

        {/* Phase 4: CTAs */}
        <div ref={phase4Ref} style={PS}>
          {!showTerms ? <>
            <h2 style={{ fontFamily: HF, fontSize: "clamp(32px, 9vw, 52px)", fontWeight: 400, lineHeight: 1.0, letterSpacing: "-.02em", marginBottom: 28 }}>Ready to<br /><em style={{ fontStyle: "italic", color: "#9FE1CB" }}>land safely?</em></h2>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{ position: "absolute", top: "50%", left: "50%", width: 200, height: 60, borderRadius: 60, background: "radial-gradient(ellipse, rgba(100,220,180,.3) 0%, rgba(60,120,220,.15) 50%, transparent 80%)", filter: "blur(20px)", animation: "ctaGlow 3s ease-in-out infinite", zIndex: 0, pointerEvents: "none" }} />
                <button onClick={() => { setCurMode("employee"); setShowTerms(true); }} onMouseEnter={() => setHov("cta")} onMouseLeave={() => setHov(null)} style={{ position: "relative", zIndex: 1, padding: "18px 48px", borderRadius: 60, border: "none", background: hov === "cta" ? "#fff" : "rgba(255,255,255,.95)", color: "#053D32", fontSize: 17, fontWeight: 600, fontFamily: BF, cursor: "pointer", transform: hov === "cta" ? "translateY(-2px)" : "translateY(0)", boxShadow: hov === "cta" ? "0 16px 48px rgba(0,0,0,.3)" : "0 6px 24px rgba(0,0,0,.15)", transition: "all .25s cubic-bezier(.25,1,.5,1)" }}>I was let go →</button>
              </div>
              <button onClick={() => { setCurMode("employer"); setShowTerms(true); }} onMouseEnter={() => setHov("emp")} onMouseLeave={() => setHov(null)} style={{ padding: "14px 36px", borderRadius: 60, border: "1px solid rgba(255,255,255,.15)", background: hov === "emp" ? "rgba(255,255,255,.08)" : "transparent", color: "rgba(255,255,255,.7)", fontSize: 14, fontWeight: 500, fontFamily: BF, cursor: "pointer", transition: "all .2s" }}>I'm letting someone go →</button>
              <button onClick={onGuides} onMouseEnter={() => setHov("guides")} onMouseLeave={() => setHov(null)} style={{ background: "none", border: "none", color: hov === "guides" ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.35)", fontSize: 13, fontWeight: 500, fontFamily: BF, cursor: "pointer", textDecoration: hov === "guides" ? "underline" : "none", textUnderlineOffset: "3px", padding: "8px 16px", transition: "all .2s" }}>Read our severance guides by province</button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 0, marginTop: 24 }}>
              {[{ n: "14", l: "Jurisdictions" }, { n: "2 min", l: "To complete" }, { n: "Free", l: "Always" }].map((s, i) => <div key={s.l} style={{ textAlign: "center", padding: "0 clamp(16px, 4vw, 32px)", borderLeft: i > 0 ? "1px solid rgba(255,255,255,.1)" : "none" }}>
                <p style={{ fontFamily: HF, fontSize: "clamp(20px, 4vw, 28px)", color: "rgba(255,255,255,.8)", margin: "0 0 2px" }}>{s.n}</p>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)", fontWeight: 600, margin: 0 }}>{s.l}</p>
              </div>)}
            </div>
          </> : <div style={{ maxWidth: 480, margin: "0 auto", background: "rgba(0,0,0,.35)", borderRadius: 20, padding: "24px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,.08)", textAlign: "left" }}>
            <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Terms of Use & Disclaimer</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", margin: "0 0 14px" }}>Please read carefully before proceeding.</p>
            <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 12, padding: "16px", marginBottom: 16, maxHeight: 220, overflowY: "auto", border: "1px solid rgba(255,255,255,.06)" }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,.65)", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>{TERMS}</p>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 16 }}>
              <div onClick={() => setAgreed(!agreed)} style={{ width: 24, height: 24, borderRadius: 7, border: agreed ? "none" : "2px solid rgba(255,255,255,.25)", background: agreed ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all .15s", boxShadow: agreed ? "0 2px 8px rgba(0,0,0,.15)" : "none" }}>{agreed && <span style={{ color: T, fontSize: 14, fontWeight: 700 }}>{"\u2713"}</span>}</div>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,.8)" }}>I have read and agree to these terms</span>
            </label>
            <button onMouseEnter={() => agreed && setHov("go")} onMouseLeave={() => setHov(null)} onClick={agreed ? () => onStart(curMode) : undefined} style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: agreed ? (hov === "go" ? "#fff" : "rgba(255,255,255,.95)") : "rgba(255,255,255,.1)", color: agreed ? "#053D32" : "rgba(255,255,255,.25)", fontSize: 15, fontWeight: 600, fontFamily: BF, cursor: agreed ? "pointer" : "not-allowed", transform: hov === "go" ? "translateY(-1px)" : "translateY(0)", boxShadow: hov === "go" ? "0 8px 24px rgba(0,0,0,.25)" : "none", transition: "all .2s cubic-bezier(.25,1,.5,1)" }}>{"I understand \u2014 let\u2019s go \u2192"}</button>
          </div>}
        </div>

        {/* Scroll hint */}
        <div ref={hintRef} style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", textAlign: "center", zIndex: 20, pointerEvents: "none" }}>
          <div style={{ width: 1, height: 28, background: "linear-gradient(180deg, rgba(159,225,203,.4) 0%, transparent 100%)", margin: "0 auto 6px", animation: "scrollPulse 2s ease-in-out infinite" }} />
          <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".15em", color: "rgba(159,225,203,.35)", margin: 0 }}>Scroll</p>
        </div>
      </div>
    </div>
  </div>;
}

/* ═══════════════════ STEPS ═══════════════════ */
const TS = 6;

function S1({ d, setD, mode }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const E = mode === "employer";
  const allJurisdictions = Object.entries(PROVS).map(([c, p]) => ({ code: c, name: p.n, group: c === "FED" ? "Federal" : p.tr ? "Territory" : "Province" }));
  const filtered = search ? allJurisdictions.filter(j => j.name.toLowerCase().includes(search.toLowerCase())) : allJurisdictions;
  const selected = d.province ? PROVS[d.province]?.n : "";
  const QL = { fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em", display: "block" };

  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 1 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>{E ? "Where does the employee work?" : "Where do you work?"}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Each province and territory has its own employment rules.</p></Fade>
    <Fade delay={20}>
      <label style={QL}>Province, territory, or federal</label>
      <div style={{ position: "relative" }}>
        <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", background: "var(--bg-card)", borderRadius: 9, border: open ? "2px solid " + T : "1.5px solid var(--border)", padding: open ? "0 12px" : "0 13px", cursor: "pointer", boxShadow: open ? "0 0 0 3px rgba(10,107,92,.06)" : "none", transition: "all .12s" }}>
          <input
            type="text"
            value={open ? search : selected}
            onChange={e => { setSearch(e.target.value); if (!open) setOpen(true); }}
            onClick={e => { e.stopPropagation(); setOpen(true); }}
            placeholder="Start typing or select..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: 16, padding: "11px 0", background: "transparent", color: "var(--text)", cursor: "pointer" }}
          />
          <span style={{ color: "var(--text-muted)", fontSize: 12, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .15s" }}>{"\u25BE"}</span>
        </div>
        {open && <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,.1)", zIndex: 10, maxHeight: 260, overflowY: "auto" }}>
          {["Province", "Territory", "Federal"].map(group => {
            const items = filtered.filter(j => j.group === group);
            if (items.length === 0) return null;
            return <div key={group}>
              <p style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em", padding: "8px 14px 4px", margin: 0 }}>{group}</p>
              {items.map(j => <div
                key={j.code}
                onClick={() => { setD({ ...d, province: j.code }); setOpen(false); setSearch(""); }}
                style={{ padding: "9px 14px", fontSize: 13, color: d.province === j.code ? T : "var(--text)", fontWeight: d.province === j.code ? 500 : 400, cursor: "pointer", background: d.province === j.code ? "rgba(10,107,92,.06)" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(10,107,92,.04)"}
                onMouseLeave={e => e.currentTarget.style.background = d.province === j.code ? "rgba(10,107,92,.04)" : "transparent"}
              >
                <span>{j.name}</span>
                {d.province === j.code && <span style={{ color: T, fontSize: 12 }}>{"\u2713"}</span>}
              </div>)}
            </div>;
          })}
          {filtered.length === 0 && <p style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-dim)", margin: 0 }}>No match found</p>}
        </div>}
      </div>
      {d.province === "FED" && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4, background: "var(--bg-subtle)", borderRadius: 7, padding: "8px 10px" }}>Airlines, banks, telecom, railways, and other federally regulated employers.</p>}
    </Fade>
  </div>;
}

function S2({ d, setD, mode }) {
  const E = mode === "employer";
  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 2 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>{E ? "Employee details" : "Employment details"}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>{E ? "We use these to estimate the exposure." : "We use these to estimate what you're owed."}</p></Fade>
    <Fade delay={25}><Fld label={E ? "Employee's age" : "Age"} type="number" value={d.age} onChange={v => setD({ ...d, age: v })} placeholder="e.g. 42" /></Fade>
    <Fade delay={40}><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>{E ? "Length of employment" : "How long you worked there"}</label><div style={{ display: "flex", gap: 7, marginBottom: 10 }}><div style={{ flex: 1, minWidth: 0 }}><Fld value={d.years} onChange={v => setD({ ...d, years: v })} type="number" placeholder="Years" suffix="yrs" /></div><div style={{ flex: 1, minWidth: 0 }}><Fld value={d.months} onChange={v => setD({ ...d, months: v })} type="number" placeholder="Months" suffix="mo" /></div></div></Fade>
    <Fade delay={55}><Fld label={E ? "Employee's job title" : "Job title"} value={d.jobTitle} onChange={v => setD({ ...d, jobTitle: v })} placeholder="e.g. Senior Marketing Manager" /></Fade>
    <Fade delay={70}><Fld label={E ? "Employee's annual base salary" : "Annual base salary"} type="number" value={d.salary} onChange={v => setD({ ...d, salary: v })} prefix="$" placeholder="e.g. 95000" suffix="CAD" /></Fade>
    <Fade delay={85}><Fld label={E ? "Annual bonus / commission" : "Annual bonus / commission"} type="number" value={d.bonus} onChange={v => setD({ ...d, bonus: v })} prefix="$" placeholder="0" suffix="CAD" help={E ? "Average annual variable pay for this employee. Enter 0 if none." : "Average annual variable pay. Enter 0 if none."} /></Fade>
    <Fade delay={95}><Fld label={E ? "Accrued vacation days" : "Unused vacation days"} type="number" value={d.vacDays} onChange={v => setD({ ...d, vacDays: v })} placeholder="e.g. 10" suffix="days" help={E ? "These must be paid out regardless of the severance package. This is a separate obligation." : "Your employer must pay these out. This is separate from severance."} /></Fade>
    <Fade delay={110}><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>{E ? "Employee's level of responsibility" : "Your level of responsibility"}</label><p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 0, marginBottom: 7, lineHeight: 1.4 }}>{E ? "Based on authority, not salary. Courts consider how hard the role is to replace." : "Based on authority, not salary. Courts care about how hard you are to replace."}</p>{ROLES.map(r => <Sel key={r.id} on={d.role === r.id} onClick={() => setD({ ...d, role: r.id })} sub={r.d}>{r.l}</Sel>)}</Fade>
    <Fade delay={125}><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Industry</label><div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>{INDS.map(i => <Pill key={i} on={d.industry === i} onClick={() => setD({ ...d, industry: i })}>{i}</Pill>)}</div></Fade>
    {d.province === "ON" && <Fade delay={140}><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Ontario: extra severance pay</label><p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 0, marginBottom: 7, lineHeight: 1.4 }}>{E ? "Ontario requires a separate \"severance pay\" in addition to termination pay if your total annual payroll exceeds $2.5 million, or if 50+ employees were let go within 6 months. This increases your statutory obligations." : "Ontario is unique. On top of termination pay, you may be owed a separate \"severance pay\" if your employer's total annual payroll exceeds $2.5 million, or if 50+ employees were let go within 6 months. If you're not sure, select \"Not sure\" and a lawyer can confirm."}</p><Sel on={d.sevElig === true} onClick={() => setD({ ...d, sevElig: true })}>{E ? "Yes, payroll exceeds $2.5M or 50+ affected" : "Yes, or I think so"}</Sel><Sel on={d.sevElig === false} onClick={() => setD({ ...d, sevElig: false })}>{E ? "No / not sure" : "No / not sure"}</Sel></Fade>}
  </div>;
}

function S3({ d, setD, mode }) {
  const E = mode === "employer";
  const QL = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" };
  const QH = { fontSize: 11, color: "var(--text-muted)", marginTop: 0, marginBottom: 7, lineHeight: 1.4 };
  const tenure = (parseFloat(d.years) || 0) + (parseFloat(d.months) || 0) / 12;

  if (E) return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 3 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>The termination</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>These details directly affect your legal exposure and the package you should offer.</p></Fade>

    <Fade delay={25}><label style={QL}>Reason for termination</label><p style={QH}>Select the primary reason. This determines the legal framework that applies.</p>{EMP_REASONS.map(r => <Sel key={r.id} on={d.reason === r.id} onClick={() => setD({ ...d, reason: r.id })} sub={r.i}>{r.l}</Sel>)}</Fade>

    {d.reason === "fc" && <Fade delay={35}><div style={{ background: "rgba(216,90,48,.06)", borderRadius: 10, padding: "11px 14px", marginTop: 6, marginBottom: 6, border: "1px solid rgba(216,90,48,.1)" }}>
      <p style={{ fontSize: 11, color: "var(--text-alert)", margin: 0, lineHeight: 1.5 }}>For-cause terminations are the most litigated and most frequently overturned. Courts require you to prove misconduct so serious that the employment relationship cannot continue. Budget for full common law notice in case cause is not established.</p>
    </div></Fade>}

    {tenure < 3 && <Fade delay={50}><label style={{ ...QL, marginTop: 10 }}>Was this employee recruited from another position?</label><p style={QH}>If you recruited this employee away from stable employment and are terminating within 3 years, courts treat this as a significant aggravating factor. The notice period will be substantially higher than short tenure alone would suggest.</p><Sel on={d.induced === true} onClick={() => setD({ ...d, induced: true })}>Yes, we recruited them from another role</Sel><Sel on={d.induced === false} onClick={() => setD({ ...d, induced: false })}>No, they applied independently</Sel></Fade>}

    <Fade delay={75}><label style={{ ...QL, marginTop: 10 }}>Employment contract</label><p style={QH}>Does the employee have a written contract with a termination clause? This determines whether you can limit severance to the contractual amount or must pay full common law notice.</p>
      <Sel on={d.hasContract === true} onClick={() => setD({ ...d, hasContract: true, contractTerms: false, contractAge: "" })}>Yes, there is a written contract</Sel>
      {d.hasContract === true && <div style={{ marginLeft: 24, borderLeft: "2px solid " + Tl, paddingLeft: 12, marginTop: 3, marginBottom: 6 }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 5px", lineHeight: 1.4 }}>Does it contain a termination or severance provision?</p>
        <Sel on={d.contractTerms === true} onClick={() => setD({ ...d, contractTerms: true })}>Yes, it limits termination entitlements</Sel>
        {d.contractTerms === true && <div style={{ marginLeft: 20, borderLeft: "2px solid var(--border-light)", paddingLeft: 10, marginTop: 3, marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 5px", lineHeight: 1.4 }}><Whats tip="In Ontario, the 2020 Waksdale decision invalidated many termination clauses. If any part of the clause fails to comply with ESA minimums, the entire clause may be void. Newer contracts are more vulnerable. Have your employment lawyer review the specific language before relying on it.">When was this contract signed?</Whats></p>
          <Sel on={d.contractAge === "recent"} onClick={() => setD({ ...d, contractAge: "recent" })}>In the last 3 years</Sel>
          <Sel on={d.contractAge === "old"} onClick={() => setD({ ...d, contractAge: "old" })}>More than 3 years ago</Sel>
          <Sel on={d.contractAge === "unsure"} onClick={() => setD({ ...d, contractAge: "unsure" })}>Not sure</Sel>
        </div>}
        <Sel on={d.contractTerms === false} onClick={() => setD({ ...d, contractTerms: false, contractAge: "" })}>No termination clause / not sure</Sel>
      </div>}
      <Sel on={d.hasContract === false} onClick={() => setD({ ...d, hasContract: false, contractTerms: false, contractAge: "" })}>No written contract</Sel>
      {d.hasContract === false && <div style={{ background: "rgba(216,90,48,.06)", borderRadius: 8, padding: "8px 12px", marginTop: 4, border: "1px solid rgba(216,90,48,.08)" }}>
        <p style={{ fontSize: 10.5, color: "var(--text-sec)", margin: 0, lineHeight: 1.4 }}>Without a written contract, the employee is entitled to full common law reasonable notice. This is almost always significantly more than statutory minimums.</p>
      </div>}
    </Fade>

    <Fade delay={100}><label style={{ ...QL, marginTop: 10 }}>Has the termination already occurred?</label><p style={QH}>This helps us tailor the guidance. If you haven't terminated yet, we can help you avoid common mistakes.</p>
      <Sel on={d.empTermStatus === "completed"} onClick={() => setD({ ...d, empTermStatus: "completed" })}>Yes, already terminated</Sel>
      <Sel on={d.empTermStatus === "planned"} onClick={() => setD({ ...d, empTermStatus: "planned" })}>Not yet, planning it</Sel>
    </Fade>

    {d.empTermStatus === "completed" && <Fade delay={110}><label style={{ ...QL, marginTop: 10 }}>Was there anything problematic about how it was handled?</label><p style={QH}>Public escort, announcement before private meeting, misleading statements, refusal to let them collect belongings, or any conduct the employee could perceive as humiliating. Be honest — this significantly affects your exposure.</p>
      <Sel on={d.badFaith === true} onClick={() => setD({ ...d, badFaith: true })}>Yes, there may have been issues</Sel>
      <Sel on={d.badFaith === false} onClick={() => setD({ ...d, badFaith: false })}>No, it was handled professionally</Sel>
    </Fade>}

    {d.empTermStatus === "planned" && <Fade delay={110}><div style={{ background: "rgba(10,107,92,.04)", borderRadius: 10, padding: "11px 14px", marginTop: 6, border: "1px solid rgba(10,107,92,.1)" }}>
      <p style={{ fontSize: 11, color: T, fontWeight: 600, margin: "0 0 3px" }}>Good. We'll include best practices for the meeting.</p>
      <p style={{ fontSize: 10.5, color: "var(--text-sec)", margin: 0, lineHeight: 1.4 }}>How you handle the termination matters as much as what you offer. Courts award additional damages for bad faith conduct during the process.</p>
    </div></Fade>}
  </div>;

  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 3 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>Your termination</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>These details affect how much you may be owed.</p></Fade>

    <Fade delay={25}><label style={QL}>Why were you let go?</label>{REASONS.map(r => <Sel key={r.id} on={d.reason === r.id} onClick={() => setD({ ...d, reason: r.id })} sub={r.i}>{r.l}</Sel>)}</Fade>
    {tenure < 3 && <Fade delay={50}><label style={{ ...QL, marginTop: 10 }}>Did they recruit you away from a previous job?</label><p style={QH}>Since you were there under 3 years, this matters. If they convinced you to leave a stable position and then let you go quickly, courts often award significantly more than your short tenure alone would suggest.</p><Sel on={d.induced === true} onClick={() => setD({ ...d, induced: true })}>Yes, I was recruited away</Sel><Sel on={d.induced === false} onClick={() => setD({ ...d, induced: false })}>No</Sel></Fade>}

    <Fade delay={75}><label style={{ ...QL, marginTop: 10 }}>Your employment contract</label><p style={QH}>Many contracts try to limit what you get. Courts throw them out more often than you'd expect.</p>
      <Sel on={d.hasContract === true} onClick={() => setD({ ...d, hasContract: true, contractTerms: false, contractAge: "" })}>I signed a written contract or offer letter</Sel>
      {d.hasContract === true && <div style={{ marginLeft: 24, borderLeft: "2px solid " + Tl, paddingLeft: 12, marginTop: 3, marginBottom: 6 }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 5px", lineHeight: 1.4 }}>Look for sections titled "Termination", "Notice", or "Severance" in your contract.</p>
        <Sel on={d.contractTerms === true} onClick={() => setD({ ...d, contractTerms: true })}>Yes, it mentions termination</Sel>
        {d.contractTerms === true && <div style={{ marginLeft: 20, borderLeft: "2px solid var(--border-light)", paddingLeft: 10, marginTop: 3, marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 5px", lineHeight: 1.4 }}><Whats tip="Older contracts are more likely to be enforceable because the employee had time to understand the terms. Newer contracts, especially in Ontario after the 2020 Waksdale decision, are more frequently struck down by courts for failing to comply with employment standards minimums. The timing helps estimate how much weight to give the termination clause.">When did you sign this contract?</Whats></p>
          <Sel on={d.contractAge === "recent"} onClick={() => setD({ ...d, contractAge: "recent" })}>In the last 3 years</Sel>
          <Sel on={d.contractAge === "old"} onClick={() => setD({ ...d, contractAge: "old" })}>More than 3 years ago</Sel>
          <Sel on={d.contractAge === "unsure"} onClick={() => setD({ ...d, contractAge: "unsure" })}>Not sure</Sel>
        </div>}
        <Sel on={d.contractTerms === false} onClick={() => setD({ ...d, contractTerms: false, contractAge: "" })}>No / can't tell</Sel>
      </div>}
      <Sel on={d.hasContract === false} onClick={() => setD({ ...d, hasContract: false, contractTerms: false, contractAge: "" })}>No written contract / not sure</Sel>
    </Fade>

    <Fade delay={100}><label style={{ ...QL, marginTop: 10 }}>Was the termination handled badly?</label><p style={QH}>Escorted out, humiliated, lied to, or announced to others before you were told. Courts can award extra damages.</p><Sel on={d.badFaith === true} onClick={() => setD({ ...d, badFaith: true })}>Yes</Sel><Sel on={d.badFaith === false} onClick={() => setD({ ...d, badFaith: false })}>No / reasonably handled</Sel></Fade>
  </div>;
}

function S4({ d, setD, mode }) {
  const E = mode === "employer";
  const QL = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" };
  const QH = { fontSize: 11, color: "var(--text-muted)", marginTop: 0, marginBottom: 7, lineHeight: 1.4 };

  if (E) return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 4 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>Risk factors & compliance</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>These details affect your legal risk and how we structure the guidance.</p></Fade>

    {(d.reason === "pf" || d.reason === "fc") && <Fade delay={25}><label style={QL}>Level of documentation</label><p style={QH}>For performance or cause-based terminations, documentation is critical. Courts examine whether the employee was given clear expectations, warnings, and an opportunity to improve.</p>
      <Sel on={d.empDocLevel === "pip"} onClick={() => setD({ ...d, empDocLevel: "pip" })} sub="Strongest position">Formal PIP with written outcomes</Sel>
      <Sel on={d.empDocLevel === "written"} onClick={() => setD({ ...d, empDocLevel: "written" })} sub="Helpful but may not be sufficient for cause">Written warnings on file</Sel>
      <Sel on={d.empDocLevel === "verbal"} onClick={() => setD({ ...d, empDocLevel: "verbal" })} sub="Difficult to prove in court">Verbal warnings only</Sel>
      <Sel on={d.empDocLevel === "none"} onClick={() => setD({ ...d, empDocLevel: "none" })} sub="Very high risk if claiming cause">No formal documentation</Sel>
    </Fade>}

    <Fade delay={50}><label style={{ ...QL, marginTop: 10 }}>Are there any human rights considerations?</label><p style={QH}>Terminating an employee who is pregnant, on disability leave, has a disability, recently filed a complaint, or is a member of a protected class significantly increases legal risk. Be honest, as this changes the analysis substantially.</p>
      <Sel on={d.empHumanRights === true} onClick={() => setD({ ...d, empHumanRights: true })} sub="Increases exposure and complexity">Yes, there may be human rights factors</Sel>
      <Sel on={d.empHumanRights === false} onClick={() => setD({ ...d, empHumanRights: false })}>No</Sel>
    </Fade>

    {d.empHumanRights === true && <Fade delay={55}><div style={{ background: "rgba(216,90,48,.06)", borderRadius: 10, padding: "11px 14px", marginBottom: 8, border: "1px solid rgba(216,90,48,.1)" }}>
      <p style={{ fontSize: 11, color: "var(--text-alert)", fontWeight: 600, margin: "0 0 3px" }}>This is a high-risk termination.</p>
      <p style={{ fontSize: 10.5, color: "var(--text-sec)", margin: 0, lineHeight: 1.4 }}>Terminations involving human rights factors (disability, pregnancy, age discrimination, reprisal for complaints) can result in human rights tribunal complaints with uncapped general damages, in addition to wrongful dismissal claims. Consult employment counsel before proceeding.</p>
    </div></Fade>}

    <Fade delay={75}><label style={{ ...QL, marginTop: 10 }}>Is this part of a group termination?</label><p style={QH}>In Ontario, terminating 50+ employees in a 4-week period triggers mass termination provisions with longer notice requirements. Other provinces have similar thresholds.</p>
      <Sel on={d.empGroupTerm === true} onClick={() => setD({ ...d, empGroupTerm: true })} sub="Additional statutory requirements may apply">Yes, multiple employees affected</Sel>
      <Sel on={d.empGroupTerm === false} onClick={() => setD({ ...d, empGroupTerm: false })}>No, individual termination</Sel>
    </Fade>

    <Fade delay={100}><label style={{ ...QL, marginTop: 10 }}>Non-compete or non-solicitation clause?</label><p style={QH}>If the employee has a restrictive covenant, it can be used as a negotiation tool. Many are unenforceable in Canada, but they still have value in structuring a clean exit.</p>
      <Sel on={d.nonCompete === true} onClick={() => setD({ ...d, nonCompete: true })}>Yes, there is a restrictive covenant</Sel>
      <Sel on={d.nonCompete === false} onClick={() => setD({ ...d, nonCompete: false })}>No</Sel>
    </Fade>

    <Fade delay={125}><label style={{ ...QL, marginTop: 10 }}>Employee benefits</label><p style={QH}>Select all that the employee currently receives. Benefits continuation is a standard component of severance packages and affects total cost.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{BENS.map(b => { const on = (d.bens || []).includes(b.id); return <Pill key={b.id} on={on} onClick={() => { const c = d.bens || []; setD({ ...d, bens: on ? c.filter(x => x !== b.id) : [...c, b.id] }); }}>{b.l}</Pill>; })}</div>
    </Fade>
  </div>;

  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 4 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>Your situation</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>A few more details that affect your position.</p></Fade>

    <Fade delay={25}><label style={QL}>Have you signed a release?</label><p style={QH}>A release is where you give up your right to sue in exchange for the severance. This is critical.</p><Sel on={d.signedRelease === true} onClick={() => setD({ ...d, signedRelease: true })} sub="May limit options, but can sometimes be undone">Already signed</Sel><Sel on={d.signedRelease === false} onClick={() => setD({ ...d, signedRelease: false })}>Not yet</Sel></Fade>

    <Fade delay={50}><label style={{ ...QL, marginTop: 10 }}>Have you found new work?</label><Sel on={d.newJob === "yes"} onClick={() => setD({ ...d, newJob: "yes" })} sub="Reduces notice, but you're still owed the difference">Yes</Sel><Sel on={d.newJob === "looking"} onClick={() => setD({ ...d, newJob: "looking" })}>Actively looking</Sel><Sel on={d.newJob === "no"} onClick={() => setD({ ...d, newJob: "no" })}>Not yet</Sel></Fade>

    <Fade delay={75}><label style={{ ...QL, marginTop: 10 }}>Non-compete or non-solicit clause?</label><Sel on={d.nonCompete === true} onClick={() => setD({ ...d, nonCompete: true })} sub="Many are unenforceable in Canada">Yes</Sel><Sel on={d.nonCompete === false} onClick={() => setD({ ...d, nonCompete: false })}>No / not sure</Sel></Fade>

    <Fade delay={100}><label style={{ ...QL, marginTop: 10 }}>Benefits while employed</label><p style={QH}>Select all that apply. We'll explain what happens to each one.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{BENS.map(b => { const on = (d.bens || []).includes(b.id); return <Pill key={b.id} on={on} onClick={() => { const c = d.bens || []; setD({ ...d, bens: on ? c.filter(x => x !== b.id) : [...c, b.id] }); }}>{b.l}</Pill>; })}</div></Fade>
  </div>;
}

function S5({ d, setD, mode }) {
  const E = mode === "employer";
  return <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 20px" }}>
    <Fade><p style={{ fontSize: 10, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{"Step 5 of " + TS}</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px" }}>{E ? "Your planned offer" : "Your severance offer"}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>{E ? "If you've drafted a severance package, we'll assess it against the exposure range." : "If you've received a severance package, we'll compare it and draft a response."}</p></Fade>
    <Fade delay={30}><Sel on={d.hasOffer === true} onClick={() => setD({ ...d, hasOffer: true })}>{E ? "Yes, we have a planned offer" : "Yes, I've received a severance offer"}</Sel><Sel on={d.hasOffer === false} onClick={() => setD({ ...d, hasOffer: false })}>{E ? "No, we need guidance on the amount" : "No offer yet"}</Sel></Fade>
    {d.hasOffer === true && <Fade delay={60}><div style={{ marginTop: 6 }}><Tog opts={[{ v: "amt", l: "$ Amount" }, { v: "wks", l: "Weeks" }, { v: "mos", l: "Months" }]} val={d.offFmt} onChange={v => setD({ ...d, offFmt: v })} />
      {d.offFmt === "amt" && <Fld type="number" value={d.offAmt} onChange={v => setD({ ...d, offAmt: v })} prefix="$" placeholder="e.g. 45000" />}
      {d.offFmt === "wks" && <Fld type="number" value={d.offWks} onChange={v => setD({ ...d, offWks: v })} placeholder="e.g. 12" suffix="weeks" />}
      {d.offFmt === "mos" && <Fld type="number" value={d.offMos} onChange={v => setD({ ...d, offMos: v })} placeholder="e.g. 3" suffix="months" />}
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Deadline to accept?</label>
      <Sel on={d.deadline === true} onClick={() => setD({ ...d, deadline: true })}>Yes</Sel><Sel on={d.deadline === false} onClick={() => setD({ ...d, deadline: false, deadlineDays: "" })}>No</Sel>
      {d.deadline === true && <Fld label="Days remaining" type="number" value={d.deadlineDays} onChange={v => setD({ ...d, deadlineDays: v })} placeholder="e.g. 7" suffix="days" help="Under 7 days is a red flag." />}
    </div></Fade>}
    {d.hasOffer === false && <Fade delay={60}><div style={{ marginTop: 6, background: "var(--bg-warning)", borderRadius: 10, padding: "11px 14px", fontSize: 12, color: "var(--text-warning)", lineHeight: 1.45 }}>{E ? "We'll show you the full exposure range so you can structure a defensible package." : "We'll show you the full range so you're prepared."}</div></Fade>}
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
  rpt += "   Reason: " + ((REASONS.find(x => x.id === r.reason) || EMP_REASONS.find(x => x.id === r.reason) || {}).l || "Not specified") + "\n";
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
  if (r.salTier) rpt += "     Compensation band uplift: +6-12% (TC exceeds $300,000)\n";
  if (r.civil) rpt += "     NOTE: Quebec civil law jurisdiction. Art. 2091 C.c.Q. applies.\n";
  if (r.off !== null) {
    rpt += "\n5. OFFER ANALYSIS\n";
    rpt += "   Offer: " + $(r.off) + " (" + r.offMo + " months equivalent)\n";
    rpt += "   vs. statutory floor: " + (r.off >= r.esaAmt ? "ABOVE" : "BELOW \u2014 NON-COMPLIANT") + "\n";
    rpt += "   vs. CL midpoint: " + (r.off >= r.cMA ? "at or above" : $(r.cMA - r.off) + " below") + "\n";
    rpt += "   Assessment: " + (r.off < r.esaAmt ? "Below statutory minimum. Strong position." : r.off < r.cLA ? "Below common law range. Strong negotiation position." : r.off < r.cMA ? "Below midpoint. Room to negotiate." : "At or above midpoint.") + "\n";
  }
  if (r.ujd) { rpt += "\n   UNJUST DISMISSAL\n"; rpt += "   " + r.ujd.statute + "\n"; rpt += "   Client meets the " + r.ujd.threshold + " threshold. Unjust dismissal complaint may be available.\n"; rpt += "   Remedies may include reinstatement and back pay. Assess as alternative or parallel track.\n"; }
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

/* ═══════════════════ STRATEGY MEMO ═══════════════════ */
function buildMemo(r) {
  const m = [];
  const title = r.jt || r.rl;
  const hasOffer = r.off !== null;
  const offerMo = r.offMo || 0;
  const gap = hasOffer ? r.cMA - r.off : 0;

  // Block 1: Position summary
  let pos = "You are " + ((/^[aeiou]/i.test(title) ? "an " : "a ") + title) + ", age " + r.age + ", with " + r.yrs + " years of service in " + (r.industry || "your industry") + " under " + r.pn + " jurisdiction. Your total annual compensation is " + $(r.tc) + (r.bonus > 0 ? " (including " + $(r.bonus) + " in variable pay)" : "") + ".";
  if (hasOffer) pos += " Your employer has offered " + $(r.off) + ", which represents approximately " + offerMo + " months of compensation.";
  else pos += " You have not yet received a severance offer, which means you have the advantage of setting the anchor.";
  pos += " Based on the statutory framework and common law factors, a court would likely award between " + r.cL + " and " + r.cH + " months, with a midpoint of " + r.cM + " months (" + $(r.cMA) + ").";
  if (r.reason === "fc") pos += " These figures assume cause is not established, which is the most common outcome when for-cause terminations are challenged.";
  m.push({ t: "Your position", body: pos });

  // Block 1B: For-cause specific guidance
  if (r.reason === "fc") {
    let fc = "Your employer is claiming just cause for termination. This is a serious allegation, but it is important to understand what it actually means and how rarely it succeeds.\n\n";
    fc += "In Canadian law, just cause is the highest standard an employer must meet. It requires the employer to prove that your conduct was so fundamentally incompatible with the employment relationship that no amount of warning, retraining, or progressive discipline could have addressed it. Courts have described it as the \"capital punishment\" of employment law.\n\n";
    fc += "The burden of proof is entirely on the employer. You do not need to prove your innocence. They need to prove the conduct, that it was serious enough to warrant termination without notice, and that they acted proportionally.\n\n";
    fc += "There is also an important distinction between common law cause and statutory misconduct. If your employer proves just cause at common law, you lose your entitlement to common law reasonable notice. However, you may still be entitled to statutory termination pay under " + r.esa + " unless the conduct rises to \"willful misconduct, disobedience or willful neglect of duty,\" which is a higher threshold. Many employees who lose the common law argument still receive statutory minimums.\n\n";
    fc += "What to do immediately:\n\u2022 Do not accept the characterization. Do not sign anything.\n\u2022 Request the employer's written reasons for the for-cause determination in detail.\n\u2022 Gather any documentation that supports your position: emails, performance reviews, communications showing the employer's awareness and tolerance of the conduct.\n\u2022 Consult an employment lawyer as soon as possible. Time limits may apply for filing complaints.";
    m.push({ t: "Understanding the for-cause claim", body: fc });
  }

  // Block 2: Leverage points
  const lev = [];
  if (r.yrs >= 10) lev.push("Length of service is the single strongest factor in reasonable notice calculations. With " + r.yrs + " years, you are in the upper range. Courts will weigh this heavily in your favour.");
  else if (r.yrs >= 5) lev.push("Your " + r.yrs + " years of service provides a solid foundation for your claim. This is enough tenure that courts will give it meaningful weight.");
  if (r.age >= 55) lev.push("At " + r.age + ", courts consistently award longer notice periods because re-employment becomes significantly harder. This is one of your strongest factors. Do not let your employer minimize it.");
  else if (r.age >= 45) lev.push("At " + r.age + ", you fall in the age range where courts begin to add meaningful weight. The difficulty of finding a comparable role at your level and age works in your favour.");
  if (r.ind) lev.push("You were recruited away from a stable position. Courts treat this seriously. When an employer induces someone to leave secure employment and then terminates them quickly, the notice period is often significantly higher than the short tenure alone would suggest. Raise this explicitly in your negotiation.");
  if (r.bf) lev.push("The manner of your termination appears to have fallen below the standard of good faith and fair dealing. Courts have awarded additional damages in cases involving humiliation, dishonesty, or callous conduct during termination. This is separate from the notice period and gives you an additional claim.");
  if (r.rl === "Management / senior leadership" || r.rl === "Executive / C-suite") lev.push("Your seniority level matters. Courts recognize that senior roles take longer to replace and that comparable positions are scarcer. This pushes the notice period higher than tenure alone would suggest.");
  if (r.ci && r.ci.m < 1 && r.prov === "ON") lev.push("Your employment contract contains a termination clause, but it was signed in Ontario where the 2020 Waksdale decision has invalidated many such clauses. If the clause fails to comply with ESA minimums in any respect, it may be void entirely, entitling you to common law notice. This is a significant vulnerability for your employer.");
  if (!r.hasContract) lev.push("You have no written employment contract limiting your termination entitlements. This means you are entitled to common law reasonable notice, which is almost always more generous than statutory minimums.");
  if (r.newJob === "no") lev.push("You have not yet found new employment. During the reasonable notice period, your employer bears the economic risk if you remain unemployed. This is not a weakness. It means the full notice period applies without any mitigation discount.");
  if (r.vd > 0) lev.push("You have " + r.vd + " accrued vacation days worth approximately " + $(r.vp) + ". Your employer must pay these out regardless of any severance negotiation. This is a separate entitlement.");
  if (r.ujd) lev.push("You may have access to an unjust dismissal claim under " + r.ujd.statute + ". This is a separate avenue that can lead to reinstatement or compensation beyond the standard severance calculation. Mention this to your lawyer.");
  if (r.reason === "fc") lev.push("Your employer bears the entire burden of proving just cause. Canadian courts reject the majority of for-cause claims. If they cannot meet this very high bar, you are entitled to full common law notice as if you had been terminated without cause. This is significant leverage.");
  if (lev.length > 0) m.push({ t: "Your leverage points", body: lev.join("\n\n") });

  // Block 3: Risk factors
  const risk = [];
  if (r.yrs < 2) risk.push("Your tenure is under 2 years. This limits the baseline range. Courts still award reasonable notice for short-tenure employees, but the months will be lower than someone with 10+ years. If you were induced to leave a prior role, lead with that instead of tenure.");
  if (r.sr) risk.push("You have already signed a release. This is the most significant risk factor in your situation. A release is a contract where you gave up your right to sue in exchange for the offered severance. However, releases can be set aside in certain circumstances: if you signed under duress, without independent legal advice, without adequate consideration, or if the release does not comply with ESA minimums. Consult a lawyer urgently to assess enforceability.");
  if (r.newJob === "yes") risk.push("You have already found new employment. This will reduce the effective notice period through mitigation. However, you are still entitled to damages for any gap, and the difference between your old and new compensation may also be recoverable for the balance of the notice period.");
  if (r.ci && r.ci.m < 1 && r.prov !== "ON") risk.push("Your employment contract contains a termination clause. Outside Ontario, courts are generally more willing to enforce well-drafted termination clauses. A lawyer should review whether the clause meets statutory minimums and is otherwise enforceable.");
  if (r.nc) risk.push("You are subject to a non-compete or non-solicitation clause. Many such clauses are unenforceable in Canada because they are overly broad in scope, geography, or duration. However, you should have a lawyer review the specific language before assuming you can ignore it. In some cases, the existence of a restrictive covenant can be leveraged in severance negotiations: you can argue for additional compensation in exchange for honouring the restriction.");
  if (risk.length > 0) m.push({ t: "Risk factors to manage", body: risk.join("\n\n") });

  // Block 4: What your employer will likely do
  const emp = [];
  emp.push("Employers follow a predictable playbook in severance negotiations. Knowing what to expect removes the element of surprise and keeps you in control.");
  if (r.dl) emp.push("Your employer has set a signing deadline" + (r.dlDays ? " of " + r.dlDays + " days" : "") + ". This is a pressure tactic, not a legal requirement. You are not obligated to sign by any arbitrary deadline. If the deadline is under 14 days, say: \"I need adequate time to review this with independent legal advice. I expect the deadline to be extended.\" Most employers will comply because a court would view an unreasonable deadline unfavourably.");
  else emp.push("Even if no deadline has been set, expect your employer to create urgency. They may say the offer is \"only available for a limited time\" or that it's \"the best they can do.\" Neither is typically true. First offers are opening positions, not final ones.");
  emp.push("If you counter, your employer may say they need to \"check with HR\" or \"run it up the chain.\" This is standard. Do not interpret a delay as a rejection. It means your counter is being considered.");
  emp.push("If they threaten to withdraw the offer entirely, do not panic. Withdrawing a severance offer exposes the employer to a wrongful dismissal claim where the court determines the notice period. Most employers know this. The threat is leverage, not action.");
  m.push({ t: "What to expect from your employer", body: emp.join("\n\n") });

  // Block 5: Your first move
  const move = [];
  if (r.reason === "fc") {
    move.push("Your first move is not to negotiate. It is to protect your position. A for-cause termination is fundamentally different from a standard severance discussion.");
    move.push("Step 1: Do not respond to the for-cause allegation verbally. Request a detailed written explanation of the grounds for cause. You are entitled to know exactly what conduct they are relying on.");
    move.push("Step 2: Gather your evidence. Pull together any performance reviews, emails, communications, or records that contradict the employer's characterization. If they are alleging poor performance but you have positive reviews from the last two years, that is your strongest evidence.");
    move.push("Step 3: Consult an employment lawyer before you say anything further to the employer. A for-cause termination that fails in court entitles you to full common law notice, and potentially additional damages if the for-cause allegation was made in bad faith. Your lawyer will advise whether to challenge the cause determination, negotiate a without-cause package, or pursue litigation.");
    move.push("Do not accept any severance offer connected to a for-cause termination without legal advice. The amount offered is often far below what you would receive if cause is not established.");
  } else if (!hasOffer) {
    move.push("You have not received an offer yet. This is an advantage. The first number in a negotiation sets the anchor, and everything that follows revolves around it.");
    move.push("Lead with your strongest factors: " + (r.yrs >= 8 ? "your long tenure" : r.age >= 45 ? "your age and the difficulty of re-employment" : r.ind ? "the fact that you were induced to leave stable employment" : "your role level and the time it will take to find a comparable position") + ". State that based on your research into common law entitlements, you expect a severance package in the range of " + r.cM + " to " + r.cH + " months of total compensation.");
    move.push("Do not explain how you arrived at the number. Simply state it as your expectation. The burden is on the employer to justify why it should be lower.");
  } else if (r.off < r.esaAmt) {
    move.push("Your employer's offer is below the statutory minimum. This is non-compliance with " + r.esa + ". You have the strongest possible position.");
    move.push("Your opening should be direct: \"The offer of " + $(r.off) + " does not meet the minimum requirements under " + r.esa + ". I expect a revised offer that reflects both the statutory entitlements and common law reasonable notice. Based on my circumstances, I believe " + r.cH + " months (" + $(r.cHA) + ") is appropriate.\"");
    move.push("Do not soften this message. Below-statutory offers indicate either incompetence or bad faith on the employer's part. Either way, you have significant leverage.");
  } else if (r.off < r.cLA) {
    move.push("Your employer's offer of " + $(r.off) + " is above the statutory floor but below the range a court would likely award. The gap between the offer and the midpoint is " + $(gap) + ". This is substantial.");
    move.push("Acknowledge receipt of the offer without accepting it. Then state: \"I have reviewed the offer in light of my entitlements under common law. Considering my tenure, age, role, and the current job market for comparable positions, I believe a package of " + r.cM + " to " + r.cH + " months of total compensation is appropriate. I would like to discuss reaching a fair resolution.\"");
  } else if (r.off < r.cMA) {
    move.push("Your employer's offer of " + $(r.off) + " is within the range but below the midpoint. The gap is " + $(gap) + ". You have room to negotiate but your leverage is more moderate.");
    move.push("Rather than pushing hard on the dollar amount alone, consider a combined approach. Ask for the dollar amount to be increased to the midpoint (" + $(r.cMA) + "), and simultaneously negotiate for: continuation of benefits for the full notice period, pro-rated bonus payment, a positive reference letter with agreed language, and release of any non-compete obligations.");
  } else {
    move.push("Your employer's offer is at or near the midpoint of the estimated court range. Pushing significantly higher on the dollar amount may not be realistic unless you have strong aggravating factors.");
    move.push("Focus your negotiation on non-monetary terms: extended benefits coverage, bonus proration, agreed reference letter language, outplacement services, non-compete release, and the structure of the payment (lump sum vs. salary continuation for tax purposes). These items cost the employer less than cash but can be worth thousands to you.");
  }
  m.push({ t: "Your first move", body: move.join("\n\n") });

  // Block 6: What to say and what not to say
  const say = [];
  say.push("DO:\n\u2022 Take time. Say \"I need to review this carefully\" and leave the room.\n\u2022 Put everything in writing. Email is better than phone for negotiation.\n\u2022 Reference \"common law entitlements\" and \"reasonable notice.\" These are legal terms that signal you know your rights.\n\u2022 Be professional and factual. Emotion undermines your position.");
  say.push("DO NOT:\n\u2022 Never say \"I accept\" or \"that sounds reasonable\" in the first meeting.\n\u2022 Never disclose whether you are looking for work or have found a new job. This is mitigation information that can reduce your entitlement.\n\u2022 Never acknowledge that the statutory minimum has been met, even if it has. You are negotiating for common law notice, not the floor.\n\u2022 Never threaten to sue unless you mean it and have a lawyer. Empty threats weaken your position.\n\u2022 Never sign anything on the spot. There is no legal requirement to do so.");
  if (r.ind) say.push("MENTION SPECIFICALLY: You were recruited away from stable employment. Say: \"I left a secure position at [previous employer] based on representations made during the hiring process. Courts treat induced employees differently and I expect the severance package to reflect that.\"");
  if (r.bf) say.push("MENTION SPECIFICALLY: The manner of dismissal. Say: \"The way the termination was handled fell below the standard I would expect. I have documented the circumstances and believe this is relevant to the overall discussion.\" Do not elaborate further in the first round. Let them worry about what you documented.");
  if (r.reason === "fc") say.push("FOR-CAUSE SPECIFIC:\n\u2022 Do not admit to or apologize for the alleged conduct, even informally.\n\u2022 Do not discuss the details of the allegation with colleagues. What you say to coworkers can be used as evidence.\n\u2022 If the employer asks you to attend an \"investigation meeting,\" you have the right to bring a representative or ask for questions in writing.\n\u2022 Preserve all documents, emails, and communications. Do not delete anything from your work accounts if you still have access.");
  m.push({ t: "What to say and what not to say", body: say.join("\n\n") });

  // Block 7: Timeline
  let tl = "DAYS 1\u20133: Do not sign anything. Read your termination letter and any release document carefully. Note every clause. Run this analysis.\n\n";
  tl += "DAYS 3\u20137: Identify your leverage points (listed above). Decide whether to negotiate yourself or hire a lawyer. If the gap between the offer and the midpoint exceeds $25,000, or if you signed a release, a lawyer's involvement likely pays for itself.\n\n";
  tl += "DAYS 7\u201314: Send your counter-offer in writing. Use the negotiation letter generated by this tool as a starting point, edited in your own voice. Send it by email so there is a paper trail.\n\n";
  tl += "DAYS 14\u201321: If no response, follow up once: \"I wanted to confirm you received my letter and ask when I can expect a response.\" One follow-up is professional. Multiple follow-ups signal desperation.\n\n";
  tl += "DAYS 21\u201330: If no resolution, consult an employment lawyer. Most offer a free or low-cost initial consultation. Bring the lawyer report generated by this tool.";
  if (r.sr) tl = "URGENT: You have signed a release. The timeline below is compressed. Consult an employment lawyer within the next 48 hours to assess enforceability. Bring the signed release, the termination letter, and the lawyer report from this tool.\n\n" + tl;
  if (r.dl && parseInt(r.dlDays) <= 7) tl = "NOTE: Your signing deadline is " + r.dlDays + " days, which is unusually short. Request an extension immediately before doing anything else. Say: \"I require additional time to review the offer with independent legal counsel.\" Then follow the timeline below.\n\n" + tl;
  m.push({ t: "Your timeline", body: tl });

  // Block 8: When to hire a lawyer
  let law = "";
  if (r.reason === "fc") law = "Yes. A for-cause termination is one of the most consequential situations in employment law. Your employer is attempting to avoid paying any severance by alleging serious misconduct. You need a lawyer who specializes in wrongful dismissal to assess the strength of the employer's claim, advise on whether to challenge it, and determine the full range of your entitlements if cause is not established. Do not attempt to negotiate a for-cause termination on your own.";
  else if (r.off !== null && r.off < r.esaAmt) law = "Your offer is below the statutory minimum. This is non-compliance. A lawyer can resolve this quickly, often with a single letter, and the outcome should significantly exceed the cost.";
  else if (r.sr) law = "You signed a release. Whether it can be set aside depends on specific legal analysis. This is not something to navigate alone. A lawyer's assessment is critical and time-sensitive.";
  else if (r.ujd) law = "You may have an unjust dismissal claim under " + r.ujd.statute + ". This is a specialized area of law with strict procedural requirements and time limits. You need a lawyer who handles these claims specifically.";
  else if (gap > 50000) law = "The gap between your offer and the court midpoint is " + $(gap) + ". At this level, a lawyer's fee (typically $3,000\u2013$8,000 for a negotiation) is a small fraction of the potential recovery. The ROI is clear.";
  else if (gap > 20000) law = "The gap between your offer and the court midpoint is " + $(gap) + ". A lawyer's involvement would likely pay for itself. Most employment lawyers offer free initial consultations, so there is no cost to getting an opinion.";
  else if (!hasOffer) law = "You have not received an offer yet. If the offer, when it comes, is within the range this tool estimates, you can likely handle the first round of negotiation yourself using the letter and guidance above. If it comes in significantly below, consult a lawyer.";
  else law = "Your offer is within a reasonable range. You can likely negotiate the first round yourself using the letter and guidance above. If the employer refuses to move, or if the process becomes adversarial, a lawyer can step in at that point.";
  law += "\n\nMost employment lawyers offer a free or low-cost initial consultation (30\u201360 minutes). Bring the lawyer intake report generated by this tool. It saves them time, which saves you money.";
  m.push({ t: "Do you need a lawyer?", body: law });

  return m;
}

/* ═══════════════════ RESULTS ═══════════════════ */
function Res({ res, onReset, dark, setDark, mode, onLogoClick }) {
  const [eml, setEml] = useState(false);
  const [lrpt, setLrpt] = useState(false);
  const [chk, setChk] = useState(false);
  const [ben, setBen] = useState(false);
  const [docs, setDocs] = useState(false);
  const [cp, setCp] = useState(null);
  const [fb, setFb] = useState(null);
  const [memo, setMemo] = useState(false);
  const [printView, setPrintView] = useState(false);
  const bars = useMemo(() => {
    const E = mode === "employer";
    const it = [{ l: E ? "Statutory minimum" : "Legal floor", a: res.esaAmt, c: "#D3D1C7", tc: "var(--text-sec)" }, { l: E ? "Court exposure (low)" : "Court award (low)", a: res.cLA, c: Tl, tc: Td }, { l: E ? "Court exposure (mid)" : "Court award (mid)", a: res.cMA, c: T, tc: T }, { l: E ? "Court exposure (high)" : "Court award (high)", a: res.cHA, c: Td, tc: Td }];
    if (res.off !== null) { const c = res.off < res.cLA ? "#D85A30" : res.off < res.cMA ? "#BA7517" : T; it.push({ l: E ? "Planned offer" : "Your offer", a: res.off, c, tc: c }); }
    return it;
  }, [res]);
  const asmnt = useMemo(() => {
    if (res.off === null) return null;
    const E = mode === "employer";
    if (res.off < res.esaAmt) return { l: E ? "Below statutory minimum" : "Below the legal minimum", c: "#993C1D", bg: "rgba(216,90,48,.07)", d: E ? "This offer does not meet the legal floor. Presenting it exposes you to an employment standards complaint." : "This offer is below what the law requires. Strong grounds to push back.", i: "!" };
    if (res.off < res.cLA) return { l: E ? "Below court range" : "Below what courts typically award", c: "#993C1D", bg: "rgba(216,90,48,.07)", d: E ? "Above the statutory floor but below what a court would likely award. High litigation risk at this level." : "Above the legal minimum, but below what a court would likely give you. Significant room to negotiate.", i: "!" };
    if (res.off < res.cMA) return { l: E ? "Below midpoint" : "In the range, but below midpoint", c: "#854F0B", bg: "rgba(186,117,23,.07)", d: E ? "Within the range but below the midpoint. Moderate litigation risk. Consider increasing to the midpoint." : "You're in the ballpark, but there's room to do better.", i: "~" };
    if (res.off < res.cHA) return { l: E ? "Defensible offer" : "Solid offer", c: T, bg: "rgba(10,107,92,.05)", d: E ? "At or above the midpoint. Low litigation risk. Most employees would accept this range." : "In the upper range of what courts typically award.", i: "\u2713" };
    return { l: E ? "Above typical range" : "Above typical range", c: T, bg: "rgba(10,107,92,.05)", d: E ? "Exceeds what courts would likely award. Very low litigation risk." : "Meets or exceeds what courts would likely award.", i: "\u2713" };
  }, [res, mode]);
  const email = useMemo(() => buildEmail(res), [res]);
  const lawyerRpt = useMemo(() => buildLawyerReport(res), [res]);
  const roi = useMemo(() => { const f = Math.max(3000, Math.round(res.cMA * .08)), u = res.off !== null ? res.cMA - res.off : Math.round(res.cMA * .4); return u - f > 0 ? { f, u, r: Math.round(u / f * 10) / 10 } : null; }, [res]);
  function copy(t, l) { try { navigator.clipboard.writeText(t); setCp(l); trk("content_copied", { type: l === "e" ? "letter" : l === "lr" ? "lawyer_report" : l === "memo" ? "strategy_memo" : "summary" }); setTimeout(() => setCp(null), 2000); } catch (e) {} }
  const selBens = (res.bens || []).map(id => BENS.find(b => b.id === id)).filter(Boolean);

  const pdfRef = useRef(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  function downloadPdf() {
    if (!pdfRef.current || pdfLoading) return;
    setPdfLoading(true);
    const opt = {
      margin: [10, 10, 10, 10],
      filename: "parachute-severance-analysis.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true, backgroundColor: "#ffffff", logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"], avoid: [".pdf-section", ".pdf-row", ".pdf-card", ".pdf-strategy"] }
    };
    html2pdf().set(opt).from(pdfRef.current).save().then(() => { setPdfLoading(false); trk("pdf_downloaded"); }).catch(() => setPdfLoading(false));
  }

  if (printView) {
    const E = mode === "employer";
    const R = ({ k, v, accent, alert: al }) => <div className="pdf-row" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12.5, borderBottom: "1px solid var(--border-lighter)" }}><span style={{ color: "var(--text-muted)" }}>{k}</span><span style={{ fontWeight: 500, color: al ? "#993C1D" : accent ? T : "var(--text)", textAlign: "right", maxWidth: "60%" }}>{v}</span></div>;
    const Sec = ({ n, title, children }) => <div className="pdf-section" style={{ marginBottom: 20 }}><p style={{ fontSize: 11, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 8px", paddingBottom: 4, borderBottom: "2px solid " + Tl }}>{n}. {title}</p>{children}</div>;
    const verdictColor = !asmnt ? T : asmnt.c;
    const verdictBg = !asmnt ? "rgba(10,107,92,.05)" : asmnt.bg;
    const barMax = Math.max(...bars.map(b => b.a), 1);

    return <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px", fontFamily: "Georgia, serif", color: "var(--text)", lineHeight: 1.6, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setPrintView(false)} style={{ background: T, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{"\u2190"} Back to results</button>
        <button onClick={downloadPdf} disabled={pdfLoading} style={{ background: "#333", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: pdfLoading ? "wait" : "pointer", opacity: pdfLoading ? .6 : 1 }}>{pdfLoading ? "Generating..." : "\u2193 Download PDF"}</button>
      </div>

      <div ref={pdfRef} style={{ background: "#ffffff", padding: "24px", color: "#1A1A18", "--bg-card": "#ffffff", "--bg-subtle": "#FAFAF7", "--bg-muted": "#F1EFE8", "--text": "#1A1A18", "--text-sec": "#5F5E5A", "--text-muted": "#888", "--text-dim": "#999", "--text-faint": "#B4B2A9", "--text-alert": "#993C1D", "--text-alert-dark": "#712B13", "--text-warning": "#854F0B", "--bg-warning": "#FFF8E7", "--border-warning": "#F0E6C8", "--border": "#D3D1C7", "--border-light": "#E8E6E0", "--border-lighter": "#F1EFE8" }}>
        <div style={{ background: "#333", color: "#fff", padding: "20px 24px", borderRadius: 10, marginBottom: 20 }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 4px" }}>{E ? "Confidential" : "Privileged & confidential"}</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 2px" }}>{E ? "Termination Exposure Analysis" : "Severance Analysis"}</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)", margin: 0 }}>Prepared by Parachute | {res.pn} | {res.jt || res.rl}, age {res.age}, {res.yrs}y tenure</p>
        </div>

        <div className="pdf-section" style={{ marginBottom: 24, padding: "18px 20px", borderRadius: 10, border: "2px solid " + T, background: "rgba(10,107,92,.02)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: T, textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 12px" }}>Executive summary</p>
          {asmnt && <div style={{ display: "flex", gap: 10, marginBottom: 14, padding: "10px 12px", borderRadius: 8, background: verdictBg }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: verdictColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 13, fontWeight: 700 }}>{asmnt.i}</div>
            <div><p style={{ fontSize: 12.5, fontWeight: 600, color: verdictColor, margin: "0 0 2px" }}>{asmnt.l}</p><p style={{ fontSize: 11, color: "var(--text-sec)", margin: 0, lineHeight: 1.4 }}>{asmnt.d}</p></div>
          </div>}
          {!asmnt && <p style={{ fontSize: 12, color: "var(--text-sec)", margin: "0 0 14px" }}>{E ? "No planned offer entered. The full exposure range is shown below." : "No offer provided. The full estimated range is shown below."}</p>}

          <div className="pdf-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-light)" }}>
              <p style={{ fontSize: 9, color: "var(--text-muted)", margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600 }}>{E ? "Statutory minimum" : "Legal floor"}</p>
              <p style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1px" }}>{$(res.esaAmt)}</p>
              <p style={{ fontSize: 10, color: "var(--text-faint)", margin: 0 }}>{res.totW} weeks statutory</p>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 8, border: "2px solid " + T, background: "rgba(10,107,92,.03)" }}>
              <p style={{ fontSize: 9, color: T, margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600 }}>{E ? "Court exposure (mid)" : "Court award (mid)"}</p>
              <p style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1px", color: T }}>{$(res.cMA)}</p>
              <p style={{ fontSize: 10, color: "var(--text-faint)", margin: 0 }}>{res.cM} months common law</p>
            </div>
          </div>

          <div>{bars.map((b, i) => <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 2 }}>
              <span style={{ color: "var(--text-sec)", fontWeight: 500 }}>{b.l}</span>
              <span style={{ fontWeight: 600, color: b.tc || "var(--text)" }}>{$(b.a)}</span>
            </div>
            <div style={{ background: "var(--bg-muted)", borderRadius: 4, height: 16, overflow: "hidden" }}>
              <div style={{ width: (b.a / barMax * 100) + "%", height: "100%", background: b.c, borderRadius: 4 }} />
            </div>
          </div>)}</div>
        </div>

        {res.ujd && <div className="pdf-section" style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 8, background: E ? "rgba(216,90,48,.04)" : "rgba(10,107,92,.04)", border: E ? "1.5px solid rgba(216,90,48,.12)" : "1.5px solid rgba(10,107,92,.2)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: E ? "#993C1D" : T, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".04em" }}>{E ? "Unjust dismissal exposure" : "Unjust dismissal claim available"}</p>
          <p style={{ fontSize: 12, color: "var(--text-sec)", margin: "0 0 6px", lineHeight: 1.5 }}>{E ? "This employee may be eligible for an unjust dismissal complaint under " + res.ujd.statute + ". This can result in reinstatement or additional compensation beyond severance." : res.ujd.remedy}</p>
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: 0 }}>Statutory basis: {res.ujd.statute}</p>
        </div>}

        <Sec n={1} title={E ? "Employee profile" : "Client profile"}>
          <R k="Age" v={res.age + ""} /><R k="Title" v={res.jt || res.rl} /><R k="Industry" v={res.industry || "Not specified"} />
          <R k="Tenure" v={res.yrs + " years"} /><R k="Base salary" v={$(res.sal)} />
          {res.bonus > 0 && <R k="Variable compensation" v={$(res.bonus)} />}
          <R k="Total compensation" v={$(res.tc)} accent />
          <R k="Role level" v={res.rl} />
          {res.vd > 0 && <R k="Accrued vacation" v={res.vd + " days (" + $(res.vp) + ")"} />}
        </Sec>

        <Sec n={2} title="Termination details">
          <R k="Jurisdiction" v={res.pn + " (" + res.esa + ")"} />
          <R k="Reason" v={(REASONS.find(x => x.id === res.reason) || EMP_REASONS.find(x => x.id === res.reason) || {}).l || ""} />
          <R k="Inducement" v={res.ind ? "Yes \u2014 recruited from prior position" : "No"} />
          <R k={E ? "Bad faith in manner" : "Bad faith in manner"} v={res.bf ? "YES \u2014 improper conduct reported" : "Not reported"} alert={res.bf} />
          {!E && <R k="Release signed" v={res.sr ? "YES \u2014 ASSESS ENFORCEABILITY" : "No"} alert={res.sr} />}
          <R k="New employment" v={res.newJob === "yes" ? "Secured" : res.newJob === "looking" ? "Searching" : "Not yet"} />
          <R k="Non-compete/non-solicit" v={res.nc ? "Yes \u2014 review enforceability" : "No"} />
          {E && res.empHR && <R k="Human rights factors" v="YES \u2014 HIGH RISK" alert />}
          {E && res.empGroup && <R k="Group termination" v="Yes \u2014 review mass termination provisions" alert />}
        </Sec>

        <Sec n={3} title="Contract analysis">
          <p style={{ fontSize: 12, color: "var(--text-sec)", margin: "0 0 4px" }}>{res.ci.note}</p>
          {res.ci.m < 1 && <p style={{ fontSize: 12, color: "var(--text-alert)", fontWeight: 600, margin: "4px 0 0" }}>ACTION: Review clause for Waksdale compliance and ESA floor issues.</p>}
        </Sec>

        <Sec n={4} title={E ? "Exposure assessment" : "Quantum assessment"}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 6px" }}>Statutory minimum</p>
          <R k="Termination pay" v={res.tw + " weeks (" + $(res.tw * res.wk) + ")"} />
          {res.hs && <R k="Severance pay" v={res.sw + " weeks (" + $(res.sw * res.wk) + ")"} />}
          <R k="Total statutory" v={res.totW + " weeks (" + $(res.esaAmt) + ")"} accent />
          <div style={{ height: 12 }} />
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 6px" }}>Common law reasonable notice (Bardal factors)</p>
          <R k="Conservative" v={res.cL + " months (" + $(res.cLA) + ")"} />
          <R k="Midpoint" v={res.cM + " months (" + $(res.cMA) + ")"} accent />
          <R k="Aggressive" v={res.cH + " months (" + $(res.cHA) + ")"} />
          <div style={{ height: 8 }} />
          <p style={{ fontSize: 11, color: "var(--text-sec)" }}>
            {"Modifiers: Age=" + (res.age >= 55 ? "High" : res.age >= 45 ? "Mod-high" : res.age >= 35 ? "Moderate" : "Low")}
            {res.ind && " | Inducement +" + res.indPct + "%"}{res.bf && " | Bad faith +10%"}{res.ci.m < 1 && " | Contract -" + Math.round((1 - res.ci.m) * 100) + "%"}{res.salTier && " | Comp band +6-12%"}
          </p>
        </Sec>

        {res.off !== null && <Sec n={5} title={E ? "Planned offer analysis" : "Offer analysis"}>
          <R k={E ? "Planned offer" : "Offer"} v={$(res.off) + " (" + res.offMo + " months)"} />
          <R k="vs. statutory floor" v={res.off >= res.esaAmt ? "ABOVE" : "BELOW"} alert={res.off < res.esaAmt} accent={res.off >= res.esaAmt} />
          <R k="vs. CL midpoint" v={res.off >= res.cMA ? "At or above" : $(res.cMA - res.off) + " below"} alert={res.off < res.cMA} accent={res.off >= res.cMA} />
        </Sec>}

        <Sec n={res.off !== null ? 6 : 5} title={E ? "Recommended package" : "Recommended strategy"}>
          {!E && res.sr && <p style={{ fontSize: 12, color: "var(--text-alert)", fontWeight: 600, margin: "0 0 8px" }}>PRIORITY: Assess release enforceability (duress, independent advice, adequacy, ESA floor)</p>}
          <div className="pdf-strategy" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "8px 0 12px" }}>
            {(E ? [["Minimum", res.totW + "wk", res.esaAmt], ["Recommended", res.cM + "mo", res.cMA], ["Max exposure", res.cH + "mo", res.cHA]] : [["Opening", res.cH, res.cHA], ["Target", res.cM, res.cMA], ["Floor", res.cL, res.cLA]]).map(([label, mo, amt]) => (
              <div key={label} style={{ textAlign: "center", padding: "12px 8px", borderRadius: 8, border: (label === "Target" || label === "Recommended") ? "2px solid " + T : "1px solid var(--border-light)" }}>
                <p style={{ fontSize: 10, color: (label === "Target" || label === "Recommended") ? T : "var(--text-muted)", margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600 }}>{label}</p>
                <p style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1px", color: (label === "Target" || label === "Recommended") ? T : "var(--text)" }}>{mo}</p>
                <p style={{ fontSize: 11, color: "var(--text-faint)", margin: 0 }}>{$(amt)}</p>
              </div>
            ))}
          </div>
          {(res.bens || []).length > 0 && <p style={{ fontSize: 12, color: "var(--text-sec)" }}>Include: benefits continuation, pro-rated bonus, vacation payout, reference</p>}
          {!E && res.dl && <p style={{ fontSize: 12, color: "var(--text-alert)" }}>NOTE: Signing deadline{res.dlDays ? " (" + res.dlDays + " days)" : ""} reported. Consider extension.</p>}
        </Sec>

        <Sec n={res.off !== null ? 7 : 6} title={E ? "Documents to prepare" : "Documents to request from client"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {(E ? ["Termination letter", "Severance offer letter", "Full and final release", "Employee's contract", "ROE (within 5 business days)", "Final pay calculation", "Benefits continuation info", "Equity/RSU treatment", "Reference letter (if offered)", "Company property checklist", "IT access revocation plan"]
            : ["Employment contract (all versions)", "Termination letter", "Severance offer / release", "Last 3 pay stubs", "T4s (last 2 years)", "Benefits booklet", "Stock/RSU plan docs", "Performance reviews (last 2 years)", "Record of Employment", "Relevant correspondence", "Non-compete / non-solicit"]).map(d => <div key={d} style={{ fontSize: 11, color: "var(--text-sec)", display: "flex", gap: 5 }}><span style={{ color: "var(--border)" }}>{"\u2610"}</span>{d}</div>)}
          </div>
        </Sec>

        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 12, marginTop: 12 }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>Generated by Parachute {E ? "Employer" : "Severance"} Analyzer (useparachute.ca). For informational purposes only. Not a substitute for independent legal analysis.</p>
        </div>
      </div>
    </div>;
  }

  return <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 20px" }}>
    {/* Header */}
    <div style={{ background: "linear-gradient(135deg, #0A6B5C 0%, #085D50 40%, #0B5A65 100%)", margin: "-10px -20px 0", padding: "14px 20px 16px", borderRadius: "0 0 16px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div onClick={onLogoClick} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}><Logo size={18} color="#fff" /><span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>Parachute</span></div>
        <button onClick={() => setDark(!dark)} style={{ background: "rgba(255,255,255,.12)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1, color: "#fff" }}>{dark ? "\u2600" : "\u263E"}</button>
      </div>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, margin: "0 0 3px", color: "#fff" }}>{mode === "employer" ? "Exposure analysis" : "Your analysis"}</h2>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,.6)", margin: 0 }}>{res.pn} {"\u2014"} {res.jt || res.rl}, age {res.age}, {res.yrs}y</p>
    </div>
    <div style={{ background: "var(--bg-warning)", padding: "6px 16px", marginBottom: 12, borderRadius: "0 0 8px 8px", display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 10, color: "var(--text-warning)" }}>{"\u2696"}</span><span style={{ fontSize: 10, color: "var(--text-warning)" }}>For informational purposes only. Not legal advice.</span></div>

    {mode === "employer" && <Fade delay={15}><div style={{ background: "rgba(10,107,92,.06)", borderRadius: 11, padding: "13px 15px", marginBottom: 10, border: "1.5px solid rgba(10,107,92,.15)" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: T, margin: "0 0 4px" }}>Employer view</p>
      <p style={{ fontSize: 11, color: "var(--text-sec)", margin: 0, lineHeight: 1.5 }}>This analysis shows your potential exposure if the employee challenges the termination. The "court award" figures represent what a court would likely order, not what you must offer. A well-structured package between the statutory floor and the court midpoint typically prevents litigation. Consult employment counsel before finalizing any termination.</p>
    </div></Fade>}

    {res.sr && mode !== "employer" && <Fade delay={20}><div style={{ background: "rgba(216,90,48,.08)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, fontSize: 12, color: "var(--text-alert-dark)", lineHeight: 1.45 }}><strong>{"\u26A0"} You signed a release.</strong> Consult a lawyer urgently. Releases can sometimes be set aside.</div></Fade>}

    {res.civil && <Fade delay={25}><div style={{ background: "rgba(186,117,23,.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1px solid rgba(186,117,23,.1)" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-warning)", margin: "0 0 4px" }}>Quebec: civil law jurisdiction</p>
      <p style={{ fontSize: 11, color: "var(--text-sec)", margin: 0, lineHeight: 1.5 }}>Quebec operates under civil law (Civil Code, art. 2091), not the common law Bardal framework used in other provinces. The estimates below are based on comparable Quebec civil law jurisprudence, but the factors and precedents differ. A Quebec employment lawyer should be consulted for precise analysis.</p>
    </div></Fade>}

    {res.salTier && <Fade delay={28}><div style={{ background: "rgba(10,107,92,.04)", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1px solid rgba(10,107,92,.1)" }}>
      <p style={{ fontSize: 11, color: T, margin: 0, lineHeight: 1.5 }}>{mode === "employer" ? "High compensation adjustment applied. Employees earning $300,000+ take significantly longer to find comparable roles, which courts factor into the notice period." : "High compensation adjustment applied. At your compensation level ($300,000+), courts recognize that comparable roles are significantly harder to find, which pushes the notice period higher."}</p>
    </div></Fade>}
    {asmnt && <Fade delay={35}><div style={{ background: asmnt.bg, borderRadius: 11, padding: "13px 15px", marginBottom: 10, display: "flex", gap: 10 }}><div style={{ width: 30, height: 30, borderRadius: 7, background: asmnt.c, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 14, fontWeight: 700 }}>{asmnt.i}</div><div><p style={{ fontSize: 12.5, fontWeight: 600, color: asmnt.c, margin: "0 0 2px" }}>{asmnt.l}</p><p style={{ fontSize: 11.5, color: "var(--text-sec)", margin: 0, lineHeight: 1.4 }}>{asmnt.d}</p></div></div></Fade>}

    {res.ujd && <Fade delay={40}><div style={{ background: mode === "employer" ? "rgba(216,90,48,.06)" : "rgba(10,107,92,.05)", borderRadius: 11, padding: "13px 15px", marginBottom: 10, border: mode === "employer" ? "1.5px solid rgba(216,90,48,.12)" : "1.5px solid rgba(10,107,92,.2)" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: mode === "employer" ? "var(--text-alert)" : T, margin: "0 0 4px" }}>{mode === "employer" ? "Unjust dismissal exposure" : "You may have an unjust dismissal claim"}</p>
      <p style={{ fontSize: 11, color: "var(--text-sec)", margin: "0 0 6px", lineHeight: 1.45 }}>{mode === "employer" ? "This employee may be eligible for an unjust dismissal complaint under " + res.ujd.statute + ". This is a separate avenue from wrongful dismissal that can result in reinstatement or additional compensation. Ensure you have documented, non-discriminatory reasons for the termination and consult employment counsel about this specific risk before proceeding." : res.ujd.remedy}</p>
      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>Statutory basis: {res.ujd.statute}</p>
    </div></Fade>}

    {res.reason === "fc" && <Fade delay={42}><div style={{ background: "var(--bg-alert)", borderRadius: 11, padding: "13px 15px", marginBottom: 10, border: "1.5px solid rgba(216,90,48,.15)" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-alert)", margin: "0 0 5px" }}>{mode === "employer" ? "You are claiming termination for cause" : "Your employer claims termination for cause"}</p>
      <p style={{ fontSize: 11, color: "var(--text-sec)", margin: "0 0 6px", lineHeight: 1.5 }}>{mode === "employer" ? "The burden of proof is on you. Canadian courts reject the majority of for-cause claims. The numbers below show your exposure if cause is not established, which is the most likely outcome. Budget accordingly." : "This is an allegation, not a ruling. The burden of proof is on your employer, and Canadian courts set an extremely high bar for just cause. Most for-cause terminations do not hold up. The numbers below show what you would be owed if cause is not established, which is the most likely outcome."}</p>
      {mode !== "employer" && <><p style={{ fontSize: 11, color: "var(--text-sec)", margin: "0 0 4px", lineHeight: 1.5 }}>Even if the employer can prove just cause at common law, you may still be entitled to statutory minimums unless the conduct rises to "willful misconduct, disobedience or willful neglect of duty," which is a higher bar.</p>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-alert)", margin: 0 }}>Consult an employment lawyer immediately. Time limits for responding may apply.</p></>}
    </div></Fade>}

    {res.reason === "pr" && mode === "employer" && <Fade delay={42}><div style={{ background: "rgba(10,107,92,.05)", borderRadius: 11, padding: "13px 15px", marginBottom: 10, border: "1.5px solid rgba(10,107,92,.15)" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: T, margin: "0 0 5px" }}>Probationary termination</p>
      <p style={{ fontSize: 11, color: "var(--text-sec)", margin: 0, lineHeight: 1.5 }}>Most provinces allow reduced or no statutory notice during a probationary period (typically the first 3 months). However, common law reasonable notice may still apply unless explicitly excluded by a valid contract. If the employee has been employed for more than 3 months, standard statutory minimums apply regardless of any "probation" label. The numbers below show the full exposure.</p>
    </div></Fade>}

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
      <MC l={mode === "employer" ? "Statutory minimum" : "Legal floor"} v={$(res.esaAmt)} s={<Whats tip={mode === "employer" ? "The absolute minimum you must pay under the statute. Offering less than this exposes you to an employment standards complaint." : "Every province sets a bare minimum your employer must pay. This is the absolute floor \u2014 your employer cannot legally offer less than this."}>{res.totW + " weeks (statutory minimum)"}</Whats>} delay={55} />
      <MC l={mode === "employer" ? "Court exposure (mid)" : "What a court would likely award"} v={$(res.cMA)} s={<Whats tip={mode === "employer" ? "If the employee sues for wrongful dismissal, this is the midpoint of what a court would likely award based on the Bardal factors. Offering at or near this amount typically prevents litigation." : "When courts decide severance cases, they consider your age, how long you worked there, your role, and how easy it is to find a similar job. This is called 'common law reasonable notice'. It's almost always higher than the statutory minimum."}>{res.cM + " months (common law mid)"}</Whats>} a delay={70} />
      <MC l="Court award range" v={res.cL + "\u2013" + res.cH + " mo"} s={$(res.cLA) + "\u2013" + $(res.cHA)} delay={85} />
      {res.off !== null ? <MC l={mode === "employer" ? "Planned offer" : "Your offer"} v={$(res.off)} s={res.offMo + " mo equiv."} delay={100} /> : <MC l="Monthly comp" v={$(res.mo)} delay={100} />}
    </div>

    <Fade delay={115}><div style={CD}><p style={SL}>Comparison</p><BViz bars={bars} /></div></Fade>

    {/* SAVE PROMPT */}
    <Fade delay={118}><div style={{ background: "rgba(10,107,92,.04)", borderRadius: 11, padding: "12px 15px", marginBottom: 10, border: "1.5px solid rgba(10,107,92,.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div><p style={{ fontSize: 11.5, fontWeight: 600, color: T, margin: "0 0 2px" }}>Save your analysis</p><p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.35 }}>{mode === "employer" ? "Download a PDF with the exposure analysis, risk flags, and recommended package." : "Download a PDF with your full report, verdict, and bar chart."}</p></div>
      <button onClick={() => { setPrintView(true); window.scrollTo(0, 0); }} style={{ background: T, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{"\u2193"} PDF</button>
    </div></Fade>

    {/* TERRITORY NOTE */}
    {res.tr && <Fade delay={122}><div style={{ background: "var(--bg-warning)", borderRadius: 10, padding: "11px 14px", marginBottom: 10, fontSize: 11, color: "var(--text-warning)", lineHeight: 1.45 }}>Territorial case law on reasonable notice is limited compared to provincial jurisdictions. Courts in the territories generally apply Bardal factors, but with fewer local precedents to draw from. An employment lawyer familiar with your territory can give you the sharpest estimate.</div></Fade>}

    {/* NEGOTIATION EMAIL (employee) / RECOMMENDED PACKAGE (employer) */}
    {mode === "employer" ? <Fade delay={130}><div style={{ ...CD, border: "1.5px solid " + T, background: "rgba(10,107,92,.02)" }}>
      <p style={{ ...SL, color: T, margin: "0 0 8px" }}>Recommended package structure</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px", lineHeight: 1.4 }}>A defensible severance package typically includes the following components, calibrated to this employee's profile.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        <div style={{ background: "var(--bg-subtle)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 8, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 2px", textTransform: "uppercase" }}>Minimum (statutory)</p>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0, color: "var(--text)", fontFamily: "Georgia,serif" }}>{res.totW} weeks</p>
          <p style={{ fontSize: 9, color: "var(--text-dim)", margin: "1px 0 0" }}>{$(res.esaAmt)}</p>
        </div>
        <div style={{ background: "rgba(10,107,92,.04)", borderRadius: 8, padding: "10px 12px", textAlign: "center", border: "1px solid rgba(10,107,92,.12)" }}>
          <p style={{ fontSize: 8, fontWeight: 600, color: T, margin: "0 0 2px", textTransform: "uppercase" }}>Recommended</p>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0, color: T, fontFamily: "Georgia,serif" }}>{res.cM} months</p>
          <p style={{ fontSize: 9, color: "var(--text-dim)", margin: "1px 0 0" }}>{$(res.cMA)}</p>
        </div>
      </div>
      {[
        "Lump-sum payment or salary continuation of " + res.cM + " months' total compensation (" + $(res.cMA) + ")",
        (res.bens || []).length > 0 ? "Benefits continuation for the notice period, or a lump-sum equivalent" : null,
        res.bonus > 0 ? "Pro-rated bonus for the current year" : null,
        res.vd > 0 ? "Vacation payout: " + res.vd + " days (" + $(res.vp) + ") — this is owed regardless" : null,
        "A mutual release of claims in exchange for the above",
        "Positive or neutral reference letter",
        res.nc ? "Consider releasing non-compete in exchange for cooperation on transition" : null,
      ].filter(Boolean).map((item, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, fontSize: 11, color: "var(--text-sec)", lineHeight: 1.4 }}><span style={{ color: T, flexShrink: 0, fontSize: 10 }}>{"\u2713"}</span><span>{item}</span></div>)}
      <div style={{ background: "var(--bg-warning)", borderRadius: 7, padding: "8px 11px", marginTop: 10 }}>
        <p style={{ fontSize: 10.5, color: "var(--text-warning)", margin: 0, lineHeight: 1.45 }}>Offering at or near the court midpoint typically prevents litigation and is more cost-effective than defending a wrongful dismissal claim. Have employment counsel review the package and release before presenting it.</p>
      </div>
    </div></Fade>
    : <Fade delay={130}><div style={{ ...CD, border: "1.5px solid " + T, background: "rgba(10,107,92,.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><p style={{ ...SL, color: T, margin: 0 }}>{"\u2709"} Negotiation letter</p><button onClick={() => setEml(!eml)} style={{ background: "rgba(10,107,92,.08)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: T, fontWeight: 500, cursor: "pointer" }}>{eml ? "Hide \u25B2" : "View \u25BC"}</button></div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: email.tone === "aggressive" ? "var(--text-alert)" : email.tone === "firm" ? "#854F0B" : email.tone === "strategic" ? T : "var(--text-sec)", textTransform: "uppercase", letterSpacing: ".04em", padding: "3px 7px", borderRadius: 4, background: email.tone === "aggressive" ? "rgba(153,60,29,.08)" : email.tone === "firm" ? "rgba(133,79,11,.08)" : email.tone === "strategic" ? "rgba(10,107,92,.06)" : "var(--bg-muted)" }}>{email.label}</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{email.desc}</p>
      <div style={{ background: "var(--bg-warning)", borderRadius: 7, padding: "8px 11px", marginTop: 6, marginBottom: eml ? 0 : 0 }}>
        <p style={{ fontSize: 10.5, color: "var(--text-warning)", margin: 0, lineHeight: 1.45 }}><strong>Important:</strong> If you plan to hire a lawyer, share this analysis with them and let them handle the communication. A lawyer will position your case more strategically than a self-sent letter. If you are negotiating on your own, this gives you a strong starting point, but understand that once you put a number on the table, that becomes your anchor.</p>
      </div>
      {eml && <div style={{ marginTop: 8 }}><pre style={{ background: "var(--bg-subtle)", borderRadius: 7, padding: "12px 14px", fontSize: 11, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border-light)", fontFamily: "Georgia,serif", margin: "0 0 7px" }}>{email.text}</pre><button onClick={() => copy(email.text, "e")} style={{ background: T, color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer", width: "100%" }}>{cp === "e" ? "\u2713 Copied" : "Copy to clipboard"}</button></div>}
    </div></Fade>}

    {/* STRATEGY MEMO (employee) / COMPLIANCE GUIDE (employer) */}
    <Fade delay={140}><div style={{ ...CD, border: "2px solid " + T, background: "rgba(10,107,92,.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <p style={{ ...SL, color: T, margin: 0 }}>{mode === "employer" ? "\uD83D\uDEE1 Compliance guide" : "\uD83C\uDFAF Your strategy memo"}</p>
        <button onClick={() => { setMemo(!memo); if (!memo) trk("memo_viewed", { mode }); }} style={{ background: "rgba(10,107,92,.08)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: T, fontWeight: 500, cursor: "pointer" }}>{memo ? "Hide \u25B2" : "Read \u25BC"}</button>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{mode === "employer" ? "Risk flags, legal requirements, and best practices for this termination." : "A personalized guide to your severance negotiation. What to say, what not to say, and when to say it."}</p>
      {memo && (() => {
        if (mode === "employer") {
          const flags = [];
          if (res.empHR) flags.push({ t: "Human rights exposure", body: "You identified potential human rights factors in this termination. If the employee is pregnant, on disability leave, has a disability, recently filed a workplace complaint, or belongs to a protected group, the termination may trigger a human rights complaint in addition to a wrongful dismissal claim. Human rights tribunals can award uncapped general damages for injury to dignity, plus lost wages. This is the highest-risk factor in any termination. Consult employment counsel before proceeding." });
          if (res.ujd) flags.push({ t: "Unjust dismissal exposure", body: "This employee may have access to an unjust dismissal claim under " + res.ujd.statute + ". This is a separate legal avenue that can result in reinstatement or compensation beyond severance. Before proceeding, ensure you have documented business reasons for the termination and consult employment counsel about this specific risk." });
          if (res.reason === "fc" && (res.empDocLevel === "verbal" || res.empDocLevel === "none")) flags.push({ t: "Insufficient documentation for cause", body: "You are claiming cause but have " + (res.empDocLevel === "none" ? "no formal documentation" : "only verbal warnings") + ". Courts require a clear paper trail: written warnings, performance improvement plans with measurable outcomes, and evidence that the employee was given a genuine opportunity to improve. Without this, your for-cause claim will almost certainly fail, and the court may award aggravated damages for bringing an unfounded cause allegation. Strongly consider terminating without cause and offering a severance package instead." });
          else if (res.reason === "fc") flags.push({ t: "For-cause risk", body: "You are terminating for cause. The burden of proof is entirely on you. Courts reject the majority of for-cause terminations. If cause is not established, you will owe full common law notice plus potentially additional damages for bad faith if the allegation was unfounded. Ensure you have comprehensive documentation of the conduct, progressive discipline records, and that the termination is proportional." });
          if (res.reason === "pf" && (res.empDocLevel === "verbal" || res.empDocLevel === "none")) flags.push({ t: "Weak documentation for performance termination", body: "You are terminating for performance issues but have " + (res.empDocLevel === "none" ? "no formal documentation" : "only verbal warnings") + ". While you are not claiming cause, the employee's lawyer will argue the termination was in bad faith if there is no documented record of performance concerns, feedback, or improvement opportunities. This can increase the notice period. Going forward, implement a formal PIP before terminating for performance." });
          if (res.bf) flags.push({ t: "Bad faith conduct risk", body: "You indicated the termination involved conduct that may be considered bad faith. Courts award additional damages (typically 2\u20136 extra months) for humiliation, dishonesty, or callous behaviour during the termination process. Even if the severance package is adequate, the manner of dismissal can create a separate claim." });
          if (res.ind) flags.push({ t: "Inducement risk", body: "This employee was recruited away from a stable position. Courts treat this as a significant aggravating factor. Even with short tenure, the notice period will be substantially higher than it would otherwise be. Factor this into the package \u2014 a short-tenure employee who was induced can receive 12+ months of notice." });
          if (res.ci && res.ci.m < 1 && res.prov === "ON") flags.push({ t: "Waksdale exposure (Ontario)", body: "The employment contract contains a termination clause, but post-Waksdale, many such clauses are unenforceable. If any part of the termination provision fails to meet ESA minimums, the entire clause may be void, entitling the employee to full common law notice. Have your employment lawyer review the specific clause before relying on it." });
          if (res.nc) flags.push({ t: "Non-compete enforceability", body: "A non-compete or non-solicitation clause is in place. Many restrictive covenants are unenforceable in Canada. Attempting to enforce an unreasonable restriction can backfire and be used as leverage by the employee in severance negotiations. Consider releasing the restriction in exchange for cooperation on transition." });
          if (res.empGroup) flags.push({ t: "Group termination provisions", body: "You indicated this is part of a group termination. In Ontario, terminating 50 or more employees in a 4-week period triggers mass termination provisions under s. 58 of the ESA, requiring 8\u201316 weeks of additional notice depending on the number affected. British Columbia, Manitoba, and other provinces have similar provisions with different thresholds. You may also be required to file a report with the Director of Employment Standards. Consult counsel on the specific requirements in " + res.pn + "." });

          const guide = [];
          if (res.empTermStatus === "planned") guide.push({ t: "Termination meeting best practices", body: "Hold the meeting in a private setting with two company representatives present. Prepare a brief script. State the decision clearly and without ambiguity. Do not negotiate in the meeting. Provide the termination letter and severance offer in writing. Allow the employee to leave with dignity. Give a reasonable deadline to review the offer (minimum 7 days; 14+ is standard).\n\nDo not escort the employee out publicly. Do not disable their access before the meeting. Do not announce the termination to the team before speaking to the employee. Any of these can constitute bad faith and increase your exposure.\n\nIf the employee becomes emotional, allow them time. If they become hostile, end the meeting calmly and offer to reconvene. Never argue about the decision or justify it with performance anecdotes \u2014 this creates evidence the employee can use later." });
          guide.push({ t: "Document preparation", body: "Before the termination meeting, prepare:\n\u2022 Termination letter stating the effective date and reason (without cause is safest unless you have strong documentation for cause)\n\u2022 Severance offer letter with the proposed package\n\u2022 Full and final release of claims \u2014 have employment counsel draft this\n\u2022 Benefits continuation details or conversion information\n\u2022 ROE (Record of Employment) \u2014 must be issued within 5 business days\n\u2022 Final pay calculation including accrued vacation (" + (res.vd > 0 ? res.vd + " days, " + $(res.vp) : "confirm with payroll") + ")\n\u2022 Information about any equity, stock options, or RSU treatment\n\u2022 Company property return checklist" });
          guide.push({ t: "Release requirements", body: "A release is only enforceable if:\n\u2022 The employee receives adequate consideration (the severance must exceed statutory minimums \u2014 in this case, more than " + $(res.esaAmt) + ")\n\u2022 The employee has adequate time to review (minimum 7 days; 14+ days is standard practice)\n\u2022 The employee is advised to seek independent legal counsel before signing\n\u2022 The release was not signed under duress or undue pressure\n\nA release signed under inadequate conditions can be set aside entirely, leaving you with no protection against a lawsuit. Do not pressure the employee to sign in the meeting. Do not threaten to withdraw the offer if they take time." });
          guide.push({ t: "Cost of litigation vs. settlement", body: "Defending a wrongful dismissal claim typically costs $15,000\u2013$50,000+ in legal fees, takes 12\u201324 months, and creates uncertainty and management distraction. Offering a package at or near the court midpoint (" + $(res.cMA) + ") almost always costs less than litigation, resolves faster, and eliminates the risk of a higher court award plus costs.\n\nFor this employee, the total cost range is:\n\u2022 Statutory minimum: " + $(res.esaAmt) + " (non-negotiable floor)\n\u2022 Court midpoint: " + $(res.cMA) + " (recommended target)\n\u2022 Court high: " + $(res.cHA) + " (worst-case exposure)\n\u2022 Litigation defence: $15k\u2013$50k+ on top of any award" });

          const blocks = [...flags, ...guide];
          return <div style={{ marginTop: 12 }}>
            <div style={{ background: "var(--bg-warning)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, border: "1px solid var(--border-warning)" }}>
              <p style={{ fontSize: 10.5, color: "var(--text-warning)", margin: 0, lineHeight: 1.5 }}>This guide is for informational purposes only. It is not legal advice and does not create a solicitor-client relationship. Consult qualified employment counsel before proceeding with any termination.</p>
            </div>
            {flags.length > 0 && <div style={{ background: "rgba(216,90,48,.05)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, border: "1px solid rgba(216,90,48,.1)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-alert)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".03em" }}>{"\u26A0"} {flags.length} risk flag{flags.length > 1 ? "s" : ""} identified</p>
              <p style={{ fontSize: 10.5, color: "var(--text-sec)", margin: 0, lineHeight: 1.4 }}>Review each flag below before proceeding. These increase your legal exposure.</p>
            </div>}
            {blocks.map((b, i) => <div key={i} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: i < flags.length ? "var(--text-alert)" : T, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".03em" }}>{b.t}</p>
              {b.body.split("\n\n").map((para, j) => <p key={j} style={{ fontSize: 12, color: "var(--text-sec)", margin: "0 0 8px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{para}</p>)}
            </div>)}
            <button onClick={() => {
              const txt = blocks.map(b => b.t.toUpperCase() + "\n\n" + b.body).join("\n\n" + "\u2500".repeat(40) + "\n\n");
              copy(txt, "memo");
            }} style={{ background: T, color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer", width: "100%" }}>{cp === "memo" ? "\u2713 Copied" : "Copy compliance guide"}</button>
          </div>;
        }

        const blocks = buildMemo(res); return <div style={{ marginTop: 12 }}>
        <div style={{ background: "var(--bg-warning)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, border: "1px solid var(--border-warning)" }}>
          <p style={{ fontSize: 10.5, color: "var(--text-warning)", margin: 0, lineHeight: 1.5 }}>This memo is generated from the information you provided and is for informational purposes only. It is not legal advice, does not create a solicitor-client relationship, and should not be relied upon as a substitute for independent legal counsel. A qualified employment lawyer may assess your situation differently.</p>
        </div>
        {blocks.map((b, i) => <div key={i} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".03em" }}>{b.t}</p>
          {b.body.split("\n\n").map((para, j) => <p key={j} style={{ fontSize: 12, color: "var(--text-sec)", margin: "0 0 8px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{para}</p>)}
        </div>)}
        <button onClick={() => {
          const txt = blocks.map(b => b.t.toUpperCase() + "\n\n" + b.body).join("\n\n" + "\u2500".repeat(40) + "\n\n");
          copy(txt, "memo");
        }} style={{ background: T, color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer", width: "100%" }}>{cp === "memo" ? "\u2713 Copied" : "Copy strategy memo"}</button>
      </div>; })()}
    </div></Fade>

    {/* LAWYER REPORT (employee) / TERMINATION SUMMARY (employer) */}
    {mode !== "employer" ? <Fade delay={145}><div style={{ ...CD, border: "1.5px solid #444", background: "rgba(0,0,0,.01)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><p style={{ ...SL, color: "var(--text)", margin: 0 }}>{"\uD83D\uDCCB"} Report for your lawyer</p><button onClick={() => setLrpt(!lrpt)} style={{ background: "rgba(0,0,0,.06)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "var(--text-sec)", fontWeight: 500, cursor: "pointer" }}>{lrpt ? "Hide \u25B2" : "View \u25BC"}</button></div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>A structured intake summary formatted for your employment lawyer. Send this ahead of your first meeting to save time and money.</p>
      {lrpt && <div style={{ marginTop: 8 }}>
        <div style={{ background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border-light)", overflow: "hidden", marginBottom: 7 }}>
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
              ["Reason", (REASONS.find(x => x.id === res.reason) || EMP_REASONS.find(x => x.id === res.reason) || {}).l || ""],
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
            <div key={section.title} style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-light)" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>{section.title}</p>
              {section.rows.map(([k, v], i) => (
                <div key={k + i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, gap: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <span style={{ fontWeight: v.includes("YES") || v.includes("ACTION") ? 600 : 400, color: v.includes("YES") || v.includes("ACTION") ? "var(--text-alert)" : "var(--text)", textAlign: "right", maxWidth: "65%" }}>{v}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Quantum */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-light)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>4. Quantum assessment</p>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 4px" }}>Statutory minimum</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "var(--text-muted)" }}>Termination pay</span><span>{res.tw} weeks ({$(res.tw * res.wk)})</span></div>
            {res.hs && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "var(--text-muted)" }}>Severance pay</span><span>{res.sw} weeks ({$(res.sw * res.wk)})</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0", fontWeight: 500 }}><span style={{ color: T }}>Total statutory</span><span style={{ color: T }}>{res.totW} weeks ({$(res.esaAmt)})</span></div>
            <div style={{ height: 1, background: "#E8E6E0", margin: "8px 0" }} />
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 4px" }}>Common law (Bardal factors)</p>
            {[["Conservative", res.cL, res.cLA], ["Midpoint", res.cM, res.cMA], ["Aggressive", res.cH, res.cHA]].map(([label, mo, amt]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "var(--text-muted)" }}>{label}</span><span style={{ fontWeight: label === "Midpoint" ? 500 : 400 }}>{mo} months ({$(amt)})</span></div>
            ))}
            <div style={{ height: 1, background: "#E8E6E0", margin: "8px 0" }} />
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 4px" }}>Modifiers applied</p>
            <div style={{ fontSize: 11, color: "var(--text-sec)", lineHeight: 1.5 }}>
              {"Age: " + (res.age >= 55 ? "High" : res.age >= 45 ? "Moderate-high" : res.age >= 35 ? "Moderate" : "Low")}
              {res.ind && " | Inducement: +" + res.indPct + "%"}{res.bf && " | Bad faith: +10%"}{res.ci.m < 1 && " | Contract: -" + Math.round((1 - res.ci.m) * 100) + "% (pending review)"}{res.salTier && " | Comp band: +6-12%"}
            </div>
          </div>

          {/* Offer */}
          {res.off !== null && <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-light)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>5. Offer analysis</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "var(--text-muted)" }}>Offer</span><span>{$(res.off)} ({res.offMo} months)</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "var(--text-muted)" }}>vs. statutory floor</span><span style={{ color: res.off >= res.esaAmt ? T : "var(--text-alert)", fontWeight: 500 }}>{res.off >= res.esaAmt ? "ABOVE" : "BELOW"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}><span style={{ color: "var(--text-muted)" }}>vs. CL midpoint</span><span style={{ color: res.off >= res.cMA ? T : "var(--text-alert)" }}>{res.off >= res.cMA ? "At or above" : $(res.cMA - res.off) + " below"}</span></div>
          </div>}

          {/* Strategy */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-light)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>{res.off !== null ? "6" : "5"}. Recommended strategy</p>
            {res.sr && <p style={{ fontSize: 11, color: "var(--text-alert)", fontWeight: 500, margin: "0 0 4px" }}>PRIORITY: Assess release enforceability (duress, independent advice, adequacy, ESA floor)</p>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
              {[["Opening", res.cH + " mo", $(res.cHA)], ["Target", res.cM + " mo", $(res.cMA)], ["Floor", res.cL + " mo", $(res.cLA)]].map(([label, mo, amt]) => (
                <div key={label} style={{ textAlign: "center", padding: "7px 4px", borderRadius: 6, background: label === "Target" ? "rgba(10,107,92,.06)" : "#fff", border: "1px solid var(--border-light)" }}>
                  <p style={{ fontSize: 9, color: label === "Target" ? T : "var(--text-muted)", margin: "0 0 1px", textTransform: "uppercase" }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 0px", color: label === "Target" ? T : "#333" }}>{mo}</p>
                  <p style={{ fontSize: 9, color: "var(--text-faint)", margin: 0 }}>{amt}</p>
                </div>
              ))}
            </div>
            {(res.bens || []).length > 0 && <p style={{ fontSize: 10.5, color: "var(--text-sec)", margin: "0 0 3px" }}>Include: benefits continuation, pro-rated bonus, vacation payout, reference</p>}
            {res.dl && <p style={{ fontSize: 10.5, color: "var(--text-alert)", margin: "3px 0 0" }}>NOTE: Signing deadline reported{res.dlDays ? " (" + res.dlDays + " days)" : ""}. Consider extension request.</p>}
          </div>

          {/* Documents */}
          <div style={{ padding: "12px 14px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>{res.off !== null ? "7" : "6"}. Documents to request</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
              {["Employment contract", "Termination letter", "Severance offer / release", "Last 3 pay stubs", "T4s (last 2 years)", "Benefits booklet", "Stock/RSU plan docs", "Performance reviews", "ROE", "Relevant correspondence", "Non-compete agreements"].map(d => (
                <div key={d} style={{ fontSize: 10, color: "var(--text-sec)", display: "flex", gap: 4, alignItems: "baseline" }}><span style={{ color: "var(--border)" }}>{"\u2610"}</span>{d}</div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => copy(lawyerRpt, "lr")} style={{ flex: 1, background: "#333", color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{cp === "lr" ? "\u2713 Copied" : "Copy as text"}</button>
          <button onClick={() => { setPrintView(true); window.scrollTo(0, 0); }} style={{ flex: 1, background: T, color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>View report & download PDF</button>
        </div>
      </div>}
    </div></Fade>
    : null}

    {/* STATUTORY */}
    <Fade delay={160}><div style={CD}>
      <p style={SL}><Whats tip={mode === "employer" ? "This is the absolute minimum you must pay under the statute. Paying less exposes you to an employment standards complaint." : "Every province has legislation that sets a minimum amount your employer must pay when they let you go. Think of it as the legal floor. They cannot offer you less. But courts usually award much more, which is why the 'court award' number above is typically more important."}>{mode === "employer" ? "Statutory obligations" : "The legal floor (statutory minimum)"}</Whats></p>
      {[{ k: res.esa, v: "", x: mode === "employer" ? "The statute that applies in " + res.pn : "The law that applies in " + res.pn },
        { k: "Termination pay", v: res.tw + "wk (" + $(res.tw * res.wk) + ")", x: mode === "employer" ? "Minimum statutory notice for " + res.yrs + " years of service" : "Minimum notice your employer must give based on " + res.yrs + " years" },
        res.hs ? { k: "Severance pay", v: res.sw + "wk (" + $(res.sw * res.wk) + ")", x: mode === "employer" ? "Additional statutory payment on top of termination pay" : "Additional payment on top of termination pay" } : null,
        { k: "Total floor", v: res.totW + "wk (" + $(res.esaAmt) + ")", x: mode === "employer" ? "You cannot offer less than this" : "Anything below this is illegal", a: true },
        res.vd > 0 ? { k: "Vacation payout", v: res.vd + "d (" + $(res.vp) + ")", x: mode === "employer" ? "Owed separately regardless of severance" : "Owed separately. This is wages you already earned." } : null,
      ].filter(Boolean).map((row, i, arr) => <div key={row.k} style={{ padding: "5px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border-lighter)" : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 6 }}><span style={{ color: "var(--text-sec)" }}>{row.k}</span><span style={{ fontWeight: 500, color: row.a ? T : "var(--text)", fontSize: 11 }}>{row.v}</span></div>
        <p style={{ fontSize: 10, color: "var(--text-dim)", margin: "1px 0 0", lineHeight: 1.3 }}>{row.x}</p>
      </div>)}
      {res.sn && <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "7px 0 0", fontStyle: "italic", lineHeight: 1.4, background: "var(--bg-subtle)", borderRadius: 6, padding: "7px 10px" }}>{res.sn}</p>}
    </div></Fade>

    {/* BENEFITS */}
    {selBens.length > 0 && <Fade delay={175}><div style={{ ...CD, cursor: "pointer" }} onClick={() => setBen(!ben)}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p style={{ ...SL, margin: 0 }}>{mode === "employer" ? "Benefits continuation obligations" : "What happens to your benefits"}</p><span style={{ fontSize: 10, color: "var(--text-muted)" }}>{ben ? "\u25B2" : "\u25BC"}</span></div>{ben && <div style={{ marginTop: 8 }}>{selBens.map(b => <div key={b.id} style={{ padding: "8px 10px", borderRadius: 7, background: "var(--bg-subtle)", marginBottom: 5 }}><p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sec)", margin: "0 0 2px" }}>{b.l}</p><p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, lineHeight: 1.45 }}>{mode === "employer" ? (b.et || b.t) : b.t}</p></div>)}</div>}</div></Fade>}

    {/* LAWYER ROI (employee) / COST ANALYSIS (employer) */}
    {mode === "employer" ? <Fade delay={190}><div style={CD}><p style={SL}>Cost of litigation vs. settlement</p>
      <p style={{ fontSize: 11, color: "var(--text-sec)", margin: "0 0 8px", lineHeight: 1.5 }}>Defending a wrongful dismissal claim typically costs $15,000{"\u2013"}$50,000+ in legal fees, takes 12{"\u2013"}24 months, and creates uncertainty. Offering at or near the court midpoint almost always costs less than litigation.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
        {[{ l: "Litigation cost", v: "$15k\u2013$50k+", c: "var(--text-alert)" }, { l: "Midpoint package", v: $(res.cMA), c: T }].map(x => <div key={x.l} style={{ textAlign: "center", padding: "8px 3px", borderRadius: 7, background: "var(--bg-subtle)" }}><p style={{ fontSize: 8, color: "var(--text-muted)", margin: "0 0 1px", textTransform: "uppercase" }}>{x.l}</p><p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: x.c }}>{x.v}</p></div>)}
      </div>
      <p style={{ fontSize: 10, color: "var(--text-dim)", margin: 0, lineHeight: 1.35 }}>Settlement is almost always more cost-effective than litigation, even when the package exceeds what a court might award.</p>
    </div></Fade>
    : roi && <Fade delay={190}><div style={CD}><p style={SL}>Is hiring a lawyer worth it?</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 5 }}>{[{ l: "Est. fee", v: $(roi.f) }, { l: "Potential uplift", v: $(roi.u), c: T }, { l: "ROI", v: roi.r + "x", c: T }].map(x => <div key={x.l} style={{ textAlign: "center", padding: "8px 3px", borderRadius: 7, background: "var(--bg-subtle)" }}><p style={{ fontSize: 8, color: x.c || "var(--text-muted)", margin: "0 0 1px", textTransform: "uppercase" }}>{x.l}</p><p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: x.c || "var(--text)" }}>{x.v}</p></div>)}</div><p style={{ fontSize: 10, color: "var(--text-dim)", margin: 0, lineHeight: 1.35 }}>Most offer free initial consultations.</p></div></Fade>}

    {/* DOCUMENT CHECKLIST */}
    <Fade delay={205}><div style={{ ...CD, cursor: "pointer" }} onClick={() => setDocs(!docs)}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p style={{ ...SL, margin: 0 }}>{mode === "employer" ? "Documents to prepare before termination" : "Bring to your first lawyer meeting"}</p><span style={{ fontSize: 10, color: "var(--text-muted)" }}>{docs ? "\u25B2" : "\u25BC"}</span></div>{docs && <div style={{ marginTop: 8 }}>{(mode === "employer" ? [
      "Termination letter (state effective date and without-cause basis unless pursuing cause)",
      "Severance offer letter with proposed package details",
      "Full and final release of claims (have counsel draft this)",
      "Employee's original employment contract and any amendments",
      "Record of Employment (ROE) — must be issued within 5 business days",
      "Final pay calculation including accrued vacation",
      "Benefits continuation details or conversion information",
      "Stock option / RSU plan treatment documentation",
      "Reference letter (if offering one as part of the package)",
      "Company property return checklist",
      "IT access revocation plan (do NOT disable before the meeting)",
    ] : [
      "Employment contract (all versions and amendments)", "Termination letter", "Severance offer and any release document", "Last 3 pay stubs", "T4 slips for the last 2 years", "Benefits booklet or summary", "Stock option / RSU plan documents", "Performance reviews (last 2 years)", "Record of Employment (ROE) if received", "Any emails or messages about the termination", "Non-compete / non-solicitation agreements",
    ]).map((d, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3, fontSize: 11, color: "var(--text-sec)", lineHeight: 1.35 }}><span style={{ color: "var(--border)", flexShrink: 0 }}>{"\u2610"}</span><span>{d}</span></div>)}</div>}</div></Fade>

    {/* ACTION PLAN */}
    <Fade delay={220}><div style={{ ...CD, cursor: "pointer" }} onClick={() => setChk(!chk)}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p style={{ ...SL, margin: 0 }}>{mode === "employer" ? "\u2611 Termination process checklist" : "\u2611 Post-termination action plan"}</p><span style={{ fontSize: 10, color: "var(--text-muted)" }}>{chk ? "\u25B2" : "\u25BC"}</span></div>{chk && <div style={{ marginTop: 8 }}>
      {(mode === "employer" ? [
        { t: "Before the meeting", i: ["Finalize the severance package with employment counsel", "Prepare all documents (termination letter, offer, release)", "Book a private meeting room — never terminate in a public area", "Have two company representatives present", "Prepare a brief script — keep it clear, empathetic, and under 15 minutes", "Ensure IT does NOT disable access before the meeting"] },
        { t: "During the meeting", i: ["State the decision clearly — do not negotiate in this meeting", "Provide the termination letter and severance offer in writing", "Allow the employee time to process — do not rush them", "Give a reasonable review period for the offer (minimum 7 days, 14+ is standard)", "Advise them to seek independent legal advice before signing", "Let the employee collect personal belongings with dignity"] },
        { t: "Within 5 business days", i: ["Issue the Record of Employment (ROE) — legally required", "Process final pay including accrued vacation", "Send benefits continuation or conversion information", "Communicate to the team — brief, respectful, no details about the reason"] },
        { t: "Within 30 days", i: ["Follow up on the severance offer if no response", "Process any equity treatment per the plan documents", "Complete any regulatory filings if applicable", "Document the entire process for your records"] },
      ] : [
        { t: "Immediately", i: ["Do NOT sign any release until reviewed", "Request copies of contract, amendments, termination letter", "Save relevant documents and emails from work accounts"] },
        { t: "Within 1 week", i: ["Apply for EI through Service Canada \u2014 even with a lump sum (lump sums don't delay EI; salary continuation does, but apply now because processing takes weeks)", "Contact benefit insurers about 30-day conversion options", "Check stock option/RSU deadlines \u2014 these can lapse in 30-90 days"] },
        { t: "Within 2 weeks", i: ["Consult an employment lawyer (most offer free consultations)", "Review pension/RRSP contributions", "Start documenting your job search \u2014 courts expect mitigation"] },
        { t: "Within 30 days", i: ["Respond to offer or have lawyer respond", "Convert group insurance to individual if needed", "Review restrictive covenants for enforceability"] },
      ]).map(s => <div key={s.t} style={{ marginBottom: 8 }}><p style={{ fontSize: 11, fontWeight: 600, color: T, margin: "0 0 3px" }}>{s.t}</p>{s.i.map((it, j) => <div key={j} style={{ display: "flex", gap: 5, marginBottom: 2, fontSize: 10.5, color: "var(--text-sec)", lineHeight: 1.35 }}><span style={{ color: "var(--border)", flexShrink: 0 }}>{"\u2610"}</span><span>{it}</span></div>)}</div>)}
    </div>}</div></Fade>

    {/* TAX / EMPLOYER OBLIGATIONS */}
    <Fade delay={235}><div style={CD}><p style={SL}>{mode === "employer" ? "Employer obligations" : "Tax considerations"}</p><p style={{ fontSize: 11, color: "var(--text-sec)", margin: 0, lineHeight: 1.45 }}>{mode === "employer"
      ? "Lump-sum severance payments must have income tax, CPP, and EI deducted at source. Salary continuation is processed through normal payroll. Issue a T4 or T4A as appropriate. The Record of Employment (ROE) must be filed within 5 business days of the last day of work. If the employee has pre-1996 service, retiring allowance transfers to RRSP may apply. Consult your payroll provider and accountant on the optimal structure."
      : "Lump-sum payments are taxed as employment income, potentially pushing you into a higher bracket. Salary continuation may lower your effective tax. Pre-1996 service retiring allowances may qualify for RRSP transfer. Ask your accountant about the optimal structure."}</p></div></Fade>

    {/* DISCLAIMER */}
    <Fade delay={250}><div style={{ background: "var(--bg-warning)", borderRadius: 11, padding: "13px 15px", marginBottom: 10, border: "1px solid var(--border-warning)" }}>
      <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-warning)", margin: "0 0 3px" }}>{"\u2696"} Important legal disclaimer</p>
      <p style={{ fontSize: 9.5, color: "var(--text-warning)", margin: 0, lineHeight: 1.55, opacity: .85 }}>This analysis is for informational purposes only. It does not constitute legal advice, a legal opinion, or a recommendation, and does not create a solicitor-client relationship. All estimates, calculations, letters, and reports are provided "as is" without warranty of any kind. Information may be inaccurate, incomplete, or not current. You accepted the full Terms of Use before using this tool. Consult a qualified employment lawyer licensed in your jurisdiction before making any decisions.</p>
    </div></Fade>

    {/* FEEDBACK */}
    <Fade delay={258}><div style={{ background: "var(--bg-card)", borderRadius: 11, padding: "14px 15px", marginBottom: 10, border: "1px solid var(--border-light)", textAlign: "center" }}>
      {fb === null ? <>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", margin: "0 0 8px" }}>Was this analysis helpful?</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => { setFb("yes"); trk("feedback", { value: "yes" }); }} style={{ padding: "7px 20px", borderRadius: 8, border: "1.5px solid " + T, background: "rgba(10,107,92,.04)", color: T, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{"\uD83D\uDC4D"} Yes</button>
          <button onClick={() => { setFb("no"); trk("feedback", { value: "no" }); }} style={{ padding: "7px 20px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{"\uD83D\uDC4E"} No</button>
        </div>
      </> : <p style={{ fontSize: 12, color: T, margin: 0, fontWeight: 500 }}>{"\u2713"} Thanks for the feedback.</p>}
    </div></Fade>

    <Fade delay={265}><div style={{ display: "flex", gap: 7, marginBottom: 32 }}>
      <Btn secondary onClick={onReset} full>Start over</Btn>
      <Btn onClick={() => {
        let sm = "";
        if (mode === "employer") {
          sm = "TERMINATION EXPOSURE ANALYSIS (from Parachute)\n\n";
          sm += "Employee: " + (res.jt || res.rl) + " in " + res.pn + ", " + res.yrs + " years tenure, age " + res.age + ".\n";
          sm += "Total annual compensation: " + $(res.tc) + ".\n\n";
          sm += "EXPOSURE RANGE:\n\n";
          sm += "\u2022 Statutory minimum (non-negotiable): " + $(res.esaAmt) + " (" + res.totW + " weeks). Offering less than this is non-compliant.\n\n";
          sm += "\u2022 Court exposure range: " + $(res.cLA) + " to " + $(res.cHA) + " (" + res.cL + " to " + res.cH + " months), midpoint " + $(res.cMA) + " (" + res.cM + " months).\n\n";
          if (res.off !== null) {
            sm += "\u2022 Planned offer: " + $(res.off) + " (" + res.offMo + " months). ";
            if (res.off < res.esaAmt) sm += "BELOW STATUTORY MINIMUM. Must be increased.\n\n";
            else if (res.off < res.cLA) sm += "Below court range. High litigation risk.\n\n";
            else if (res.off < res.cMA) sm += "Below midpoint. Moderate litigation risk.\n\n";
            else sm += "At or above midpoint. Low litigation risk.\n\n";
          }
          if (res.vd > 0) sm += "\u2022 Vacation payout owed separately: " + $(res.vp) + " (" + res.vd + " days).\n\n";
          sm += "RECOMMENDED NEXT STEPS:\n";
          sm += "1. Have employment counsel review the package and release before presenting\n";
          sm += "2. Prepare all termination documents (termination letter, offer, release, ROE)\n";
          sm += "3. Conduct the termination meeting professionally and privately\n\n";
        } else {
          sm = "MY SEVERANCE ANALYSIS (from Parachute)\n\n";
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
        }
        sm += "This was generated by Parachute (useparachute.ca) for informational purposes only. It is not legal advice.";
        copy(sm, "s");
      }} full>{cp === "s" ? "\u2713 Copied!" : "Copy summary"}</Btn>
    </div></Fade>
  </div>;
}

/* ═══════════════════ GUIDES ═══════════════════ */
const GUIDE_DATA = [
  { id: "ON", name: "Ontario", esa: "Employment Standards Act, 2000", table: [["< 1 year","1 week"],["1 year","1 week"],["2 years","2 weeks"],["3 years","3 weeks"],["4 years","4 weeks"],["5 years","5 weeks"],["6 years","6 weeks"],["7 years","7 weeks"],["8+ years","8 weeks (max)"]],
    sections: [
      { t: "Ontario severance pay (separate from termination pay)", body: "Ontario is one of the few provinces with a separate severance pay on top of termination pay. You qualify if you have 5+ years of service AND your employer's annual payroll exceeds $2.5 million, or 50+ employees were let go within 6 months.\n\nSeverance pay is one week per year of service, up to 26 weeks. This is in addition to termination pay.\n\nFor example, an employee with 10 years at a qualifying employer receives 8 weeks of termination pay plus 10 weeks of severance pay = 18 weeks statutory minimum." },
      { t: "Waksdale and termination clauses", body: "Since the 2020 Ontario Court of Appeal decision in Waksdale v. Swegon North America Inc., many employment contract termination clauses have been invalidated. If any part of the termination provision fails to meet ESA minimums, the entire clause may be void, entitling the employee to full common law notice.\n\nThis is a significant vulnerability for employers and a strong leverage point for employees. If your contract was signed or amended after 2020, have a lawyer review the termination clause carefully." },
    ]},
  { id: "BC", name: "British Columbia", esa: "Employment Standards Act, RSBC 1996", table: [["< 3 months","None"],["3\u201312 months","1 week"],["1\u20133 years","2 weeks"],["3 years","3 weeks"],["4 years","4 weeks"],["5 years","5 weeks"],["6 years","6 weeks"],["7 years","7 weeks"],["8+ years","8 weeks (max)"]],
    sections: [
      { t: "No separate severance pay in BC", body: "Unlike Ontario, BC does not have a separate severance pay on top of termination pay. The statutory entitlement is limited to the table above. This makes the common law reasonable notice calculation even more important for BC employees, as it is almost always significantly higher than the statutory minimum." },
      { t: "BC Employment Standards Branch", body: "Employees who believe their employer has not met statutory minimums can file a complaint with the BC Employment Standards Branch within 6 months of termination. However, this process only covers statutory entitlements, not common law notice. For common law claims, you need to file in court or negotiate directly." },
    ]},
  { id: "AB", name: "Alberta", esa: "Employment Standards Code, RSA 2000", table: [["< 3 months","None"],["3 months \u2013 2 years","1 week"],["2\u20134 years","2 weeks"],["4\u20136 years","4 weeks"],["6\u20138 years","5 weeks"],["8\u201310 years","6 weeks"],["10+ years","8 weeks (max)"]],
    sections: [
      { t: "Alberta's tiered structure", body: "Alberta uses a tiered system that jumps from 2 weeks (at 2\u20134 years) to 4 weeks (at 4\u20136 years), creating a significant step-up. Employers should be aware of this threshold. There is no separate severance pay in Alberta." },
    ]},
  { id: "QC", name: "Quebec", esa: "Act respecting labour standards", table: [["< 3 months","None"],["3\u201312 months","1 week"],["1\u20135 years","2 weeks"],["5\u201310 years","4 weeks"],["10+ years","8 weeks (max)"]],
    sections: [
      { t: "Quebec: a civil law jurisdiction", body: "Quebec is fundamentally different from every other Canadian province. It operates under the Civil Code of Qu\u00e9bec, not the common law system. The concept of reasonable notice exists under art. 2091 of the Civil Code, but courts apply different factors and precedents.\n\nWhile the Bardal factors (age, tenure, role, availability of comparable work) are influential, Quebec courts have their own body of jurisprudence. Estimates from common law provinces should be treated as rough approximations." },
      { t: "Section 124: unjust dismissal", body: "Employees with 2+ years of continuous service who believe they were dismissed without good and sufficient cause can file a complaint under s. 124 of the ARLS. This is a powerful remedy that can result in reinstatement or compensation, separate from any notice entitlement." },
      { t: "Psychological harassment protections", body: "Quebec has strong protections against psychological harassment (s. 81.18\u201381.20 ARLS). If the termination is connected to workplace harassment, additional remedies may be available." },
    ]},
  { id: "FED", name: "Federal", esa: "Canada Labour Code, Part III", table: [["< 12 months","None"],["12+ months","2 weeks + severance (see below)"]],
    sections: [
      { t: "Federal severance pay formula", body: "Federally regulated employees with 12+ months of continuous service receive both termination pay (2 weeks) and severance pay. Severance is calculated as 5 days' wages per year of service, with a minimum of 2 days' wages. This applies to banking, telecommunications, airlines, railways, interprovincial transportation, and other federally regulated industries." },
      { t: "Section 240: unjust dismissal", body: "This is one of the strongest employee protections in Canada. Federally regulated employees with 12+ months of service who are dismissed without just cause can file an unjust dismissal complaint. Remedies may include reinstatement and compensation for lost wages. Strict time limits apply (90 days from dismissal).\n\nThis is a separate avenue from severance pay and can result in significantly more compensation." },
    ]},
  { id: "SK", name: "Saskatchewan", esa: "Saskatchewan Employment Act", table: [["< 3 months","None"],["3 months \u2013 1 year","1 week"],["1\u20133 years","2 weeks"],["3\u20135 years","4 weeks"],["5\u201310 years","6 weeks"],["10+ years","8 weeks (max)"]],
    sections: []},
  { id: "MB", name: "Manitoba", esa: "Employment Standards Code", table: [["< 3 months","None"],["3 months \u2013 1 year","1 week"],["1\u20133 years","2 weeks"],["3\u20135 years","4 weeks"],["5\u201310 years","6 weeks"],["10+ years","8 weeks (max)"]],
    sections: []},
  { id: "NS", name: "Nova Scotia", esa: "Labour Standards Code", table: [["< 3 months","None"],["3 months \u2013 2 years","1 week"],["2\u20135 years","2 weeks"],["5\u201310 years","4 weeks"],["10+ years","8 weeks (max)"]],
    sections: [
      { t: "Section 71: unjust dismissal (10+ years)", body: "Nova Scotia employees with 10+ years of continuous service have access to an unjust dismissal provision under s. 71 of the Labour Standards Code. This can result in reinstatement or compensation.\n\nImportant: employees in a managerial or supervisory capacity may be excluded from this provision. If you hold a management role, consult a lawyer to confirm whether the exemption applies." },
    ]},
  { id: "NB", name: "New Brunswick", esa: "Employment Standards Act", table: [["< 6 months","None"],["6 months \u2013 5 years","2 weeks"],["5+ years","4 weeks"]],
    sections: []},
  { id: "NL", name: "Newfoundland & Labrador", esa: "Labour Standards Act", table: [["< 3 months","None"],["3 months \u2013 2 years","1 week"],["2\u20135 years","2 weeks"],["5\u201310 years","3 weeks"],["10\u201315 years","4 weeks"],["15+ years","6 weeks"]],
    sections: []},
  { id: "PE", name: "Prince Edward Island", esa: "Employment Standards Act", table: [["< 6 months","None"],["6 months \u2013 5 years","2 weeks"],["5\u201310 years","4 weeks"],["10\u201315 years","6 weeks"],["15+ years","8 weeks"]],
    sections: []},
];

function Guides({ onBack }) {
  const [sel, setSel] = useState(null);
  const g = sel ? GUIDE_DATA.find(x => x.id === sel) : null;
  const T = "#0A6B5C";
  const BF = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  const HF = "'Instrument Serif', Georgia, serif";

  return <div style={{ minHeight: "100vh", background: "linear-gradient(165deg, var(--bg-page-1) 0%, var(--bg-page-2) 40%, var(--bg-page-3) 100%)", color: "var(--text)", fontFamily: BF }}>
    {/* Header */}
    <div style={{ background: "linear-gradient(135deg, #0A6B5C 0%, #085D50 40%, #0B5A65 100%)", padding: "14px 20px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Logo size={18} /><span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Parachute</span>
        </div>
      </div>
    </div>

    <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 20px" }}>
      {/* Back */}
      <div style={{ padding: "12px 0 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", padding: 0 }}>{"\u2190"} Back to Parachute</button>
      </div>

      {/* Intro */}
      <div style={{ padding: "20px 0 24px", borderBottom: "2px solid " + T, marginBottom: 24 }}>
        <h1 style={{ fontFamily: HF, fontSize: "clamp(28px, 7vw, 38px)", fontWeight: 400, lineHeight: 1.05, margin: "0 0 12px", color: "var(--text)" }}>Severance guides<br />by province</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>Each province and territory in Canada has its own employment standards legislation with different statutory minimums. These guides break down what you're owed in plain English — the legal floor, the common law range, and the jurisdiction-specific rules that matter most.</p>
      </div>

      {/* Province selector */}
      <p style={{ fontSize: 10, fontWeight: 700, color: T, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Select a jurisdiction</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 28 }}>
        {GUIDE_DATA.map(p => <button key={p.id} onClick={() => { setSel(sel === p.id ? null : p.id); }} style={{
          padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: sel === p.id ? 600 : 400,
          border: sel === p.id ? "2px solid " + T : "1.5px solid var(--border)",
          background: sel === p.id ? "rgba(10,107,92,.06)" : "var(--bg-card)",
          color: sel === p.id ? T : "var(--text-sec)",
          cursor: "pointer", transition: "all .12s",
        }}>{sel === p.id ? "\u2713 " : ""}{p.name}</button>)}
      </div>

      {/* Guide content */}
      {g && <div style={{ animation: "fadeIn .25s ease" }}>
        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-light)", padding: "18px", marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: T, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 4px" }}>{g.name}</p>
          <p style={{ fontSize: 13, color: "var(--text-sec)", margin: "0 0 2px" }}>{g.esa}</p>
          <p style={{ fontSize: 10, color: "var(--text-dim)", margin: 0 }}>Last updated: April 2026</p>
        </div>

        {/* Statutory table */}
        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-light)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ background: T, padding: "10px 16px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: ".05em" }}>Length of service</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: ".05em" }}>Minimum notice / pay</span>
          </div>
          {g.table.map(([tenure, notice], i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", borderBottom: i < g.table.length - 1 ? "1px solid var(--border-lighter)" : "none" }}>
            <span style={{ fontSize: 12, color: "var(--text-sec)" }}>{tenure}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{notice}</span>
          </div>)}
        </div>

        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-light)", padding: "16px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: "var(--text-sec)", margin: 0, lineHeight: 1.55 }}>These are <strong>absolute minimums</strong>. Your employer cannot offer less. If they do, they are in violation of employment standards legislation. In virtually every case, employees are entitled to significantly more under common law.</p>
        </div>

        {/* Province-specific sections */}
        {g.sections.map((s, i) => <div key={i} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-light)", padding: "16px", marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".03em" }}>{s.t}</p>
          {s.body.split("\n\n").map((para, j) => <p key={j} style={{ fontSize: 12, color: "var(--text-sec)", margin: "0 0 10px", lineHeight: 1.6 }}>{para}</p>)}
        </div>)}

        {/* Common law explanation */}
        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-light)", padding: "16px", marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".03em" }}>Common law reasonable notice</p>
          <p style={{ fontSize: 12, color: "var(--text-sec)", margin: "0 0 10px", lineHeight: 1.6 }}>The statutory minimums above are just the legal floor. In virtually every case, employees are entitled to significantly more under common law{g.id === "QC" ? " (or civil law in Quebec under art. 2091)" : ""}. Courts consider four main factors:</p>
          {["Length of service — the single most important factor", "Age — older employees receive more because re-employment is harder", "Character of employment — senior roles receive more because comparable positions are scarcer", "Availability of similar employment — industry, specialization, and market conditions"].map((f, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, fontSize: 12, color: "var(--text-sec)", lineHeight: 1.4 }}>
            <span style={{ color: T, flexShrink: 0 }}>{"\u2022"}</span><span>{f}</span>
          </div>)}
          <p style={{ fontSize: 12, color: "var(--text-sec)", margin: "10px 0 0", lineHeight: 1.6 }}>Common law notice periods typically range from 2 to 26 months, with most falling between 4 and 18 months.</p>
        </div>

        {/* CTA */}
        <div style={{ background: T, borderRadius: 14, padding: "24px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 18, fontFamily: HF, color: "#fff", margin: "0 0 8px" }}>Calculate your severance in 2 minutes</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.6)", margin: "0 0 16px" }}>Free. Private. No accounts. Covers all 14 jurisdictions.</p>
          <button onClick={onBack} style={{ padding: "12px 36px", borderRadius: 50, border: "none", background: "#fff", color: "#053D32", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Start your free analysis →</button>
        </div>

        {/* What to do */}
        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-light)", padding: "16px", marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".03em" }}>What to do in the first 72 hours</p>
          {["Do not sign anything — especially a release — until you understand your full entitlements.", "Request everything in writing — termination letter, severance offer, and any release document.", "Calculate your entitlements — use Parachute to get a free, private analysis of what you may be owed.", "Consult an employment lawyer — most offer free initial consultations."].map((item, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--text-sec)", lineHeight: 1.5 }}>
            <span style={{ color: T, flexShrink: 0, fontWeight: 700 }}>{i + 1}.</span><span>{item}</span>
          </div>)}
        </div>
      </div>}

      {/* No selection state */}
      {!sel && <div style={{ textAlign: "center", padding: "40px 0 60px" }}>
        <p style={{ fontSize: 14, color: "var(--text-dim)" }}>Select a province or territory above to see the guide.</p>
      </div>}

      {/* Disclaimer */}
      <div style={{ background: "var(--bg-warning)", borderRadius: 11, padding: "13px 15px", marginBottom: 10, border: "1px solid var(--border-warning)" }}>
        <p style={{ fontSize: 10.5, color: "var(--text-warning)", margin: 0, lineHeight: 1.5 }}>These guides are for informational purposes only. They do not constitute legal advice. Employment legislation changes frequently. Consult a qualified employment lawyer in your jurisdiction for advice specific to your situation.</p>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px 0 40px" }}>
        <p style={{ fontSize: 12, color: "var(--text-dim)" }}>&copy; {new Date().getFullYear()} Parachute. For informational purposes only.</p>
      </div>
    </div>
  </div>;
}

/* ═══════════════════ APP ═══════════════════ */
const EMPTY = { province: "", age: "", years: "", months: "", salary: "", bonus: "", role: "", jobTitle: "", sevElig: false, hasOffer: null, offFmt: "amt", offAmt: "", offWks: "", offMos: "", reason: "", induced: null, hasContract: null, contractTerms: false, contractAge: "", bens: [], industry: "", vacDays: "", signedRelease: null, deadline: null, deadlineDays: "", hasDependents: null, badFaith: null, newJob: "", nonCompete: null, empTermStatus: "", empDocLevel: "", empHumanRights: null, empGroupTerm: null };
function loadSession() { try { const s = sessionStorage.getItem("p_state"); if (s) { const p = JSON.parse(s); return { step: p.step ?? -1, d: { ...EMPTY, ...p.d }, mode: p.mode ?? "employee" }; } } catch {} return null; }
function saveSession(step, d, mode) { try { sessionStorage.setItem("p_state", JSON.stringify({ step, d, mode })); } catch {} }

function trk(e, p) { try { if (window.gtag) window.gtag("event", e, p); } catch {} }

export default function App() {
  const saved = useMemo(() => loadSession(), []);
  const [step, setStep] = useState(saved ? saved.step : -1);
  const [mode, setMode] = useState(saved ? saved.mode : "employee");
  const [dark, setDark] = useState(() => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [d, setD] = useState(saved ? saved.d : EMPTY);
  const [res, setRes] = useState(null);
  const [fade, setFade] = useState(false);
  const [page, setPage] = useState("main");
  const [showLeave, setShowLeave] = useState(false);

  useEffect(() => { if (step >= 1 && step <= 5) saveSession(step, d, mode); }, [step, d, mode]);

  function go(s) { setFade(true); setTimeout(() => { if (s === 6) { setRes(calc(d)); trk("analysis_completed", { province: d.province, mode }); } trk("step_completed", { step: s, mode }); setStep(s); window.scrollTo(0, 0); setTimeout(() => setFade(false), 25); }, 150); }

  const tenure = (parseFloat(d.years) || 0) + (parseFloat(d.months) || 0) / 12;
  const ok = step <= 0 ? true : step === 1 ? !!d.province : step === 2 ? !!(d.age && (d.years || d.months) && d.salary && d.role) : step === 3 ? !!(d.reason && (tenure >= 3 || d.induced !== null) && d.hasContract !== null) : step === 4 ? true : step === 5 ? d.hasOffer !== null && (d.hasOffer === false || !!((d.offFmt === "amt" && d.offAmt) || (d.offFmt === "wks" && d.offWks) || (d.offFmt === "mos" && d.offMos))) : false;

  function reset() { setStep(-1); setRes(null); setD(EMPTY); setMode("employee"); try { sessionStorage.removeItem("p_state"); } catch {} window.scrollTo(0, 0); }

  if (page === "guides") return <><ThemeStyle dark={dark} /><Guides onBack={() => { setPage("main"); window.scrollTo(0, 0); }} /></>;

  if (step === -1) return <><ThemeStyle dark={dark} /><Landing onStart={(m) => { setMode(m || "employee"); trk("analysis_started", { mode: m || "employee" }); setStep(1); window.scrollTo(0, 0); }} onGuides={() => { setPage("guides"); window.scrollTo(0, 0); trk("guides_opened"); }} /></>;

  return <><ThemeStyle dark={dark} /><div style={{ minHeight: "100vh", background: "linear-gradient(165deg, var(--bg-page-1) 0%, var(--bg-page-2) 40%, var(--bg-page-3) 100%)", color: "var(--text)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
    {step > 0 && step < 6 && <TopBar step={step} onBack={() => go(step === 1 ? -1 : step - 1)} dark={dark} setDark={setDark} onLogoClick={() => setShowLeave(true)} />}
    {step > 0 && step < 6 && <Dots c={step - 1} t={TS} />}
    <div style={{ opacity: fade ? 0 : 1, transform: fade ? "translateX(8px)" : "translateX(0)", transition: "all .15s ease", paddingTop: step === 6 ? 10 : 8, paddingBottom: step >= 1 && step <= 5 ? 72 : 14 }}>
      {step === 1 && <S1 d={d} setD={setD} mode={mode} />}
      {step === 2 && <S2 d={d} setD={setD} mode={mode} />}
      {step === 3 && <S3 d={d} setD={setD} mode={mode} />}
      {step === 4 && <S4 d={d} setD={setD} mode={mode} />}
      {step === 5 && <S5 d={d} setD={setD} mode={mode} />}
      {step === 6 && res && <Res res={res} onReset={reset} dark={dark} setDark={setDark} mode={mode} onLogoClick={() => setShowLeave(true)} />}
    </div>
    {step >= 1 && step <= 5 && <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 20px 16px", background: "linear-gradient(transparent, var(--nav-fade) 30%)" }}><div style={{ maxWidth: 430, margin: "0 auto" }}><Btn onClick={() => go(step + 1)} disabled={!ok} full>{step === 5 ? (mode === "employer" ? "Analyze exposure \u2192" : "Analyze my severance \u2192") : "Continue \u2192"}</Btn></div></div>}

    {/* Leave confirmation modal */}
    {showLeave && <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={() => setShowLeave(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: "var(--bg-card)", borderRadius: 16, padding: "24px", maxWidth: 340, width: "100%", border: "1px solid var(--border-light)", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>Leave this analysis?</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>You'll return to the home page. Your current progress will not be saved.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowLeave(false)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-card)", color: "var(--text-sec)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Stay here</button>
          <button onClick={() => { setShowLeave(false); reset(); }} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#0A6B5C", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Yes, go home</button>
        </div>
      </div>
    </div>}
  </div></>;
}
