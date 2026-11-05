'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Pill } from '@/components/ui';
import { api, errText } from '@/lib/api';
import { BrandMark } from '@/components/brand';
import './outreach.css';

type Rec = { email: string; name?: string; company?: string };
type Parsed = { valid: Rec[]; invalid: { line: string; reason: string }[]; duplicates: number; truncated: number; alreadyContacted: string[] };
type Found = Parsed & { seen: number };
type Camp = { id: string; name: string; subject: string; status: string; gapSec: number; nextAt: string | null; note: string | null; counts: Record<string, number>; total: number };
const TONES: Record<string, 'ok' | 'warn' | 'bad' | 'gray' | ''> = { running: 'ok', done: 'ok', paused: 'warn', draft: 'gray', cancelled: 'gray', sent: 'ok', failed: 'bad', queued: 'gray', sending: 'warn', skipped: 'gray' };
const SAMPLE = 'hr@acme.com\nPriya Shah <priya@zetacloud.io>\ntalent@brightpay.in, Ravi Kumar, Brightpay';
const MAX_IMG = 8 * 1024 * 1024;

const AI_TOOLTIPS: Record<string, string> = {
  improve: 'Polish vocabulary and improve sentence flow',
  shorter: 'Make the email punchy, brief, and concise',
  friendlier: 'Add a warm, polite, and personable tone',
  formal: 'Adopt professional and respectful business phrasing',
  confident: 'Emphasize achievements, value, and confidence',
  grammar: 'Correct all spelling, punctuation, and syntax errors',
};

const VAR_TOOLTIPS: Record<string, string> = {
  '{{name}}': 'Inserts the contact’s full name',
  '{{first_name}}': 'Inserts the contact’s first name (falls back to “there”)',
  '{{company}}': 'Inserts the company name (falls back to “your company”)',
};

function humanReason(reason: string) {
  if (/no email/i.test(reason)) return 'Missing @ or invalid format';
  if (/not a valid/i.test(reason)) return 'Domain or format looks incomplete';
  if (/no-reply/i.test(reason)) return 'Automated no-reply address (cannot receive replies)';
  if (/own address/i.test(reason)) return 'Matches your own sender address';
  return reason;
}

