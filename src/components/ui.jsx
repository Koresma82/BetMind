/* Biblioteca de componentes UI — design system BetMind PRO */

export const C = {
  bg:'var(--bg)', bg2:'var(--bg-2)', surface:'var(--surface)', surface2:'var(--surface-2)', surface3:'var(--surface-3)',
  border:'var(--border)', border2:'var(--border-2)',
  text:'var(--text)', text2:'var(--text-2)', text3:'var(--text-3)', text4:'var(--text-4)',
  acc:'var(--acc)', accDim:'var(--acc-dim)', accGlow:'var(--acc-glow)',
  blue:'var(--blue)', gold:'var(--gold)', orange:'var(--orange)', red:'var(--red)', violet:'var(--violet)',
  mono:'var(--mono)', font:'var(--font)'
};

export const tone = n => (n >= 0 ? C.acc : C.red);
export const fmtMoney = (n, dec = 2) => (n >= 0 ? '+' : '') + (n ?? 0).toFixed(dec) + '€';
export const fmtPct = n => (n >= 0 ? '+' : '') + (n ?? 0).toFixed(1) + '%';

/* ── Card ───────────────────────────── */
export function Card({ children, accent, glow, hover, onClick, style = {}, pad = 18 }) {
  return (
    <div
      onClick={onClick}
      className={hover ? 'card-hover' : ''}
      style={{
        background: `linear-gradient(165deg, var(--surface-2), var(--surface))`,
        border: '1px solid var(--border)',
        borderLeft: accent ? `2.5px solid ${accent}` : '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: pad,
        boxShadow: glow ? `0 0 0 1px ${accent}22, 0 8px 32px ${accent}14` : 'none',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        ...style
      }}>
      {children}
    </div>
  );
}

/* ── Eyebrow / section label ────────── */
export function Eyebrow({ children, color = C.text3, style = {} }) {
  return (
    <div style={{
      fontFamily: C.mono, fontSize: 10.5, fontWeight: 600, color,
      letterSpacing: 1.8, textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 8, ...style
    }}>
      <span style={{ width: 14, height: 1.5, background: color, opacity: .5, borderRadius: 2 }} />
      {children}
    </div>
  );
}

/* ── Stat (KPI) ─────────────────────── */
export function Stat({ label, value, sub, color = C.text, accent, big }) {
  return (
    <Card pad={16} accent={accent} hover style={{ minHeight: big ? 96 : 'auto' }}>
      <div style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 500, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: C.mono, fontSize: big ? 28 : 21, fontWeight: 700, color, lineHeight: 1, letterSpacing: -.5 }}>{value}</div>
      {sub && <div style={{ fontFamily: C.mono, fontSize: 11, color: C.text3, marginTop: 6 }}>{sub}</div>}
    </Card>
  );
}

/* ── Tag / chip ─────────────────────── */
export function Tag({ label, color = C.text2, solid }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: solid ? color : `${color}1a`,
      border: `1px solid ${color}${solid ? '' : '3a'}`,
      color: solid ? '#0a0e14' : color,
      borderRadius: 6, padding: '2.5px 9px',
      fontFamily: C.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: .3,
      whiteSpace: 'nowrap'
    }}>{label}</span>
  );
}

