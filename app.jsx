/* global React, ReactDOM, AIRPORTS, Geo */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Map airport-data country names → world-atlas country names (where they differ)
const COUNTRY_ALIASES = {
  'USA': 'United States of America',
  'UK': 'United Kingdom',
  'South Korea': 'South Korea', // already matches
  'Czechia': 'Czechia',
  'UAE': 'United Arab Emirates',
  'Russia': 'Russia',
  'Vietnam': 'Vietnam'
};
function atlasNameFor(airportCountry) {
  return COUNTRY_ALIASES[airportCountry] || airportCountry;
}

function CountryTooltipBody({ country, countryStats }) {
  const s = countryStats[country.name];
  return (
    <>
      <div className="country-tooltip__name">{country.name}</div>
      {s ?
      <div className="country-tooltip__stats">
          <span><b>{s.departures}</b> dep</span>
          <span><b>{s.arrivals}</b> arr</span>
          <span><b>{s.airports.size}</b> {s.airports.size === 1 ? 'airport' : 'airports'}</span>
        </div> :

      <div className="country-tooltip__empty">No routes</div>
      }
    </>);
}

// Muted route colors that work on the cream background
const ROUTE_COLORS = [
'#a85b3c', '#7a8c54', '#3c6b8a', '#8a6a3c',
'#5e4a7a', '#a83c5e', '#3c8a7a', '#6b5e3c',
'#8a3c3c', '#3c4a8a', '#7a3c8a'];


const Icon = {
  Globe: () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 18, height: 18 }}><circle cx="8" cy="8" r="6.5" /><ellipse cx="8" cy="8" rx="3" ry="6.5" /><path d="M1.5 8h13M3 4h10M3 12h10" /></svg>,
  Plus: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M7.25 3.5a.75.75 0 011.5 0v3.75h3.75a.75.75 0 010 1.5H8.75v3.75a.75.75 0 01-1.5 0V8.75H3.5a.75.75 0 010-1.5h3.75V3.5z" /></svg>,
  Cancel: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.65 4.65a.5.5 0 01.7 0L8 7.3l2.65-2.65a.5.5 0 11.7.7L8.7 8l2.65 2.65a.5.5 0 11-.7.7L8 8.7l-2.65 2.65a.5.5 0 11-.7-.7L7.3 8 4.65 5.35a.5.5 0 010-.7z" /></svg>,
  Arrow: () => <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 12, height: 12 }}><path d="M8.4 3.4a.75.75 0 011.06 0l3.6 3.6a.75.75 0 010 1.06l-3.6 3.6a.75.75 0 11-1.06-1.06L10.94 8.5H3.5a.75.75 0 010-1.5h7.44L8.4 4.46a.75.75 0 010-1.06z" /></svg>,
  ZoomIn: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M7 2.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM1 7a6 6 0 1110.74 3.69l3.03 3.03a.75.75 0 11-1.06 1.06l-3.03-3.03A6 6 0 011 7zm6.75-2.25a.75.75 0 00-1.5 0v1.5h-1.5a.75.75 0 000 1.5h1.5v1.5a.75.75 0 001.5 0v-1.5h1.5a.75.75 0 000-1.5h-1.5v-1.5z" /></svg>,
  ZoomOut: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M7 2.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM1 7a6 6 0 1110.74 3.69l3.03 3.03a.75.75 0 11-1.06 1.06l-3.03-3.03A6 6 0 011 7zm3.75 0a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75z" /></svg>,
  Reset: () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="4.3" /><path d="M8 1.3v2.2M8 12.5v2.2M1.3 8h2.2M12.5 8h2.2" strokeLinecap="round" /><circle cx="8" cy="8" r="1.05" fill="currentColor" stroke="none" /></svg>,
  Sliders: () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 5h7M12 5h2M2 11h2M7 11h7" /><circle cx="10.5" cy="5" r="1.6" fill="currentColor" stroke="none" /><circle cx="5.5" cy="11" r="1.6" fill="currentColor" stroke="none" /></svg>,
  Alert: () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"><path d="M8 1.9 1.4 13.4h13.2L8 1.9z" /><path d="M8 6.2v3.1" strokeLinecap="round" /><circle cx="8" cy="11.3" r="0.55" fill="currentColor" stroke="none" /></svg>,
  Chevron: () => <svg viewBox="0 0 16 16" fill="currentColor" className="btn__chevron"><path d="M3.2 5.8a.75.75 0 011.06 0L8 9.54l3.74-3.74a.75.75 0 111.06 1.06l-4.27 4.27a.75.75 0 01-1.06 0L3.2 6.86a.75.75 0 010-1.06z" /></svg>,
  Caret: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3.2 5.8a.75.75 0 011.06 0L8 9.54l3.74-3.74a.75.75 0 111.06 1.06l-4.27 4.27a.75.75 0 01-1.06 0L3.2 6.86a.75.75 0 010-1.06z" /></svg>
};

// ====== TOPOJSON LOADER ======
// Fetch world atlas at runtime; decode topojson arcs.
async function loadCountries() {
  const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  const topo = await res.json();
  return decodeTopo(topo);
}

function decodeTopo(topo) {
  const { transform, arcs: rawArcs } = topo;
  const arcs = rawArcs.map((arc) => {
    const out = [];
    let x = 0,y = 0;
    for (const [dx, dy] of arc) {
      x += dx;y += dy;
      out.push([
      x * transform.scale[0] + transform.translate[0],
      y * transform.scale[1] + transform.translate[1]]
      );
    }
    return out;
  });
  function arcRing(arcIds) {
    const ring = [];
    arcIds.forEach((id, idx) => {
      const reverse = id < 0;
      const a = reverse ? arcs[~id] : arcs[id];
      const seg = reverse ? a.slice().reverse() : a;
      // skip first point on subsequent arcs
      seg.forEach((pt, i) => {if (idx === 0 || i > 0) ring.push(pt);});
    });
    return ring;
  }
  const countriesObj = topo.objects.countries;
  const countries = countriesObj.geometries.map((geom) => {
    const name = geom.properties.name;
    let polys;
    if (geom.type === 'Polygon') polys = [geom.arcs.map(arcRing)];else
    if (geom.type === 'MultiPolygon') polys = geom.arcs.map((p) => p.map(arcRing));else
    polys = [];
    return { name, id: geom.id, polygons: polys };
  });
  return countries;
}

