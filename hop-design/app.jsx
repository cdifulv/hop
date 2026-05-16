// hop — internal URL shortener for Somerset Capital
// Single-page layout: hero shortener form + recent links list.

const { useState, useEffect, useRef, useMemo } = React;

// ───────────────────────────────────────────────────────────── mock data ──
const SEED_LINKS = [
  {
    id: 'l1', slug: 'q3-deck',
    dest: 'https://docs.google.com/presentation/d/1aB3xZ/edit#slide=id.p1',
    title: 'Q3 LP Update — Final.pptx',
    clicks: 124, createdAt: hoursAgo(7), expiresAt: null, owner: 'mara.l',
  },
  {
    id: 'l2', slug: 'all-hands',
    dest: 'https://somerset.zoom.us/j/82910384721?pwd=aGFsbGFuZHM',
    title: 'All-Hands · Recurring Zoom',
    clicks: 213, createdAt: hoursAgo(28), expiresAt: null, owner: 'ops',
  },
  {
    id: 'l3', slug: 'onboard',
    dest: 'https://www.notion.so/somerset/Onboarding-Hub-7f4a2c1e',
    title: 'Onboarding Hub — Notion',
    clicks: 47, createdAt: hoursAgo(96), expiresAt: null, owner: 'people',
  },
  {
    id: 'l4', slug: 'aurora-memo',
    dest: 'https://drive.google.com/file/d/1ABCdefGHIjklMNOpqrSTU/view',
    title: 'Project Aurora — IC Memo (Draft 4)',
    clicks: 89, createdAt: hoursAgo(52), expiresAt: hoursAhead(24 * 6), owner: 'kenji.w',
  },
  {
    id: 'l5', slug: 'policy-2026',
    dest: 'https://somcap.box.com/s/policy-handbook-2026-final',
    title: 'Compliance Handbook 2026',
    clicks: 8, createdAt: hoursAgo(11), expiresAt: hoursAhead(24 * 28), owner: 'legal',
  },
  {
    id: 'l6', slug: 'lp-portal',
    dest: 'https://lpportal.somcap.com/dashboard',
    title: 'LP Portal — Production',
    clicks: 612, createdAt: hoursAgo(24 * 41), expiresAt: null, owner: 'eng',
  },
];

function hoursAgo(h) { return Date.now() - h * 3600 * 1000; }
function hoursAhead(h) { return Date.now() + h * 3600 * 1000; }

// ───────────────────────────────────────────────────────────── utilities ──
const SHORT_DOMAIN = 'somcap.com';

function formatAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function formatExpiry(ts) {
  if (!ts) return null;
  const diff = (ts - Date.now()) / 1000;
  if (diff < 0) return { label: 'expired', tone: 'error' };
  if (diff < 86400) return { label: `expires in ${Math.max(1, Math.floor(diff / 3600))}h`, tone: 'warning' };
  const d = Math.floor(diff / 86400);
  if (d < 7) return { label: `expires in ${d}d`, tone: 'warning' };
  if (d < 30) return { label: `expires in ${d}d`, tone: 'muted' };
  return { label: `expires in ${Math.floor(d / 30)}mo`, tone: 'muted' };
}