/* ── Button ─────────────────────────── */
export function Button({ children, onClick, disabled, variant = 'primary', full, style = {}, size = 'md' }) {
  const variants = {
    primary: { bg: 'linear-gradient(135deg, rgba(0,229,138,0.16), rgba(0,229,138,0.07))', border: 'rgba(0,229,138,0.4)', color: C.acc },
    ghost:   { bg: 'var(--surface-2)', border: 'var(--border-2)', color: C.text2 },
    danger:  { bg: 'rgba(255,77,109,0.08)', border: 'rgba(255,77,109,0.35)', color: C.red },
    dashed:  { bg: 'transparent', border: 'var(--border-2)', color: C.text3, dashed: true }
  };
  const v = variants[variant] || variants.primary;
  const pad = size === 'sm' ? '7px 12px' : size === 'lg' ? '14px 20px' : '11px 16px';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? '100%' : 'auto', padding: pad,
      background: v.bg, border: `1px ${v.dashed ? 'dashed' : 'solid'} ${v.border}`,
      borderRadius: 'var(--r-xs)', color: v.color,
      fontFamily: C.mono, fontSize: size === 'sm' ? 11 : 12, fontWeight: 600, letterSpacing: .5,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .55 : 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'all .16s', ...style
    }}
    onMouseEnter={e => { if (!disabled && !v.dashed) e.currentTarget.style.filter = 'brightness(1.18)'; }}
    onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
    >{children}</button>
  );
}

/* ── Progress bar ───────────────────── */
export function Bar({ pct, color = C.acc, height = 5, bg = 'rgba(255,255,255,0.06)' }) {
  return (
    <div style={{ height, background: bg, borderRadius: height, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.max(0, Math.min(pct, 100))}%`, height: '100%',
        background: `linear-gradient(90deg, ${color}cc, ${color})`,
        borderRadius: height, transition: 'width .8s cubic-bezier(.2,.7,.3,1)',
        boxShadow: `0 0 8px ${color}66`
      }} />
    </div>
  );
}

/* ── Page header ────────────────────── */
export function PageHeader({ title, eyebrow, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
      <div>
        {eyebrow && <Eyebrow style={{ marginBottom: 8 }}>{eyebrow}</Eyebrow>}
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: -.7, lineHeight: 1 }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

/* ── Spinner ────────────────────────── */
export function Spinner({ size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `${Math.max(2, size / 12)}px solid var(--surface-3)`,
      borderTopColor: C.acc, animation: 'spin .8s linear infinite'
    }} />
  );
}
export function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 70 }}><Spinner /></div>;
}

/* ── Segmented tabs ─────────────────── */
export function Segmented({ tabs, value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4, marginBottom: 18,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)'
    }}>
      {tabs.map(([k, l]) => {
        const active = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            flex: 1, padding: '9px 6px', borderRadius: 'var(--r-xs)', border: 'none', cursor: 'pointer',
            background: active ? 'linear-gradient(135deg, rgba(0,229,138,0.18), rgba(0,229,138,0.08))' : 'transparent',
            color: active ? C.acc : C.text3,
            fontFamily: C.mono, fontSize: 12, fontWeight: 600, letterSpacing: .3,
            boxShadow: active ? 'inset 0 0 0 1px rgba(0,229,138,0.3)' : 'none',
            transition: 'all .16s'
          }}>{l}</button>
        );
      })}
    </div>
  );
}

/* ── Empty state ────────────────────── */
export function Empty({ icon = '◦', children }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: C.text3 }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: .5 }}>{icon}</div>
      <div style={{ fontFamily: C.mono, fontSize: 12.5, lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

/* ── Notice (alert/success/error) ───── */
export function Notice({ kind = 'info', children }) {
  const map = {
    info:    { c: C.blue,  bg: 'rgba(77,141,255,0.08)',  b: 'rgba(77,141,255,0.3)' },
    success: { c: C.acc,   bg: 'rgba(0,229,138,0.08)',   b: 'rgba(0,229,138,0.3)' },
    warn:    { c: C.gold,  bg: 'rgba(255,201,77,0.07)',  b: 'rgba(255,201,77,0.28)' },
    error:   { c: C.red,   bg: 'rgba(255,77,109,0.08)',  b: 'rgba(255,77,109,0.3)' }
  };
  const m = map[kind] || map.info;
  return (
    <div style={{
      background: m.bg, border: `1px solid ${m.b}`, borderRadius: 'var(--r-sm)',
      padding: '11px 14px', color: m.c, fontFamily: C.mono, fontSize: 12, lineHeight: 1.6
    }}>{children}</div>
  );
}