/* ====== HEADER ====== */
const STYLE_GROUPS = [
  { key: 'mood', title: 'Mood', options: [
    { value: 'daylight', label: 'Daylight' },
    { value: 'blueprint', label: 'Blueprint' },
    { value: 'vintage', label: 'Vintage' },
    { value: 'neon', label: 'Neon' }
  ] },
  { key: 'routeStyle', title: 'Routes', options: [
    { value: 'hairline', label: 'Thin' },
    { value: 'medium', label: 'Medium' },
    { value: 'bold', label: 'Bold' },
    { value: 'dashed', label: 'Dashed' }
  ] },
  { key: 'cityMark', title: 'Cities', options: [
    { value: 'dot', label: 'Dot' },
    { value: 'pin', label: 'Pin' },
    { value: 'halo', label: 'Halo' },
    { value: 'cross', label: 'Cross' }
  ] }
];

function StyleMenu({ tweaks, onStyle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div className="style-menu" ref={ref}>
      <button className={`btn ${open ? 'btn--active' : ''}`} onClick={() => setOpen((o) => !o)}>
        <Icon.Sliders /> Style <Icon.Chevron />
      </button>
      {open &&
      <div className="style-pop">
        {STYLE_GROUPS.map((g) =>
        <div key={g.key} className="style-pop__group">
          <div className="style-pop__title">{g.title}</div>
          <div className="style-pop__opts">
            {g.options.map((o) =>
            <button key={o.value}
            className={`style-pop__opt ${tweaks[g.key] === o.value ? 'style-pop__opt--active' : ''}`}
            onClick={() => onStyle(g.key, o.value)}>{o.label}</button>
            )}
          </div>
        </div>
        )}
      </div>
      }
    </div>);

}

function Header({ tweaks, onStyle }) {
  return (
    <div className="product-header">
      <div className="product-header__title">
        <Icon.Globe />
        <span>Global Explorer</span>
        <span className="product-header__sub">Flight paths</span>
      </div>
      <div className="product-header__right">
        <StyleMenu tweaks={tweaks} onStyle={onStyle} />
      </div>
    </div>);

}