function prettyHost(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch { return url; }
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function randomSlug() {
  // Slightly playful — 2-syllable words, then a number
  const words = ['leap', 'bound', 'skip', 'jump', 'pounce', 'spring', 'vault', 'dart', 'glide'];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}-${Math.floor(100 + Math.random() * 900)}`;
}

function isValidUrl(s) {
  if (!s) return false;
  try { const u = new URL(s.match(/^https?:\/\//) ? s : 'https://' + s); return !!u.hostname && u.hostname.includes('.'); }
  catch { return false; }
}

// ───────────────────────────────────────────────────────────── icons ──
const Icon = {
  Copy: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="5.5" y="5.5" width="8" height="9" rx="1.5"/><path d="M3 10.5V3a1.5 1.5 0 0 1 1.5-1.5h6"/></svg>),
  Check: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5 6.5 12 13 4.5"/></svg>),
  Sun: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1"/></svg>),
  Moon: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7Z"/></svg>),
  External: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5H4A1.5 1.5 0 0 0 2.5 5v7A1.5 1.5 0 0 0 4 13.5h7A1.5 1.5 0 0 0 12.5 12v-2"/><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5"/></svg>),
  Trash: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 4.5h10M6.5 4.5v-1A1 1 0 0 1 7.5 2.5h1a1 1 0 0 1 1 1v1M4.5 4.5l.5 8a1.5 1.5 0 0 0 1.5 1.4h3a1.5 1.5 0 0 0 1.5-1.4l.5-8"/></svg>),
  Edit: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 2.5 3 3-7.5 7.5H3v-3l7.5-7.5Z"/></svg>),
  Arrow: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8h9M9 4.5l3.5 3.5L9 11.5"/></svg>),
  Search: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>),
  Calendar: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M5 2v3M11 2v3M2.5 7h11"/></svg>),
  Chevron: (p) => (<svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 6 3.5 4 3.5-4"/></svg>),
  Bunny: (p) => (
    // simple wordmark accent — two stacked circles (head + body silhouette)
    <svg {...p} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="6" r="2.6"/>
      <circle cx="8" cy="12" r="1.4"/>
    </svg>
  ),
};

// ───────────────────────────────────────────────────────────── header ──
function Logo() {
  return (
    <div className="logo" aria-label="hop">
      <span className="logo-dot" />
      <span className="logo-word">hop</span>
    </div>
  );
}

function Header({ tweaks, setTweak }) {
  return (
    <header className="topbar">
      <Logo />
      <div className="topbar-right">
        <div className="env-pill" title="Internal tool — Somerset Capital">
          <span className="env-dot" /> Internal · Somerset
        </div>
        <button className="icon-btn" onClick={() => setTweak('dark', !tweaks.dark)}
                aria-label="Toggle theme">
          {tweaks.dark ? <Icon.Sun width="16" height="16"/> : <Icon.Moon width="16" height="16"/>}
        </button>
        <div className="avatar" title="You · mara.l">ML</div>
      </div>
    </header>
  );
}

// ───────────────────────────────────────────────────────────── shortener ──
const EXPIRY_PRESETS = [
  { value: 'never', label: 'Never', hours: null },
  { value: '1d',    label: '1 day',   hours: 24 },
  { value: '1w',    label: '1 week',  hours: 24 * 7 },
  { value: '1m',    label: '1 month', hours: 24 * 30 },
];

function Shortener({ onCreate, links, tweaks }) {
  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [expiry, setExpiry] = useState('never');
  const [shake, setShake] = useState(false);
  const urlRef = useRef(null);

  const suggested = useMemo(() => slug || (url ? slugify(url) : ''), [url, slug]);
  const takenSlug = useMemo(() => links.some(l => l.slug === suggested), [links, suggested]);
  const urlOk = isValidUrl(url);
  const canSubmit = urlOk && suggested && !takenSlug;

  function submit(e) {
    e?.preventDefault();
    if (!canSubmit) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      if (!urlOk) urlRef.current?.focus();
      return;
    }
    const preset = EXPIRY_PRESETS.find(p => p.value === expiry);
    const normalized = url.match(/^https?:\/\//) ? url : 'https://' + url;
    onCreate({
      url: normalized,
      slug: suggested,
      expiresAt: preset.hours ? hoursAhead(preset.hours) : null,
    });
    setUrl(''); setSlug(''); setSlugTouched(false); setExpiry('never');
    urlRef.current?.focus();
  }

  return (
    <section className={`shortener ${shake ? 'shake' : ''}`}>
      <div className="prompt">
        <div className="eyebrow">{tweaks.eyebrow}</div>
        <h1 className="display">
          {tweaks.headline === 'playful'
            ? <>Let's hop <em>somewhere</em> new.</>
            : tweaks.headline === 'direct'
            ? <>Shorten a link.</>
            : <>A short URL, in one <em>hop</em>.</>}
        </h1>
        <p className="lede">
          Paste a long URL — get a tidy <code>{SHORT_DOMAIN}/…</code> link people will <span className="nowrap">actually click</span>.
        </p>
      </div>

      <form className="shortener-card" onSubmit={submit}>
        <label className="field field-primary">
          <span className="field-label">Long URL</span>
          <input
            ref={urlRef}
            type="text"
            className="input input-lg"
            placeholder="https://docs.google.com/document/d/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            spellCheck="false"
            autoComplete="off"
          />
        </label>

        <div className="field-row">
          <label className="field field-slug">
            <span className="field-label">Custom slug <span className="field-hint">optional</span></span>
            <div className="slug-input">
              <span className="slug-prefix">{SHORT_DOMAIN}/</span>
              <input
                type="text"
                className="input input-slug"
                placeholder={url ? suggested : 'leap-204'}
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                spellCheck="false"
                autoComplete="off"
              />
              {!slugTouched && (
                <button type="button" className="slug-dice" title="Suggest a slug"
                        onClick={() => { setSlug(randomSlug()); setSlugTouched(true); }}>
                  ⇆
                </button>
              )}
            </div>
            {takenSlug && suggested && (
              <span className="field-err">already taken — pick another</span>
            )}
          </label>

          <label className="field field-expiry">
            <span className="field-label">Expiration</span>
            <div className="seg">
              {EXPIRY_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`seg-btn ${expiry === p.value ? 'on' : ''}`}
                  onClick={() => setExpiry(p.value)}
                >{p.label}</button>
              ))}
            </div>
          </label>
        </div>

        <div className="shortener-foot">
          <div className="preview">
            <span className="preview-label">Preview</span>
            <code className={`preview-url ${urlOk && suggested && !takenSlug ? 'ready' : ''}`}>
              {SHORT_DOMAIN}/<b>{suggested || '…'}</b>
            </code>
          </div>
          <button type="submit" className={`btn-primary ${canSubmit ? '' : 'disabled'}`}>
            <span>Hop it</span>
            <Icon.Arrow width="14" height="14" />
          </button>
        </div>
      </form>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── link row ──
function LinkRow({ link, isNew, onDelete, onCopy }) {
  const [copied, setCopied] = useState(false);
  const expiry = formatExpiry(link.expiresAt);
  const shortUrl = `${SHORT_DOMAIN}/${link.slug}`;
  const expired = expiry?.tone === 'error';

  function copy() {
    try { navigator.clipboard?.writeText('https://' + shortUrl); } catch {}
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className={`row ${isNew ? 'row-new' : ''} ${expired ? 'row-expired' : ''}`}>
      <div className="row-main">
        <div className="row-short">
          <a className="short-link" href={'https://' + shortUrl} target="_blank" rel="noreferrer">
            <span className="short-domain">{SHORT_DOMAIN}/</span>
            <span className="short-slug">{link.slug}</span>
          </a>
          {expiry && (
            <span className={`badge badge-${expiry.tone}`}>
              {expired ? <Icon.Calendar width="11" height="11"/> : null}
              {expiry.label}
            </span>
          )}
        </div>
        <div className="row-dest">
          <span className="row-host">{prettyHost(link.dest)}</span>
          <span className="row-sep">·</span>
          <span className="row-title" title={link.dest}>{link.title || link.dest}</span>
        </div>
      </div>

      <div className="row-meta">
        <div className="metric">
          <div className="metric-num">{link.clicks.toLocaleString()}</div>
          <div className="metric-lbl">clicks</div>
        </div>
        <div className="metric metric-muted">
          <div className="metric-num">{formatAgo(link.createdAt)}</div>
          <div className="metric-lbl">created</div>
        </div>
      </div>

      <div className="row-actions">
        <button className={`icon-btn ${copied ? 'copied' : ''}`} onClick={copy}
                title={copied ? 'Copied' : 'Copy link'}>
          {copied ? <Icon.Check width="14" height="14"/> : <Icon.Copy width="14" height="14"/>}
        </button>
        <button className="icon-btn" title="Open destination"
                onClick={() => window.open(link.dest, '_blank')}>
          <Icon.External width="14" height="14"/>
        </button>
        <button className="icon-btn icon-btn-danger" onClick={() => onDelete(link.id)}
                title="Delete link">
          <Icon.Trash width="14" height="14"/>
        </button>
      </div>
    </article>
  );
}

// ───────────────────────────────────────────────────────────── recent list ──
function RecentLinks({ links, newIds, onDelete }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');

  const filtered = useMemo(() => {
    const lc = q.toLowerCase();
    let r = links.filter(l =>
      !q || l.slug.includes(lc) || l.dest.toLowerCase().includes(lc) || (l.title || '').toLowerCase().includes(lc)
    );
    if (sort === 'clicks') r = [...r].sort((a,b) => b.clicks - a.clicks);
    else r = [...r].sort((a,b) => b.createdAt - a.createdAt);
    return r;
  }, [links, q, sort]);

  return (
    <section className="recent">
      <div className="recent-head">
        <div>
          <h2 className="section-title">Recent hops</h2>
          <p className="section-sub">{links.length} link{links.length === 1 ? '' : 's'} in this workspace</p>
        </div>
        <div className="recent-controls">
          <div className="search">
            <Icon.Search width="14" height="14"/>
            <input type="text" placeholder="Search slugs, domains, titles"
                   value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="seg seg-sm">
            <button className={`seg-btn ${sort === 'recent' ? 'on' : ''}`} onClick={() => setSort('recent')}>Recent</button>
            <button className={`seg-btn ${sort === 'clicks' ? 'on' : ''}`} onClick={() => setSort('clicks')}>Most clicked</button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-mark"><Icon.Bunny width="28" height="28"/></div>
          <div className="empty-title">{q ? `No links match "${q}"` : 'No links yet'}</div>
          <div className="empty-sub">{q ? 'Try a different search.' : 'Paste a URL above to make your first hop.'}</div>
        </div>
      ) : (
        <div className="rows">
          {filtered.map(l => (
            <LinkRow key={l.id} link={l} isNew={newIds.has(l.id)}
                     onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────── toast ──
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="toast" role="status">
      <Icon.Check width="14" height="14"/>
      <span>{msg}</span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── app ──
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "accent": "#0B4DA2",
  "density": "airy",
  "headline": "playful",
  "eyebrow": "url shortener · v0.4",
  "showMetrics": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [links, setLinks] = useState(SEED_LINKS);
  const [newIds, setNewIds] = useState(new Set());
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  // Apply tweaks → root attrs / CSS vars
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = t.dark ? 'dark' : 'light';
    root.dataset.density = t.density;
    root.dataset.metrics = t.showMetrics ? '1' : '0';
    root.style.setProperty('--brand', t.accent);
  }, [t.dark, t.density, t.accent, t.showMetrics]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }

  function handleCreate({ url, slug, expiresAt }) {
    const id = 'l' + Date.now();
    const link = {
      id, slug,
      dest: url,
      title: prettyHost(url),
      clicks: 0,
      createdAt: Date.now(),
      expiresAt,
      owner: 'mara.l',
    };
    setLinks((prev) => [link, ...prev]);
    setNewIds((prev) => new Set([...prev, id]));
    showToast(`Link created · ${SHORT_DOMAIN}/${slug}`);
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev); next.delete(id); return next;
      });
    }, 1800);
    // simulate copy-to-clipboard
    try { navigator.clipboard?.writeText(`https://${SHORT_DOMAIN}/${slug}`); } catch {}
  }

  function handleDelete(id) {
    setLinks((prev) => prev.filter(l => l.id !== id));
    showToast('Link deleted');
  }

  return (
    <div className="app">
      <Header tweaks={t} setTweak={setTweak} />
      <main className="main">
        <Shortener links={links} tweaks={t} onCreate={handleCreate} />
        <RecentLinks links={links} newIds={newIds} onDelete={handleDelete} />
      </main>
      <footer className="footer">
        <span>hop · internal tool</span>
        <span className="dot-sep">·</span>
        <span>Somerset Capital</span>
        <span className="dot-sep">·</span>
        <a href="#" className="foot-link">Docs</a>
        <a href="#" className="foot-link">Slack #hop</a>
      </footer>

      <Toast msg={toast} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakToggle label="Dark mode" value={t.dark}
                       onChange={(v) => setTweak('dark', v)} />
          <TweakColor  label="Accent" value={t.accent}
                       options={['#0B4DA2', '#1E3A8A', '#0F766E', '#7C3AED']}
                       onChange={(v) => setTweak('accent', v)} />
        </TweakSection>

        <TweakSection label="Layout">
          <TweakRadio  label="Density" value={t.density}
                       options={['airy', 'cozy']}
                       onChange={(v) => setTweak('density', v)} />
          <TweakToggle label="Show metrics" value={t.showMetrics}
                       onChange={(v) => setTweak('showMetrics', v)} />
        </TweakSection>

        <TweakSection label="Copy">
          <TweakSelect label="Headline" value={t.headline}
                       options={[
                         { value: 'playful', label: 'Let\'s hop somewhere new.' },
                         { value: 'tagline', label: 'A short URL, in one hop.' },
                         { value: 'direct',  label: 'Shorten a link.' },
                       ]}
                       onChange={(v) => setTweak('headline', v)} />
          <TweakText   label="Eyebrow" value={t.eyebrow}
                       onChange={(v) => setTweak('eyebrow', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