/** Shrinks big screenshots so the upload stays small and quick to read. */
async function prepImage(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image')); i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export default function Outreach() {
  const [text, setText] = useState(''); const [parsed, setParsed] = useState<Parsed | null>(null);
  const [resumes, setResumes] = useState<any[]>([]); const [resumeId, setResumeId] = useState('');
  const [name, setName] = useState(''); const [role, setRole] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [gap, setGap] = useState(45); const [extra, setExtra] = useState(true);
  const [lim, setLim] = useState<any>(null); const [camps, setCamps] = useState<Camp[]>([]);
  const [liveId, setLiveId] = useState<string | null>(null); const [live, setLive] = useState<any>(null);
  const [prev, setPrev] = useState<{ subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [undo, setUndo] = useState<string | null>(null); const [aiNote, setAiNote] = useState('');
  const [shot, setShot] = useState<string | null>(null); const [found, setFound] = useState<Found | null>(null); const [pick, setPick] = useState<Set<string>>(new Set()); const [drag, setDrag] = useState(false); const [secs, setSecs] = useState(0);
  const [confirmModal, setConfirmModal] = useState(false);

  const file = useRef<HTMLInputElement>(null);
  const imgIn = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLElement>(null);
  const step1Ref = useRef<HTMLElement>(null);
  const step2Ref = useRef<HTMLElement>(null);
  const step3Ref = useRef<HTMLElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);

  const loadCamps = useCallback(() => api<Camp[]>('/outreach/campaigns').then(setCamps).catch(() => undefined), []);
  const loadLive = useCallback((id: string) => api(`/outreach/campaigns/${id}`).then(setLive).catch(() => undefined), []);
  useEffect(() => {
    api<any[]>('/resumes').then((r) => { const withFile = r.filter((x) => (x.fileSize ?? 0) > 0); setResumes(withFile); if (withFile[0]) setResumeId(String(withFile[0]._id)); }).catch(() => undefined);
    api('/outreach/limits').then(setLim).catch(() => undefined); loadCamps();
  }, [loadCamps]);
  useEffect(() => {
    if (!text.trim()) { setParsed(null); return; }
    const t = setTimeout(() => { api<Parsed>('/outreach/parse', { body: { text } }).then(setParsed).catch(() => undefined); }, 350);
    return () => clearTimeout(t);
  }, [text]);

  // The live panel follows the running campaign (or the newest one) and refreshes every few seconds while sending.
  const runningCamp = camps.find((c) => c.status === 'running');
  useEffect(() => { if (!liveId) { const c = runningCamp ?? camps.find((x) => x.status === 'paused'); if (c) setLiveId(c.id); } }, [camps, liveId, runningCamp]);
  useEffect(() => { if (liveId) loadLive(liveId); else setLive(null); }, [liveId, loadLive]);
  const liveRunning = live?.status === 'running' || !!runningCamp;
  useEffect(() => {
    if (!liveRunning) return;
    const t = setInterval(() => { loadCamps(); if (liveId) loadLive(liveId); api('/outreach/limits').then(setLim).catch(() => undefined); }, 3000);
    return () => clearInterval(t);
  }, [liveRunning, liveId, loadCamps, loadLive]);

  // Paste a screenshot anywhere on the page.
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); readImage(f); }
    };
    window.addEventListener('paste', h); return () => window.removeEventListener('paste', h);
  });

  // Close confirmation modal on Escape
  useEffect(() => {
    if (!confirmModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmModal]);

  useEffect(() => { if (busy !== 'img') { setSecs(0); return; } const t = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(t); }, [busy]);
  async function readImage(f: Blob) {
    if (f.size > MAX_IMG * 2) { setErr('That image is too large. Use one under 16 MB.'); return; }
    setBusy('img'); setErr(''); setOk(''); setFound(null);
    try {
      const data = await prepImage(f); setShot(data);
      const r = await Promise.race([
        api<Found>('/outreach/from-image', { body: { image: data } }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Reading took too long. Try a smaller crop of the screenshot, or try again.')), 45_000)),
      ]);
      setFound(r); setPick(new Set(r.valid.filter((v) => !r.alreadyContacted.includes(v.email)).map((v) => v.email)));
      if (!r.valid.length) setErr('No email addresses were found in that image. Try a sharper or larger screenshot.');
    } catch (e) { setErr(e instanceof Error && !('status' in e) ? e.message : errText(e)); } finally { setBusy(''); }
  }
  function addPicked() {
    if (!found) return; const lines = found.valid.filter((v) => pick.has(v.email)).map((v) => [v.email, v.name ?? '', v.company ?? ''].join(', ').replace(/(, )+$/, ''));
    setText((t) => (t.trim() ? t.trimEnd() + '\n' : '') + lines.join('\n')); setOk(`Added ${lines.length} email${lines.length === 1 ? '' : 's'} from the image.`); setFound(null); setShot(null);
  }

  const n = parsed?.valid.length ?? 0;
  const minutes = Math.max(1, Math.round((n * gap * 1.3) / 60));
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const checks = [
    { ok: n > 0, t: n ? `${n} email${n > 1 ? 's' : ''}` : 'Add emails' },
    { ok: !!resumeId, t: resumeId ? 'Resume' : 'Pick resume' },
    { ok: name.trim().length > 0, t: 'Name' },
    { ok: subject.trim().length >= 3 && body.trim().length >= 20, t: 'Message' },
    { ok: !!lim?.gmailConnected, t: lim?.gmailConnected ? 'Gmail' : 'Connect Gmail' },
  ];
  const ready = n > 0 && !!resumeId && name.trim() && subject.trim().length >= 3 && body.trim().length >= 20;

  const missingRequirement = useMemo(() => {
    if (n === 0) return 'Add email contacts';
    if (!resumeId) return 'Choose a resume';
    if (!name.trim()) return 'Name your campaign';
    if (subject.trim().length < 3 || body.trim().length < 20) return 'Write your email';
    if (!lim?.gmailConnected) return 'Connect Gmail in Email Setup';
    return null;
  }, [n, resumeId, name, subject, body, lim?.gmailConnected]);

  async function draft() {
    setBusy('draft'); setErr('');
    try { const d = await api<{ subject: string; body: string }>('/outreach/draft', { body: { role: role || undefined } }); setUndo(body.trim() ? body : null); setSubject(d.subject); setBody(d.body); setPrev(null); setAiNote('Fresh draft written by AI. Edit freely or enhance it.'); }
    catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function enhance(action: string) {
    if (body.trim().length < 20) { setErr('Write or generate a message first, then enhance it.'); return; }
    setBusy('ai:' + action); setErr(''); setAiNote('');
    try { const r = await api<{ body: string }>('/outreach/enhance', { body: { body, action } }); setUndo(body); setBody(r.body); setPrev(null); setAiNote('Updated by AI. Read it once before sending.'); }
    catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  function insertTag(tag: string) {
    const el = bodyRef.current; if (!el) { setBody((b) => b + tag); return; }
    const a = el.selectionStart ?? body.length, z = el.selectionEnd ?? a; setBody(body.slice(0, a) + tag + body.slice(z));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); });
  }
  async function preview() {
    setBusy('prev'); setErr('');
    try { setPrev(await api('/outreach/preview', { body: { subject, body, resumeId: resumeId || undefined } })); } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function create(start: boolean) {
    setBusy(start ? 'start' : 'save'); setErr(''); setOk('');
    try {
      const r = await api('/outreach/campaigns', { body: { name, subject, body, resumeId, includeExtraFiles: extra, gapSec: gap, recipientsText: text, start } });
      setOk(start ? `Started: ${r.recipients} emails go out one by one. Watch the live panel.` : `Saved as a draft with ${r.recipients} recipients.`);
      setLiveId(r.id); if (start) { setText(''); setParsed(null); setPrev(null); setTimeout(() => liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }
      loadCamps(); loadLive(r.id); api('/outreach/limits').then(setLim);
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function act(id: string, what: 'start' | 'pause' | 'cancel' | 'retry') {
    if (what === 'cancel' && !window.confirm('Cancel this campaign? Emails already sent stay sent; the rest will not be sent.')) return;
    setErr(''); try { await api(`/outreach/campaigns/${id}/${what}`, { body: {} }); await loadCamps(); setLiveId(id); await loadLive(id); } catch (e) { setErr(errText(e)); }
  }
  function onFile(f?: File) { if (!f) return; const r = new FileReader(); r.onload = () => setText((t) => (t ? t + '\n' : '') + String(r.result ?? '')); r.readAsText(f); }

  const used = lim ? Math.min(100, Math.round((lim.sentLast24h / lim.dailyLimit) * 100)) : 0;
  const cur = useMemo(() => resumes.find((r) => String(r._id) === resumeId), [resumes, resumeId]);
  const AI_ACTIONS: [string, string][] = [['improve', 'Improve'], ['shorter', 'Shorter'], ['friendlier', 'Friendlier'], ['formal', 'Formal'], ['confident', 'Confident'], ['grammar', 'Fix grammar']];

  // live tracker figures
  const recs: any[] = live?.recipients ?? [];
  const cnt = (s: string) => recs.filter((r) => r.status === s).length;
  const sentN = cnt('sent'), failN = cnt('failed'), skipN = cnt('skipped'), total = recs.length;
  const pct = total ? Math.round(((sentN + failN + skipN) / total) * 100) : 0;
  const nowRec = recs.find((r) => r.status === 'sending') ?? (live?.status === 'running' ? recs.find((r) => r.status === 'queued') : null);
  const sending = live?.status === 'running';

  // 5-step status calculation
  const stepItems = [
    { id: 1, label: 'Add contacts', ref: step1Ref, status: n > 0 ? 'done' : 'active' },
    { id: 2, label: 'Write email', ref: step2Ref, status: (subject.trim().length >= 3 && body.trim().length >= 20) ? 'done' : (n > 0 ? 'active' : 'todo') },
    { id: 3, label: 'Settings', ref: step3Ref, status: (name.trim().length > 0 && !!resumeId) ? 'done' : ((subject.trim().length >= 3 && body.trim().length >= 20) ? 'active' : 'todo') },
    { id: 4, label: 'Preview & send', ref: step4Ref, status: live ? 'done' : ready ? 'active' : 'todo' },
    { id: 5, label: 'Track', ref: liveRef, status: live?.status === 'done' ? 'done' : sending ? 'active' : 'todo' },
  ];
  const activeStepIdx = stepItems.findIndex((s) => s.status === 'active');
  const currentStepNum = activeStepIdx !== -1 ? activeStepIdx + 1 : (stepItems.every((s) => s.status === 'done') ? 5 : 1);

  return (
    <div className="ou ob">
      <header className="ou-bar-top">
        <div className="ou-ttl"><span className="ou-logo"><BrandMark size={34} /></span><div><h1>HR Outreach</h1><small>AI writes it, the agent sends it one by one with your resume</small></div></div>
        <div className="ou-pills">
          <span className="ou-pill"><i className={`ou-dot ${lim?.gmailConnected ? 'on' : ''}`} />{lim ? (lim.gmailConnected ? 'Gmail connected' : <a href="/settings/email">Connect Gmail</a>) : '…'}</span>
          <span className="ou-pill"><b>{n}</b> ready{n > 0 && <em>· ≈{minutes} min</em>}</span>
          <span className="ou-pill"><b>{lim?.sentLast24h ?? 0}</b>/{lim?.dailyLimit ?? 50} today<span className="ou-mini"><i style={{ width: `${used}%` }} /></span></span>
          <span className={`ou-pill ${lim?.mailMode === 'gmail' ? '' : 'warn'}`}>{lim?.mailMode === 'gmail' ? 'Live sending' : 'Test mode'}</span>
        </div>
      </header>

      {/* 5-Step Progress Guide */}
      <nav className="ob-tracker" aria-label="Outreach process steps">
        <div className="ob-stepper">
          {stepItems.map((s, idx) => (
            <div key={s.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button
                type="button"
                className={`ob-step-btn ${s.status}`}
                onClick={() => s.ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                title={`Go to step ${s.id}: ${s.label}`}
              >
                <span className="ob-step-num">{s.status === 'done' ? '✓' : s.id}</span>
                <span>{s.label}</span>
              </button>
              {idx < stepItems.length - 1 && <span className="ob-step-sep" aria-hidden="true" />}
            </div>
          ))}
        </div>
        <div className="ob-step-mobile-bar">
          <span>Step {currentStepNum} of 5: {stepItems[currentStepNum - 1]?.label}</span>
          <div className="ob-step-mobile-pills">
            {stepItems.map((s) => (
              <span key={s.id} className={`ob-step-mobile-dot ${s.status}`} />
            ))}
          </div>
        </div>
      </nav>

      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok" role="status">{ok}</div>}

      <div className="ou-cols">
        {/* ---------- column A: recipients (Step 1) ---------- */}
        <section className="card ou-c" ref={step1Ref as any} id="step-1">
          <div className="ob-card-h">
            <span className="ou-n">1</span>
            <div className="ob-card-h-text">
              <h2>1. Who do you want to email?</h2>
              <p className="ob-help">Add recruiter, talent team, or hiring manager email addresses.</p>
            </div>
            {n > 0 ? <Pill tone="ok">{n} ready</Pill> : <span className="ob-badge-limit">Up to 100</span>}
          </div>

          <div className={`ou-drop ${drag ? 'drag' : ''} ${busy === 'img' ? 'busy' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) readImage(f); }}>
            <input ref={imgIn} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readImage(f); e.target.value = ''; }} />
            {shot ? <img src={shot} alt="Your screenshot" /> : <span className="ou-drop-ic"><Icon name="file" size={18} /></span>}
            <div className="ou-drop-t">
              {busy === 'img' ? <><b>AI is reading your image…</b><small>Finding every email address · {secs}s</small></> : (
                <>
                  <b>Upload or paste a screenshot of contacts</b>
                  <small>
                    <span className="ob-desktop-hint">Press <kbd>Ctrl</kbd>+<kbd>V</kbd>, drop an image, or </span>
                    <span className="ob-touch-hint">Tap to choose a screenshot or photo </span>
                    <button type="button" onClick={() => imgIn.current?.click()}>choose a file</button>
                  </small>
                </>
              )}
            </div>
            {busy === 'img' && <span className="ou-scan" />}
          </div>

          {found && found.valid.length > 0 && (
            <div className="ou-found">
              <div className="ou-found-h"><b>AI found {found.valid.length} email{found.valid.length > 1 ? 's' : ''}</b><span className="sp" />
                <button type="button" onClick={() => setPick(new Set(found.valid.map((v) => v.email)))}>All</button><button type="button" onClick={() => setPick(new Set())}>None</button></div>
              <div className="ou-found-l">{found.valid.map((v, i) => {
                const on = pick.has(v.email), was = found.alreadyContacted.includes(v.email);
                return <label key={v.email} className={on ? 'on' : ''} style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}><input type="checkbox" checked={on} onChange={() => setPick((s) => { const x = new Set(s); on ? x.delete(v.email) : x.add(v.email); return x; })} /><span>{v.name ? `${v.name} · ` : ''}{v.email}</span>{was && <em>emailed</em>}</label>;
              })}</div>
              <div className="ou-found-f"><span className="faint">Check each address before adding. AI can misread blurry text.</span><button type="button" className="btn sm primary" onClick={addPicked} disabled={pick.size === 0}>Add {pick.size} selected</button></div>
            </div>
          )}

          <label className="f ou-f">
            <span>Paste email addresses</span>
            <textarea className="ou-ta" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={`hr@acme.com\nPriya Shah <priya@zetacloud.io>\ntalent@brightpay.in, Ravi Kumar, Brightpay`} aria-label="HR email addresses" />
          </label>

          <div className="ou-row">
            <input ref={file} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className="btn sm" onClick={() => file.current?.click()} title="Upload CSV or plain text file with email addresses"><Icon name="file" size={12} />CSV or TXT file</button>
            <button type="button" className="btn sm" onClick={() => setText(SAMPLE)} title="Insert sample recruiters to try the flow">Fill with example</button>
            {text && <button type="button" className="btn sm" onClick={() => setText('')} title="Clear pasted contacts">Clear</button>}
          </div>

          {parsed ? (
            <div className="ou-parse">
              <div className="ob-summary-row">
                <Pill tone="ok">{parsed.valid.length} valid</Pill>
                {parsed.duplicates > 0 && <Pill tone="gray">{parsed.duplicates} duplicate</Pill>}
                {parsed.invalid.length > 0 && <Pill tone="bad">{parsed.invalid.length} invalid</Pill>}
                {parsed.truncated > 0 && <Pill tone="warn">{parsed.truncated} over limit</Pill>}
                {parsed.alreadyContacted.length > 0 && <Pill tone="warn">{parsed.alreadyContacted.length} emailed recently</Pill>}
              </div>
              <div className="ou-chips">{parsed.valid.slice(0, 60).map((v) => <span key={v.email} title={v.company ?? ''}>{v.email}</span>)}{parsed.valid.length > 60 && <span>+{parsed.valid.length - 60}</span>}</div>
              {parsed.invalid.length > 0 && (
                <ul className="ou-bad">
                  {parsed.invalid.slice(0, 3).map((i, k) => (
                    <li key={k}><code>{i.line}</code> — {humanReason(i.reason)}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="ob-empty-state">
              <Icon name="users" size={16} />
              <span>No contacts yet. Paste emails above or upload a screenshot.</span>
            </div>
          )}
          <p className="faint ou-hint">One per line: <code>hr@acme.com</code>, <code>Name &lt;hr@acme.com&gt;</code> or CSV <code>email, name, company</code>. Up to 100 per campaign.</p>
        </section>

        {/* ---------- column B: compose (Step 2) ---------- */}
        <section className="card ou-c ou-compose" ref={step2Ref as any} id="step-2">
          <div className="ob-card-h">
            <span className="ou-n">2</span>
            <div className="ob-card-h-text">
              <h2>2. Write your email</h2>
              <p className="ob-help">Craft a tailored outreach email with AI or write your own.</p>
            </div>
            {cur && <span className="faint ou-att" title={cur.fileName}><Icon name="file" size={11} />{cur.fileName}</span>}
          </div>

          <div className="ou-ai">
            <label className="f ou-f">
              <span>Role you&apos;re applying for</span>
              <div className="ou-ai-row">
                <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Full Stack Developer, Frontend Engineer" maxLength={120} aria-label="Role you're applying for" />
                <button
                  type="button"
                  className="ou-ai-go icon-only"
                  onClick={draft}
                  disabled={!!busy}
                  title={busy === 'draft' ? 'AI is drafting your email…' : body.trim() ? 'Rewrite with AI' : 'Draft email with AI'}
                  aria-label={busy === 'draft' ? 'Writing…' : body.trim() ? 'Rewrite with AI' : 'Write with AI'}
                >
                  <Icon name="spark" size={18} />
                </button>
              </div>
            </label>

            <div className="ob-enhance-group" role="group" aria-label="Improve the draft">
              <span className="ob-enhance-header">Improve the draft</span>
              <div className="ob-enhance-chips">
                {AI_ACTIONS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    title={AI_TOOLTIPS[k] ?? label}
                    onClick={() => enhance(k)}
                    disabled={!!busy || body.trim().length < 20}
                  >
                    {busy === 'ai:' + k ? '…' : label}
                  </button>
                ))}
                {undo !== null && (
                  <button
                    type="button"
                    className="ou-undo"
                    title="Revert back to your previous draft"
                    onClick={() => { setBody(undo); setUndo(null); setAiNote(''); }}
                  >
                    ↶ Undo
                  </button>
                )}
              </div>
            </div>
            {aiNote && <div className="ou-ai-note">{aiNote}</div>}
          </div>

          <label className="f ou-f">
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} placeholder="e.g. Application for Full Stack Developer — Your Name" />
          </label>

          <div className="f ou-f">
            {/* Variable chips placed directly above editor */}
            <div className="ob-var-wrap">
              <div className="ob-var-row">
                <span className="ob-var-label">Personalize</span>
                {['{{name}}', '{{first_name}}', '{{company}}'].map((t) => (
                  <button key={t} type="button" title={VAR_TOOLTIPS[t] ?? `Insert ${t}`} onClick={() => insertTag(t)}>{t}</button>
                ))}
                <span className="ob-var-example">Example: “Hello {`{{first_name}}`}” becomes “Hello Priya”</span>
              </div>
            </div>

            <div className="ou-lab">
              <span>Message</span>
              <span className="faint">{words} words · Short emails (80 to 150 words) get more replies</span>
            </div>
            <textarea
              ref={bodyRef}
              className="ou-ta ob-msg-ta"
              rows={11}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={8000}
              aria-label="Message"
              placeholder={'e.g. Dear {{first_name}},\n\nI noticed {{company}} is growing its engineering team and wanted to reach out regarding…\n\nTip: Press “Write with AI” above to draft this from your resume.'}
            />
            <small className="faint" style={{ marginTop: 2 }}>Signature is added automatically.</small>
          </div>
        </section>

        {/* ---------- column C: settings (Step 3) + live (Step 5) ---------- */}
        <div className="ou-side">
          <section className="card ou-c" ref={step3Ref as any} id="step-3">
            <div className="ob-card-h">
              <span className="ou-n">3</span>
              <div className="ob-card-h-text">
                <h2>3. Send settings</h2>
                <p className="ob-help">Set your sending pace and resume attachment.</p>
              </div>
            </div>
            <label className="f ou-f">
              <span>Campaign name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Full Stack Jobs, November" maxLength={120} />
            </label>
            <label className="f ou-f">
              <span>Resume to attach</span>
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>{resumes.length === 0 && <option value="">Upload a resume PDF first</option>}{resumes.map((r) => <option key={r._id} value={r._id}>{r.title} · {r.fileName}</option>)}</select>
              {resumes.length === 0 && <span className="faint">Add a PDF in <a href="/resumes" style={{ color: 'var(--primary-600)' }}>Resume Studio</a>.</span>}
            </label>
            <div className="ou-two">
              <label className="f ou-f">
                <span>Pacing (gap between emails)</span>
                <select value={gap} onChange={(e) => setGap(Number(e.target.value))}>{[10, 15, 20, 30, 45, 60, 90, 120, 180].map((s) => <option key={s} value={s}>{s >= 60 ? `${s / 60} min` : `${s} sec`}</option>)}</select>
              </label>
              <label className="ou-check" title="Attach additional portfolio or project files uploaded in Resume Studio">
                <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} />
                <span>Extra files</span>
              </label>
            </div>
            <div className="faint ou-warn">
              {gap < 30 ? 'Very fast sending can look like spam to Gmail. A 30–60 second gap is safer.' : 'A 30–60 second gap protects your Gmail sender reputation from spam filters.'}
            </div>
          </section>

          {/* ---------- Step 5: Live sending ---------- */}
          <section className="card ou-c ou-live" ref={liveRef as any} id="step-5">
            <div className="ob-card-h">
              <span className="ou-n">5</span>
              <div className="ob-card-h-text">
                <h2>Track live sending</h2>
                <p className="ob-help">Real-time status of outgoing emails.</p>
              </div>
              {live && <Pill tone={TONES[live.status] ?? ''}>{live.status}</Pill>}
            </div>
            {!live ? (
              <div className="ou-idle"><div className="ou-stage idle"><span className="ou-doc"><i /><i /><i /></span><span className="ou-track" /><span className="ou-env"><Icon name="send" size={14} /></span></div><small>Start a campaign and watch each email fly out here.</small></div>
            ) : (
              <>
                <div className={`ou-stage ${sending ? 'go' : ''}`}>
                  <span className="ou-doc" title="Resume attached"><i /><i /><i /><b>PDF</b></span>
                  <span className="ou-track"><span className="ou-fly"><Icon name="send" size={13} /></span></span>
                  <span className="ou-to">{sending && nowRec ? <><small>Sending to</small><b>{nowRec.name || nowRec.email}</b></> : live.status === 'done' ? <><small>Finished</small><b>{sentN} sent</b></> : <><small>{live.status}</small><b>—</b></>}</span>
                </div>
                <div className="ou-meter"><div className="ou-ring" style={{ ['--p' as any]: pct }}><b>{pct}%</b></div>
                  <div className="ou-num"><span><b className="g">{sentN}</b> sent</span><span><b>{total - sentN - failN - skipN}</b> waiting</span>{failN > 0 && <span><b className="r">{failN}</b> failed</span>}{skipN > 0 && <span><b>{skipN}</b> skipped</span>}</div></div>
                <div className="ou-names"><b>{live.name}</b>{sending && live.nextAt ? <small>next at {new Date(live.nextAt).toLocaleTimeString()}</small> : null}</div>
                {live.note && <div className="msg warn" style={{ margin: 0 }}>{live.note}</div>}
                <div className="ou-feed">{recs.map((r) => (
                  <div key={r.email} className={`ou-r ${r.status}`}>
                    <span className="ou-st">{r.status === 'sent' ? <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : r.status === 'failed' ? '!' : r.status === 'sending' ? <i className="ou-spin" /> : r.status === 'skipped' ? '–' : ''}</span>
                    <span className="ou-em">{r.name ? <b>{r.name}</b> : null}{r.email}</span>
                    <small>{r.status === 'sent' ? 'sent ✓' : r.status === 'sending' ? 'sending…' : r.status === 'failed' ? (r.error ?? 'failed') : r.status}</small>
                  </div>))}</div>
                <div className="ou-row">
                  {live.status === 'running' && <button className="btn sm" onClick={() => act(live.id, 'pause')}><Icon name="pause" size={12} />Pause</button>}
                  {(live.status === 'paused' || live.status === 'draft') && <button className="btn sm primary" onClick={() => act(live.id, 'start')}><Icon name="send" size={12} />{live.status === 'draft' ? 'Start' : 'Resume'}</button>}
                  {failN > 0 && <button className="btn sm" onClick={() => act(live.id, 'retry')}><Icon name="retry" size={12} />Retry failed</button>}
                  {['running', 'paused', 'draft'].includes(live.status) && <button className="btn sm" onClick={() => act(live.id, 'cancel')}>Cancel</button>}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ---------- Step 4: Preview and send Action Bar ---------- */}
      <div className="ou-bottom card" ref={step4Ref} id="step-4">
        <ul className="ou-checks">{checks.map((c) => <li key={c.t} className={c.ok ? 'ok' : ''}><i>{c.ok ? '✓' : ''}</i>{c.t}</li>)}</ul>
        <span className="sp" />

        {!ready && missingRequirement && (
          <span className="ob-missing-req" title={`Required: ${missingRequirement}`}><Icon name="alert" size={13} />Missing: {missingRequirement}</span>
        )}

        <button type="button" className="btn sm" onClick={preview} disabled={!body.trim() || !!busy} title="Preview resolved email with actual contact variables"><Icon name="search" size={13} />{busy === 'prev' ? 'Building…' : 'Preview'}</button>
        <button type="button" className="btn sm" onClick={() => create(false)} disabled={!ready || !!busy} title="Save this campaign setup without sending">Save draft</button>
        <button
          type="button"
          className="btn primary ou-start"
          onClick={() => setConfirmModal(true)}
          disabled={!ready || !!busy}
          title={ready ? 'Review and launch this outreach campaign' : `Disabled: ${missingRequirement}`}
        >
          <Icon name="send" size={14} />
          {busy === 'start' ? 'Starting…' : `Start sending${n ? ` to ${n}` : ''}`}
        </button>
      </div>

      {/* Campaigns History */}
      {camps.length > 0 && (
        <section className="card ou-c">
          <div className="ou-h"><h2>Campaigns</h2><span className="sp" /><small className="faint">{camps.length} total</small></div>
          <div className="ou-clist">{camps.map((c) => {
            const d = c.counts.sent + c.counts.failed + c.counts.skipped; const p = c.total ? Math.round((d / c.total) * 100) : 0;
            return (
              <button key={c.id} type="button" className={`ou-cm ${liveId === c.id ? 'on' : ''}`} onClick={() => { setLiveId(c.id); liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                <span className="ou-cm-t"><b>{c.name}</b><Pill tone={TONES[c.status] ?? ''}>{c.status}</Pill></span>
                <span className="ou-prog"><i style={{ width: `${p}%` }} /></span>
                <small>{c.counts.sent}/{c.total} sent{c.counts.failed ? ` · ${c.counts.failed} failed` : ''}</small>
              </button>);
          })}</div>
        </section>
      )}

      {/* Preview Modal */}
      {prev && (
        <div className="ou-modal" role="dialog" aria-modal="true" aria-label="Email preview" onClick={() => setPrev(null)}>
          <div className="ou-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="ou-sub">
              <div>
                <b>Subject:</b> {prev.subject}
                <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>
                  From: {lim?.gmailEmail || 'your connected Gmail'} · To: {n} recipient{n === 1 ? '' : 's'} · Gap: {gap}s
                </div>
              </div>
              <button className="btn sm" onClick={() => setPrev(null)} aria-label="Close preview"><Icon name="close" size={13} />Close</button>
            </div>
            <iframe title="Email preview" sandbox="" srcDoc={prev.html} />
          </div>
        </div>
      )}

      {/* Confirmation Dialog before Campaign Launch */}
      {confirmModal && (
        <div className="ob-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="ob-confirm-title" onClick={() => setConfirmModal(false)}>
          <div className="ob-confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="ob-confirm-header">
              <h3 id="ob-confirm-title">Ready to launch outreach?</h3>
              <button type="button" className="btn sm" onClick={() => setConfirmModal(false)} aria-label="Close dialog"><Icon name="close" size={13} /></button>
            </div>
            <div className="ob-confirm-body">
              <p>
                Send <b>{n} email{n === 1 ? '' : 's'}</b> from <b>{lim?.gmailEmail || 'your connected Gmail'}</b>?
              </p>
              <div className="ob-confirm-card">
                <div className="ob-confirm-card-row"><span>Sending pace:</span><b>1 email every {gap}s</b></div>
                <div className="ob-confirm-card-row"><span>Total duration:</span><b>approx. {minutes} minutes</b></div>
                <div className="ob-confirm-card-row"><span>Resume:</span><b>{cur?.fileName || cur?.title || 'Selected resume PDF'}</b></div>
                <div className="ob-confirm-card-row"><span>Extra files:</span><b>{extra ? 'Included' : 'None'}</b></div>
              </div>
              <small className="faint">Each email is personalized and sent individually through your Gmail account to ensure maximum deliverability.</small>
            </div>
            <div className="ob-confirm-footer">
              <button type="button" className="btn" onClick={() => setConfirmModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setConfirmModal(false);
                  create(true);
                }}
                disabled={!!busy}
              >
                <Icon name="send" size={14} /> Send now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