/* ====== SIDEBAR ====== */
function Sidebar({ flights, onAdd, onAddBatch, onRemove, onHover, hoverIdx, onSample, onClear, collapsed, onToggleCollapse }) {
  const tweakCtx = useTheme();
  const currentTheme = tweakCtx ? tweakCtx.theme : THEMES.daylight;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [activeField, setActiveField] = useState(null); // 'from' | 'to' | null
  const [acIndex, setAcIndex] = useState(0); // highlighted autocomplete row
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchMsg, setBatchMsg] = useState('');
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Airport autocomplete: rank by IATA-code prefix first, then city / name match.
  const suggest = (q) => {
    const u = q.trim().toUpperCase();
    if (!u) return [];
    const ql = q.trim().toLowerCase();
    const codeHits = [];
    const textHits = [];
    for (const code in AIRPORTS) {
      if (code.startsWith(u)) { codeHits.push(code); continue; }
      const a = AIRPORTS[code];
      if (a.city.toLowerCase().includes(ql) || a.name.toLowerCase().includes(ql)) textHits.push(code);
    }
    return codeHits.concat(textHits).slice(0, 7);
  };
  const pick = (field, code) => {
    if (field === 'from') { setFrom(code); setActiveField(null); toRef.current && toRef.current.focus(); }
    else { setTo(code); setActiveField(null); }
  };

  // Live suggestion list for whichever field is focused.
  const acQuery = activeField === 'from' ? from : activeField === 'to' ? to : '';
  const suggestions = activeField && acQuery.trim() ? suggest(acQuery) : [];
  useEffect(() => { setAcIndex(0); }, [activeField, from, to]);

  const submit = () => {
    setError('');
    const f = from.toUpperCase().trim();
    const t = to.toUpperCase().trim();
    if (f.length !== 3 || t.length !== 3) {setError('Use 3-letter IATA codes');return;}
    if (!AIRPORTS[f]) {setError(`${f} not found`);return;}
    if (!AIRPORTS[t]) {setError(`${t} not found`);return;}
    if (f === t) {setError('Origin and destination must differ');return;}
    onAdd(f, t);
    setFrom('');setTo('');
    fromRef.current && fromRef.current.focus();
  };
  // Shared keydown handler: arrow keys walk the suggestion list, Enter picks the
  // highlighted suggestion (or advances FROM→TO / submits), Esc closes the dropdown.
  const handleKey = (e, field) => {
    if (e.key === 'ArrowDown') {
      if (suggestions.length) { e.preventDefault(); setAcIndex((i) => Math.min(suggestions.length - 1, i + 1)); }
      return;
    }
    if (e.key === 'ArrowUp') {
      if (suggestions.length) { e.preventDefault(); setAcIndex((i) => Math.max(0, i - 1)); }
      return;
    }
    if (e.key === 'Escape') { setActiveField(null); return; }
    if (e.key !== 'Enter') return;
    if (suggestions.length && acIndex >= 0 && acIndex < suggestions.length) {
      e.preventDefault();
      pick(field, suggestions[acIndex]);
      return;
    }
    if (field === 'from' && from.trim().length === 3 && to.trim().length < 3) {
      toRef.current && toRef.current.focus();
    } else {
      submit();
    }
  };

  const submitBatch = () => {
    setBatchMsg('');
    // Accept any non-letter as separator: commas, newlines, semicolons, spaces, tabs
    // Tokens of 3 letters; pair them up. Also support AAA-BBB pattern.
    const text = batchText.toUpperCase();
    // Split on anything that's not a letter, but treat dash as a "pair" connector — extract pairs
    const pairs = [];
    // Find every AAA<sep>BBB (where sep is anything non-letter)
    const re = /([A-Z]{3})\s*[-–—>→/\\]\s*([A-Z]{3})/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      pairs.push([m[1], m[2]]);
    }
    if (pairs.length === 0) {
      // Fallback: extract all 3-letter codes and pair adjacent ones
      const codes = text.match(/[A-Z]{3}/g) || [];
      for (let i = 0; i + 1 < codes.length; i += 2) pairs.push([codes[i], codes[i + 1]]);
    }
    if (pairs.length === 0) { setBatchMsg('No valid routes found'); return; }
    const valid = [];
    const skipped = [];
    for (const [f, t] of pairs) {
      if (f === t) { skipped.push(`${f}-${t}`); continue; }
      if (!AIRPORTS[f] || !AIRPORTS[t]) { skipped.push(`${f}-${t}`); continue; }
      valid.push({ from: f, to: t });
    }
    if (valid.length === 0) { setBatchMsg(`No valid routes (${skipped.length} unknown)`); return; }
    onAddBatch(valid);
    setBatchText('');
    setBatchMsg(`Added ${valid.length}${skipped.length ? ` · skipped ${skipped.length}` : ''}`);
  };
  const totalKm = flights.reduce((s, f) => s + Geo.gcDistance(AIRPORTS[f.from], AIRPORTS[f.to]), 0);

  return (
    <div className="sidebar">
      <div
        className="sidebar__header"
        {...(isMobile ? {
          onClick: onToggleCollapse,
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(); } },
          role: 'button',
          tabIndex: 0,
          'aria-expanded': !collapsed,
          'aria-label': collapsed ? 'Expand flights panel' : 'Collapse flights panel'
        } : {})}>
        <div className="sidebar__title">
          <span className="sidebar__title-left">Flights <span className="count-pill">{flights.length}</span></span>
          <span className="sidebar__collapse" aria-hidden="true">
            <Icon.Caret />
          </span>
        </div>
        <div className="sidebar__hint">Add routes by IATA code, e.g. JFK → CDG</div>
      </div>
      <div className="sidebar__body">
      <div className="flight-input">
        <div className="flight-input__field">
          <input ref={fromRef} className="flight-input__code" placeholder="FROM" value={from} maxLength={3}
          onFocus={() => setActiveField('from')}
          onBlur={() => setTimeout(() => setActiveField((f) => f === 'from' ? null : f), 150)}
          onChange={(e) => setFrom(e.target.value.toUpperCase())} onKeyDown={(e) => handleKey(e, 'from')} />
          <span className="flight-input__sep">→</span>
          <input ref={toRef} className="flight-input__code" placeholder="TO" value={to} maxLength={3}
          onFocus={() => setActiveField('to')}
          onBlur={() => setTimeout(() => setActiveField((f) => f === 'to' ? null : f), 150)}
          onChange={(e) => setTo(e.target.value.toUpperCase())} onKeyDown={(e) => handleKey(e, 'to')} />
        </div>
        <button className="btn-add" onClick={submit} disabled={from.length < 3 || to.length < 3} title="Add flight">
          <Icon.Plus />
        </button>
        {(() => {
          if (!activeField) return null;
          const q = activeField === 'from' ? from : to;
          // Empty FROM → offer the sample-routes shortcut
          if (activeField === 'from' && q.length === 0) {
            return (
              <div className="input-dropdown">
                <button className="input-dropdown__item" onMouseDown={(e) => { e.preventDefault(); onSample(); setActiveField(null); }}>
                  Load sample routes
                </button>
              </div>);
          }
          const hits = suggestions;
          if (hits.length === 0) return null;
          return (
            <div className="input-dropdown">
              {hits.map((code, idx) => {
                const a = AIRPORTS[code];
                return (
                  <button key={code}
                  className={`input-dropdown__item input-dropdown__item--ac ${idx === acIndex ? 'input-dropdown__item--active' : ''}`}
                  onMouseEnter={() => setAcIndex(idx)}
                  onMouseDown={(e) => { e.preventDefault(); pick(activeField, code); }}>
                    <span className="ac-code">{code}</span>
                    <span className="ac-meta">{a.city} · {a.name}</span>
                  </button>);
              })}
            </div>);
        })()}
      </div>
      {error && <div className="flight-error"><Icon.Alert /> {error}</div>}
      <div className="batch-toggle">
        <button className="batch-toggle__btn" onClick={() => setBatchOpen(o => !o)}>
          {batchOpen ? '− Hide' : '+ Multiple routes'}
        </button>
        {flights.length > 0 &&
        <button className="batch-toggle__btn batch-toggle__btn--danger" onClick={onClear}>Clear all</button>
        }
      </div>
      {batchOpen && (
        <div className="batch-input">
          <textarea
            className="batch-input__area"
            placeholder="JFK-CDG, CDG-DXB, DXB-SIN&#10;LHR-NRT&#10;SFO→HND"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            rows={4}
          />
          <div className="batch-input__actions">
            <span className="batch-input__hint">Format: AAA-BBB · separated by commas, spaces, or newlines</span>
            <button className="btn btn--primary" onClick={submitBatch} disabled={!batchText.trim()}>Add all</button>
          </div>
          {batchMsg && <div className="batch-input__msg">{batchMsg}</div>}
        </div>
      )}
      <div className="flight-list">
        {flights.length === 0 ?
        <div className="flight-list__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36 }}>
              <path d="M21 16v-2l-9-5.5V3.5a1.5 1.5 0 00-3 0V8.5L0 14v2l9-2.5v3.5L7 18v1.5l4-1 4 1V18l-2-1V13.5z" />
            </svg>
            <div>No flights yet.<br />Type two airport codes above to begin.</div>
          </div> :
        flights.map((f, i) => {
          const a = AIRPORTS[f.from],b = AIRPORTS[f.to];
          return (
            <div key={i} className={`flight-row ${hoverIdx === i ? 'flight-row--active' : ''}`}
            onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(-1)}>
              <div className="flight-row__color" style={{ background: (currentTheme || THEMES.daylight).routes[i % (currentTheme || THEMES.daylight).routes.length] }}></div>
              <div className="flight-row__main">
                <div className="flight-row__codes">{f.from} <span className="flight-row__arrow"><Icon.Arrow /></span> {f.to}</div>
                <div className="flight-row__cities">{a.city} → {b.city}</div>
              </div>
              <div className="flight-row__dist">{Geo.gcDistance(a, b).toLocaleString()} km</div>
              <div className="flight-row__remove" onClick={(e) => {e.stopPropagation();onRemove(i);}}>
                <Icon.Cancel />
              </div>
            </div>);

        })}
      </div>
      {flights.length > 0 &&
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--ui-border)', display: 'flex', justifyContent: 'space-between', fontSize: 11, background: 'var(--ui-background-secondary)' }}>
          <span style={{ color: 'var(--ui-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Total distance</span>
          <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600, color: 'var(--ui-text)' }}>{totalKm.toLocaleString()} km</span>
        </div>
      }
      </div>
    </div>);

}

/* ====== PROJECTION SLIDER ====== */
function ProjSlider({ value, onChange }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const sliderMetrics = () => {
    const wrap = trackRef.current?.closest('.proj-slider-wrap');
    if (!wrap) return { inset: 8, thumb: 24 };
    const cs = getComputedStyle(wrap);
    return {
      inset: parseFloat(cs.getPropertyValue('--proj-inset')) || 8,
      thumb: parseFloat(cs.getPropertyValue('--proj-thumb')) || 24
    };
  };
  const setFromEvent = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const { inset, thumb } = sliderMetrics();
    const usable = r.width - inset * 2 - thumb;
    const pct = Math.max(0, Math.min(1, (x - inset - thumb / 2) / usable));
    onChange(pct);
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {e.preventDefault();setFromEvent(e);};
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging]);
  const labels = [
    { v: 0, name: 'Globe', tick: 'start' },
    { v: 0.5, name: 'Robinson', tick: 'center', align: 'center' },
    { v: 1, name: 'Mercator', tick: 'end' }
  ];
  const closestLabel = labels.reduce((a, b) => Math.abs(b.v - value) < Math.abs(a.v - value) ? b : a);
  const thumbLeft = `calc(var(--proj-inset) + (100% - 2 * var(--proj-inset) - var(--proj-thumb)) * ${value})`;
  const fillWidth = `calc((100% - 2 * var(--proj-inset) - var(--proj-thumb)) * ${value} + var(--proj-thumb) / 2)`;
  return (
    <div className="proj-slider-wrap">
      <div className="proj-slider__labels">
        {labels.map((l) =>
        <div key={l.v} className={`proj-slider__label${l.align ? ` proj-slider__label--${l.align}` : ''} ${closestLabel.v === l.v ? 'proj-slider__label--active' : ''}`}
        onClick={() => onChange(l.v)}>{l.name}</div>
        )}
      </div>
      <div className="proj-slider" ref={trackRef}
      onMouseDown={(e) => {setDragging(true);setFromEvent(e);}}
      onTouchStart={(e) => {setDragging(true);setFromEvent(e);}}>
        <div className="proj-slider__track"></div>
        <div className="proj-slider__fill" style={{ width: fillWidth }}></div>
        {labels.map((l) => <div key={l.v} className={`proj-slider__tick proj-slider__tick--${l.tick}`}></div>)}
        <div className={`proj-slider__thumb ${dragging ? 'proj-slider__thumb--dragging' : ''}`} style={{ left: thumbLeft }}>
          <div className="proj-slider__readout">{closestLabel.name} · t={value.toFixed(2)}</div>
        </div>
      </div>
    </div>);

}

/* ====== GLOBE STAGE ====== */
function GlobeStage({ flights, hoverIdx, projT, countries }) {
  const tweakCtx = useTheme() || { theme: THEMES.daylight, routeStyle: ROUTE_STYLES.bold, cityMark: 'dot', mapOffsetY: 0 };
  const { theme, routeStyle, cityMark, mapOffsetY = 0 } = tweakCtx;
  const stageRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [rotation, setRotation] = useState({ lambda: -10, phi: -22 });
  const [lambdaShift, setLambdaShift] = useState(0); // for flat projections
  const [zoom, setZoom] = useState(1);
  const [verticalPan, setVerticalPan] = useState(0); // y-only pan in flat
  const [dragging, setDragging] = useState(false);
  const [hoverCountry, setHoverCountry] = useState(null);
  const [pinnedCountry, setPinnedCountry] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);
  const draggedRef = useRef(false);
  const endInteractionRef = useRef(null);
  const DRAG_THRESHOLD = 6;
  // Touch support: snapshot of the active gesture + live values for the move handler.
  const touchRef = useRef(null);
  const [touchActive, setTouchActive] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  const liveRef = useRef({});
  liveRef.current = { rotation, lambdaShift, verticalPan, zoom, projT, size };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setSize({ w: width, h: height });
      }
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  // When sliding to flat, smoothly drain phi to 0 (no tilt makes sense on flat paper).
  // Any residual tilt bows the meridians on a flat map, so we snap fully to 0 once it's
  // small rather than leaving a fraction of a degree behind.
  useEffect(() => {
    if (projT >= 0.5 && rotation.phi !== 0 && !dragging) {
      const id = setTimeout(() => {
        setRotation((r) => {
          const next = r.phi * 0.8;
          return { lambda: r.lambda, phi: Math.abs(next) < 0.05 ? 0 : next };
        });
      }, 24);
      return () => clearTimeout(id);
    }
  }, [projT, rotation.phi, dragging]);

  const startInteraction = (clientX, clientY) => {
    if (endInteractionRef.current) endInteractionRef.current();
    draggedRef.current = false;
    dragStart.current = {
      x: clientX, y: clientY,
      rot: { ...liveRef.current.rotation }
    };

    const applyDrag = (x, y) => {
      const dx = x - dragStart.current.x;
      const dy = y - dragStart.current.y;
      const { zoom: z, projT: t, size: sz } = liveRef.current;
      if (t < 0.5) {
        const sensitivity = 0.4 / z;
        setRotation({
          lambda: dragStart.current.rot.lambda + dx * sensitivity,
          phi: dragStart.current.rot.phi - dy * sensitivity
        });
      } else {
        const projScale = Math.min(sz.w, sz.h) * 0.42 * z;
        setRotation({
          lambda: dragStart.current.rot.lambda + dx / projScale * 180,
          phi: dragStart.current.rot.phi
        });
      }
    };

    const onMove = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      if (!pt) return;
      if (e.touches) e.preventDefault();
      const dx = pt.clientX - dragStart.current.x;
      const dy = pt.clientY - dragStart.current.y;
      if (!draggedRef.current) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        draggedRef.current = true;
        setDragging(true);
      }
      applyDrag(pt.clientX, pt.clientY);
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
      endInteractionRef.current = null;
      setTouchActive(false);
    };

    endInteractionRef.current = onUp;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    startInteraction(e.clientX, e.clientY);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const dz = -e.deltaY * 0.0015;
    setZoom((z) => Math.max(0.5, Math.min(8, z + dz * z)));
  };

  // ── Touch: 1 finger = drag-rotate / belt-pan, 2 fingers = pinch-zoom ──
  const touchDist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setHoverCountry(null);
      setTouchActive(true);
      startInteraction(t.clientX, t.clientY);
    } else if (e.touches.length === 2) {
      if (endInteractionRef.current) endInteractionRef.current();
      touchRef.current = { mode: 'pinch', dist: touchDist(e.touches[0], e.touches[1]), zoom: liveRef.current.zoom };
      setDragging(false);
      setTouchActive(true);
    }
  };
  useEffect(() => {
    if (!touchActive) return;
    const onMove = (e) => {
      const st = touchRef.current;
      if (!st) return;
      e.preventDefault();
      if (st.mode === 'pinch' && e.touches.length >= 2) {
        const ratio = touchDist(e.touches[0], e.touches[1]) / st.dist;
        setZoom(Math.max(0.5, Math.min(8, st.zoom * ratio)));
        return;
      }
    };
    const onEnd = (e) => {
      if (e.touches.length === 0) {
        setTouchActive(false);
        touchRef.current = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        touchRef.current = null;
        setTouchActive(true);
        startInteraction(t.clientX, t.clientY);
      }
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [touchActive, projT, size]);

  const onMouseMove = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  // Compute scale & center.
  // Globe shows one hemisphere across width 2*scale. Flat maps show the whole earth in 2*scale.
  // To keep visible-front-half similar size during unwrap, modestly boost flat scale (~1.5×).
  // True "paper unwrap" would be π× but that overflows the stage.
  const baseRadius = Math.min(size.w, size.h) * 0.42;
  const flatBoost = 1 + 0.5 * Math.min(1, projT * 2); // 1.0 at globe → 1.5 at flat
  const projScale = baseRadius * flatBoost;
  const scale = projScale * zoom;
  const cx = size.w / 2;
  const cy = size.h / 2 + verticalPan + mapOffsetY;

  // Rotation now drives both globe orientation and flat-map panning, so lambdaShift is unused.
  const effLambdaShift = 0;

  // Country paths — closed (Z) so each country is a filled silhouette that occludes whatever is behind it.
  // This is what gives the "paper cover" feel during the unfold morph.
  const countryPaths = useMemo(() => {
    if (!countries) return [];
    return countries.map((country) => {
      const polys = country.polygons.map((rings) =>
      rings.map((ring) => Geo.ringPath(ring, projT, rotation, scale, cx, cy, effLambdaShift, true)).join(' ')
      ).join(' ');
      return { ...country, path: polys };
    });
  }, [countries, projT, rotation, scale, cx, cy, effLambdaShift]);

  // Graticule
  const graticulePaths = useMemo(() => {
    return Geo.graticule().map((line) => Geo.ringPath(line, projT, rotation, scale, cx, cy, effLambdaShift));
  }, [projT, rotation, scale, cx, cy, effLambdaShift]);

  // Flight arcs
  const flightArcs = useMemo(() => {
    return flights.map((f, i) => {
      const a = AIRPORTS[f.from],b = AIRPORTS[f.to];
      const path = Geo.arcPath({ lon: a.lon, lat: a.lat }, { lon: b.lon, lat: b.lat }, projT, rotation, scale, cx, cy, effLambdaShift);
      return { path, color: theme.routes[i % theme.routes.length], idx: i };
    });
  }, [flights, projT, rotation, scale, cx, cy, effLambdaShift]);

  // Per-country route stats — keyed by world-atlas country name
  const countryStats = useMemo(() => {
    const stats = {}; // name → { departures, arrivals, airports: Set }
    const bump = (atlasName, code, kind) => {
      if (!stats[atlasName]) stats[atlasName] = { departures: 0, arrivals: 0, airports: new Set() };
      stats[atlasName][kind]++;
      stats[atlasName].airports.add(code);
    };
    flights.forEach((f) => {
      const a = AIRPORTS[f.from],b = AIRPORTS[f.to];
      if (a) bump(atlasNameFor(a.country), f.from, 'departures');
      if (b) bump(atlasNameFor(b.country), f.to, 'arrivals');
    });
    return stats;
  }, [flights]);

  // Connected airports only
  const airports = useMemo(() => {
    const seen = new Set();
    const list = [];
    flights.forEach((f) => {
      [f.from, f.to].forEach((code) => {
        if (!seen.has(code)) {
          seen.add(code);
          list.push({ code, ...AIRPORTS[code] });
        }
      });
    });
    return list;
  }, [flights]);

  return (
    <div ref={stageRef} className={`globe-stage ${dragging ? 'globe-stage--dragging' : ''}`}
    style={{ background: theme.paper }}
    onMouseDown={onMouseDown} onWheel={onWheel} onMouseMove={onMouseMove}
    onTouchStart={onTouchStart}
    onClick={() => { if (isMobile && !draggedRef.current) setPinnedCountry(null); }}
    onMouseLeave={() => setHoverCountry(null)}>
      <svg className="globe-svg">
        <defs>
          <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Unified boundary outline: morphs continuously from circle (globe) → Robinson → Mercator. */}
        {(() => {
          const lats = [];
          for (let lat = -85; lat <= 85; lat += 2) lats.push(lat);
          const downCount = lats.length;
          const allLats = lats.concat(lats.slice().reverse());
          const sides = [];
          for (let i = 0; i < allLats.length; i++) sides.push(i < downCount ? 1 : -1);

          const circle = allLats.map((lat, i) => {
            const u = (lat + 85) / 170;
            const side = sides[i];
            let ang;
            if (side === 1) ang = -Math.PI / 2 + u * Math.PI;
            else ang = Math.PI / 2 + (1 - u) * Math.PI;
            return { x: Math.cos(ang), y: -Math.sin(ang) };
          });

          const rob = allLats.map((lat, i) => Geo.robinson(180 * sides[i], lat));
          const merc = allLats.map((lat, i) => Geo.mercator(180 * sides[i], lat));

          let from, to, localT;
          if (projT < 0.5) { from = circle; to = rob; localT = projT * 2; }
          else { from = rob; to = merc; localT = (projT - 0.5) * 2; }
          const e = localT * localT * (3 - 2 * localT);

          let d = '';
          for (let i = 0; i < from.length; i++) {
            const x = from[i].x * (1 - e) + to[i].x * e;
            const y = from[i].y * (1 - e) + to[i].y * e;
            const sx = cx + x * scale;
            const sy = cy + y * scale;
            d += (i === 0 ? 'M' : 'L') + sx.toFixed(2) + ' ' + sy.toFixed(2);
          }
          d += 'Z';
          return (
            <>
              <defs>
                <clipPath id="flat-clip">
                  <path d={d} />
                </clipPath>
              </defs>
              <path d={d} fill={theme.sphere} stroke={theme.ink} strokeWidth="1" />
            </>);

        })()}

        {/* Graticule — thin gray dotted lines */}
        <g opacity="0.55" pointerEvents="none" clipPath="url(#flat-clip)">
          {graticulePaths.map((p, i) =>
          <path key={i} d={p} fill="none" stroke={theme.grat} strokeWidth="0.5" />
          )}
        </g>

        {/* Country outlines — outline-only, hover highlights */}
        <g clipPath="url(#flat-clip)">
          {countryPaths.map((c, i) => {
            const isHighlight = !dragging && (
              isMobile ?
              pinnedCountry && pinnedCountry.id === c.id :
              hoverCountry && hoverCountry.id === c.id);
            return (
              <path
                key={c.id || i}
                d={c.path}
                fill={isHighlight ? theme.landHover : theme.land}
                fillRule="nonzero"
                stroke={theme.ink}
                strokeWidth="0.7"
                strokeLinejoin="round"
                onMouseEnter={() => !dragging && !isMobile && setHoverCountry(c)}
                onMouseLeave={() => !isMobile && setHoverCountry(null)}
                onClick={(e) => {
                  if (!isMobile) return;
                  if (draggedRef.current) return;
                  e.stopPropagation();
                  setPinnedCountry((prev) => prev?.id === c.id ? null : c);
                }}
                style={{ cursor: isMobile ? 'pointer' : 'default' }} />);


          })}
        </g>

        {/* Flight arcs */}
        <g pointerEvents="none" clipPath="url(#flat-clip)" filter={routeStyle.glow ? 'url(#route-glow)' : undefined}>
          {flightArcs.map((f) => {
            const dim = hoverIdx >= 0 && hoverIdx !== f.idx;
            const w = (hoverIdx === f.idx ? routeStyle.width * 1.6 : routeStyle.width);
            return (
              <path key={f.idx} d={f.path} fill="none" stroke={f.color}
              strokeWidth={w}
              strokeDasharray={routeStyle.dash || undefined}
              strokeOpacity={dim ? 0.18 : routeStyle.opacity}
              strokeLinecap="round" strokeLinejoin="round" />);

          })}
        </g>

        {/* Airport dots — only connected ones */}
        <g pointerEvents="none" clipPath="url(#flat-clip)">
          {airports.map((ap) => {
            const p = Geo.projectPoint(ap.lon, ap.lat, projT, rotation, effLambdaShift);
            if (!p || !p.visible) return null;
            const x = cx + p.x * scale;
            const y = cy + p.y * scale;
            if (x < -50 || x > size.w + 50 || y < -50 || y > size.h + 50) return null;
            return (
              <g key={ap.code}>
                {cityMark === 'dot' && (
                  <circle cx={x} cy={y} r="4.5" fill={theme.cityFill} stroke={theme.cityRing} strokeWidth="1.5" />
                )}
                {cityMark === 'pin' && (
                  <g>
                    <path d={`M${x} ${y - 11} C ${x - 5.5} ${y - 11}, ${x - 5.5} ${y - 3}, ${x} ${y} C ${x + 5.5} ${y - 3}, ${x + 5.5} ${y - 11}, ${x} ${y - 11} Z`}
                      fill={theme.cityFill} stroke={theme.cityRing} strokeWidth="1.2" strokeLinejoin="round" />
                    <circle cx={x} cy={y - 7} r="2" fill={theme.cityRing} />
                  </g>
                )}
                {cityMark === 'halo' && (
                  <g>
                    <circle cx={x} cy={y} r="8" fill="none" stroke={theme.cityFill} strokeWidth="1" opacity="0.35" />
                    <circle cx={x} cy={y} r="4" fill="none" stroke={theme.cityFill} strokeWidth="1.2" opacity="0.7" />
                    <circle cx={x} cy={y} r="2" fill={theme.cityFill} />
                  </g>
                )}
                {cityMark === 'cross' && (
                  <g stroke={theme.cityFill} strokeWidth="1.6" strokeLinecap="round">
                    <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
                    <line x1={x} y1={y - 5} x2={x} y2={y + 5} />
                    <circle cx={x} cy={y} r="1.5" fill={theme.cityFill} stroke="none" />
                  </g>
                )}
                <text className="airport-label" x={x + 8} y={y + 3} fill={theme.labelColor}>{ap.code}</text>
              </g>);

          })}
        </g>
      </svg>

      {/* Country tooltip — desktop hover (click does not dismiss; country mousedown is isolated) */}
      {hoverCountry && !dragging && !isMobile && (
        <div className="country-tooltip" style={{ left: mousePos.x, top: mousePos.y }}>
          <CountryTooltipBody country={hoverCountry} countryStats={countryStats} />
        </div>
      )}

      {/* Mobile: pinned country uses the hover-style tag at top-left (covers stats bar) */}
      {isMobile && pinnedCountry && !dragging && (
        <div className="country-tooltip country-tooltip--mobile-head">
          <CountryTooltipBody country={pinnedCountry} countryStats={countryStats} />
        </div>
      )}

      {/* Stats overlay — hidden on mobile while a country is selected */}
      {flights.length > 0 && !(isMobile && pinnedCountry) &&
      <div className="stats-bar">
          <div><div className="stat__label">Routes</div><div className="stat__val">{flights.length}</div></div>
          <div><div className="stat__label">Airports</div><div className="stat__val">{airports.length}</div></div>
          <div><div className="stat__label">Total km</div>
            <div className="stat__val">{flights.reduce((s, f) => s + Geo.gcDistance(AIRPORTS[f.from], AIRPORTS[f.to]), 0).toLocaleString()}</div>
          </div>
        </div>
      }

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button className="zoom-controls__btn" data-tip="Zoom in" onClick={() => setZoom((z) => Math.min(8, z * 1.3))}><Icon.ZoomIn /></button>
        <button className="zoom-controls__btn" data-tip="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z / 1.3))}><Icon.ZoomOut /></button>
        <button className="zoom-controls__btn" data-tip="Reset view" onClick={() => {setZoom(1);setLambdaShift(0);setVerticalPan(0);setRotation({ lambda: -10, phi: -22 });}}><Icon.Reset /></button>
      </div>

      {!countries &&
      <div className="loading-indicator">
          <div className="loading-indicator__dot"></div>
          Loading world map…
        </div>
      }

      {countries && flights.length === 0 &&
      <div className="globe-empty">
          <div style={{ fontSize: 13, color: '#6a655a', marginBottom: 4 }}>Add flights to plot routes on the globe</div>
          <div style={{ color: '#8a8276' }}>Drag to rotate · Hover countries · Slide below to switch projection</div>
        </div>
      }
    </div>);

}

/* ====== APP ====== */
const SAMPLE_ROUTES = [
{ from: 'JFK', to: 'CDG' }, { from: 'CDG', to: 'DXB' },
{ from: 'DXB', to: 'SIN' }, { from: 'SIN', to: 'SYD' },
{ from: 'SYD', to: 'LAX' }, { from: 'LAX', to: 'NRT' },
{ from: 'NRT', to: 'HKG' }, { from: 'JFK', to: 'GRU' }];


/* ====== THEMES & TWEAK CONTROLS ====== */
// Each theme reshapes the overall mood — paper, ink, country fill, sphere, water, route palette
const THEMES = {
  daylight: {
    label: 'Daylight',
    paper: '#ece6d8',     // page / stage background
    sphere: '#e8e4d8',    // globe sphere fill
    land: '#ebe8df',      // country fill
    landHover: '#dcd5c2',
    ink: '#8a8276',       // country stroke
    grat: '#b8b0a0',      // graticule color
    routes: ['#a85b3c', '#7a8c54', '#3c6b8a', '#8a6a3c', '#5e4a7a', '#a83c5e', '#3c8a7a', '#6b5e3c'],
    cityFill: '#1c1a15',
    cityRing: '#ebe8df',
    labelColor: '#3a3530'
  },
  blueprint: {
    label: 'Blueprint',
    paper: '#0e2746',
    sphere: '#102b4f',
    land: '#0e2746',
    landHover: '#193b6b',
    ink: '#7fb1ea',
    grat: '#3a6aa8',
    routes: ['#ffd166', '#ef476f', '#06d6a0', '#ffffff', '#ffa07a', '#a3d9ff', '#c4f1be', '#ff9aa2'],
    cityFill: '#ffd166',
    cityRing: '#0e2746',
    labelColor: '#cfe1ff'
  },
  vintage: {
    label: 'Vintage',
    paper: '#e9d9b6',
    sphere: '#e3d2a8',
    land: '#d4be8e',
    landHover: '#c2a876',
    ink: '#5b3a1f',
    grat: '#9b7a4a',
    routes: ['#7a2e1f', '#3d4f2a', '#5b3a1f', '#7a4a2e', '#4a3a1f', '#6b2e3a', '#2e4f4a', '#5b4a2e'],
    cityFill: '#3a1f0a',
    cityRing: '#e9d9b6',
    labelColor: '#3a1f0a'
  },
  neon: {
    label: 'Neon',
    paper: '#0a0a14',
    sphere: '#101020',
    land: '#1a1a30',
    landHover: '#2a2a50',
    ink: '#3a3a60',
    grat: '#1f1f3a',
    routes: ['#ff2d75', '#00f0ff', '#b388ff', '#ffd60a', '#39ff14', '#ff6b35', '#00ffaa', '#ff00ee'],
    cityFill: '#ffffff',
    cityRing: '#0a0a14',
    labelColor: '#e0e0ff'
  }
};

// Route stroke style — reshapes how arcs are rendered
const ROUTE_STYLES = {
  hairline: { width: 1.0, dash: '', glow: false, opacity: 0.85 },
  medium:   { width: 1.7, dash: '', glow: false, opacity: 0.95 },
  bold:     { width: 2.6, dash: '', glow: false, opacity: 1.0 },
  glow:     { width: 1.8, dash: '', glow: true,  opacity: 1.0 },
  dashed:   { width: 1.4, dash: '4 3', glow: false, opacity: 0.9 }
};

// City-mark glyphs
const CITY_MARKS = ['dot', 'pin', 'halo', 'cross'];

const TweakCtx = React.createContext(null);
const useTheme = () => React.useContext(TweakCtx);

function App() {
  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "mood": "daylight",
    "routeStyle": "bold",
    "cityMark": "dot",
    "paperColor": "",
    "mapOffsetY": -20
  }/*EDITMODE-END*/);

  // Persist the viewer-facing style choices (mood / routeStyle / cityMark) to
  // localStorage so anyone viewing the project — not just the editor — can change
  // them and have the choice stick across reloads. setTweak alone only persists for
  // the owner (via the host), and the Tweaks panel isn't shown to viewers at all.
  const STYLE_KEYS = ['mood', 'routeStyle', 'cityMark'];
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ge_style') || '{}');
      const edits = {};
      STYLE_KEYS.forEach((k) => { if (saved[k] !== undefined) edits[k] = saved[k]; });
      if (Object.keys(edits).length) setTweak(edits);
    } catch (e) {/* ignore */}
  }, []);
  const setStyle = useCallback((k, v) => {
    setTweak(k, v);
    try {
      const saved = JSON.parse(localStorage.getItem('ge_style') || '{}');
      saved[k] = v;
      localStorage.setItem('ge_style', JSON.stringify(saved));
    } catch (e) {/* ignore */}
  }, [setTweak]);

  const baseTheme = THEMES[tweaks.mood] || THEMES.daylight;
  // Allow paperColor tweak to override mood's paper background
  const theme = tweaks.paperColor
    ? { ...baseTheme, paper: tweaks.paperColor }
    : baseTheme;
  const routeStyle = ROUTE_STYLES[tweaks.routeStyle] || ROUTE_STYLES.bold;

  // Keep CSS variables in sync with the active theme (always set — never remove,
  // or background: var(--theme-paper, inherit) can stick on the old color until repaint).
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--theme-paper', theme.paper);
    r.style.setProperty('--theme-ink', theme.ink);
    r.style.setProperty('--theme-grat', theme.grat);
    r.style.setProperty('--theme-label', theme.labelColor);
    document.body.style.backgroundColor = theme.paper;
    document.body.dataset.mood = tweaks.mood;
  }, [tweaks.mood, tweaks.paperColor, theme.paper, theme.ink, theme.grat, theme.labelColor]);

  // Persist user-created routes to localStorage so they survive a refresh or a
  // return visit. If nothing has been saved yet (first visit), seed with a few
  // example routes. A saved empty array (user cleared all) is respected.
  const FLIGHTS_KEY = 'ge_flights';
  const [flights, setFlights] = useState(() => {
    try {
      const raw = localStorage.getItem(FLIGHTS_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Drop any routes whose airports are no longer in the dataset.
          return parsed.filter((f) => f && AIRPORTS[f.from] && AIRPORTS[f.to]);
        }
      }
    } catch (e) {/* ignore corrupt storage */}
    return [
      { from: 'JFK', to: 'CDG' },
      { from: 'JFK', to: 'NRT' },
      { from: 'LHR', to: 'SYD' }
    ];
  });

  // Save on every change (including clearing to empty).
  useEffect(() => {
    try {
      localStorage.setItem(FLIGHTS_KEY, JSON.stringify(flights));
    } catch (e) {/* ignore */}
  }, [flights]);
  const [projT, setProjT] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [countries, setCountries] = useState(null);

  useEffect(() => {
    loadCountries().then(setCountries).catch((err) => {
      console.error('Failed to load countries:', err);
      setCountries([]);
    });
  }, []);

  const addFlight = (from, to) => setFlights((f) => [...f, { from, to }]);
  const addBatch = (rows) => setFlights((f) => [...f, ...rows]);
  const removeFlight = (i) => setFlights((f) => f.filter((_, idx) => idx !== i));
  const loadSample = () => setFlights(SAMPLE_ROUTES);
  const clearAll = () => setFlights([]);

  return (
    <TweakCtx.Provider value={{ theme, routeStyle, cityMark: tweaks.cityMark, mapOffsetY: tweaks.mapOffsetY }}>
    <div className="app-shell">
      <Header tweaks={tweaks} onStyle={setStyle} />
      <div className={`explorer-layout ${panelCollapsed ? 'explorer-layout--collapsed' : ''}`}>
        <Sidebar flights={flights} onAdd={addFlight} onAddBatch={addBatch} onRemove={removeFlight} onHover={setHoverIdx} hoverIdx={hoverIdx} onSample={loadSample} onClear={clearAll} collapsed={panelCollapsed} onToggleCollapse={() => setPanelCollapsed((c) => !c)} />
        <div className="main" style={{ background: theme.paper }}>
          <GlobeStage flights={flights} hoverIdx={hoverIdx} projT={projT} countries={countries} />
          <ProjSlider value={projT} onChange={setProjT} />
        </div>
      </div>
      <TweaksPanel title="Tweaks">
        <TweakSection label="Mood">
          <TweakRadio
            value={tweaks.mood}
            onChange={(v) => setStyle('mood', v)}
            options={[
              { value: 'daylight', label: 'Daylight' },
              { value: 'blueprint', label: 'Blueprint' },
              { value: 'vintage', label: 'Vintage' },
              { value: 'neon', label: 'Neon' }
            ]}
          />
        </TweakSection>
        <TweakSection label="Background">
          <TweakColor
            value={tweaks.paperColor || baseTheme.paper}
            onChange={(v) => setTweak('paperColor', v)}
          />
          {tweaks.paperColor && (
            <TweakButton label="Reset to mood default" onClick={() => setTweak('paperColor', '')} />
          )}
        </TweakSection>
        <TweakSection label="Routes">
          <TweakRadio
            value={tweaks.routeStyle}
            onChange={(v) => setStyle('routeStyle', v)}
            options={[
              { value: 'hairline', label: 'Thin' },
              { value: 'medium', label: 'Medium' },
              { value: 'bold', label: 'Bold' },
              { value: 'dashed', label: 'Dashed' }
            ]}
          />
        </TweakSection>
        <TweakSection label="Cities">
          <TweakRadio
            value={tweaks.cityMark}
            onChange={(v) => setStyle('cityMark', v)}
            options={[
              { value: 'dot', label: 'Dot' },
              { value: 'pin', label: 'Pin' },
              { value: 'halo', label: 'Halo' },
              { value: 'cross', label: 'Cross' }
            ]}
          />
        </TweakSection>
        <TweakSection label="Map position">
          <TweakSlider
            value={tweaks.mapOffsetY}
            onChange={(v) => setTweak('mapOffsetY', v)}
            min={-200}
            max={200}
            step={1}
            unit="px"
          />
          <TweakButton label="Center" onClick={() => setTweak('mapOffsetY', 0)} />
        </TweakSection>
      </TweaksPanel>
    </div>
    </TweakCtx.Provider>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);