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
  Reset: () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 8a5 5 0 119 3" /><path d="M3 11.5V8h3.5" /></svg>
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
function Header({ onSample, onClear }) {
  return (
    <div className="product-header">
      <div className="product-header__title">
        <Icon.Globe />
        <span>Global Explorer</span>
        <span className="product-header__sub">Flight paths</span>
      </div>
      <div className="product-header__right">
        <button className="btn" onClick={onSample}>Load sample routes</button>
        <button className="btn" onClick={onClear}>Clear all</button>
      </div>
    </div>);

}

/* ====== SIDEBAR ====== */
function Sidebar({ flights, onAdd, onAddBatch, onRemove, onHover, hoverIdx }) {
  const tweakCtx = useTheme();
  const currentTheme = tweakCtx ? tweakCtx.theme : THEMES.daylight;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchMsg, setBatchMsg] = useState('');
  const fromRef = useRef(null);

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
  const onKey = (e) => {if (e.key === 'Enter') submit();};

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
      <div className="sidebar__header">
        <div className="sidebar__title">
          Flights
          <span className="count-pill">{flights.length}</span>
        </div>
        <div className="sidebar__hint">Add routes by IATA code, e.g. JFK → CDG</div>
      </div>
      <div className="flight-input">
        <div className="flight-input__field">
          <input ref={fromRef} className="flight-input__code" placeholder="FROM" value={from} maxLength={3}
          onChange={(e) => setFrom(e.target.value.toUpperCase())} onKeyDown={onKey} />
          <span className="flight-input__sep">→</span>
          <input className="flight-input__code" placeholder="TO" value={to} maxLength={3}
          onChange={(e) => setTo(e.target.value.toUpperCase())} onKeyDown={onKey} />
        </div>
        <button className="btn-add" onClick={submit} disabled={from.length < 3 || to.length < 3} title="Add flight">
          <Icon.Plus />
        </button>
      </div>
      {error && <div className="flight-error"><Icon.Cancel /> {error}</div>}
      <div className="batch-toggle">
        <button className="batch-toggle__btn" onClick={() => setBatchOpen(o => !o)}>
          {batchOpen ? '− Hide bulk paste' : '+ Bulk routes'}
        </button>
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
    </div>);

}

/* ====== PROJECTION SLIDER ====== */
function ProjSlider({ value, onChange }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const setFromEvent = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const pct = Math.max(0, Math.min(1, x / r.width));
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
  const labels = [{ v: 0, name: 'Globe' }, { v: 0.5, name: 'Robinson' }, { v: 1, name: 'Mercator' }];
  const closestLabel = labels.reduce((a, b) => Math.abs(b.v - value) < Math.abs(a.v - value) ? b : a);
  return (
    <div className="proj-slider-wrap">
      <div className="proj-slider__labels">
        {labels.map((l) =>
        <div key={l.v} className={`proj-slider__label ${closestLabel.v === l.v ? 'proj-slider__label--active' : ''}`}
        onClick={() => onChange(l.v)}>{l.name}</div>
        )}
      </div>
      <div className="proj-slider" ref={trackRef}
      onMouseDown={(e) => {setDragging(true);setFromEvent(e);}}
      onTouchStart={(e) => {setDragging(true);setFromEvent(e);}}>
        <div className="proj-slider__track"></div>
        <div className="proj-slider__fill" style={{ width: `${value * 100}%` }}></div>
        {labels.map((l) => <div key={l.v} className="proj-slider__tick" style={{ left: `${l.v * 100}%` }}></div>)}
        <div className={`proj-slider__thumb ${dragging ? 'proj-slider__thumb--dragging' : ''}`} style={{ left: `${value * 100}%` }}>
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
  const [rotation, setRotation] = useState({ lambda: -10, phi: 20 });
  const [lambdaShift, setLambdaShift] = useState(0); // for flat projections
  const [zoom, setZoom] = useState(1);
  const [verticalPan, setVerticalPan] = useState(0); // y-only pan in flat
  const [dragging, setDragging] = useState(false);
  const [hoverCountry, setHoverCountry] = useState(null);
  const [pinnedCountry, setPinnedCountry] = useState(null);
  const [pinnedPos, setPinnedPos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);

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

  // When sliding to flat, smoothly drain phi to 0 (no tilt makes sense on flat paper)
  useEffect(() => {
    if (projT >= 0.5 && Math.abs(rotation.phi) > 0.3 && !dragging) {
      const id = setTimeout(() => {
        setRotation((r) => ({ lambda: r.lambda, phi: r.phi * 0.85 }));
      }, 30);
      return () => clearTimeout(id);
    }
  }, [projT, rotation.phi, dragging]);

  const onMouseDown = (e) => {
    setDragging(true);
    setHoverCountry(null);
    setPinnedCountry(null);
    dragStart.current = {
      x: e.clientX, y: e.clientY,
      rot: { ...rotation },
      lambdaShift, verticalPan
    };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (projT < 0.5) {
        // Globe / morph-to-Robinson — full rotation (lambda + phi)
        const sensitivity = 0.4 / zoom;
        setRotation({
          lambda: dragStart.current.rot.lambda + dx * sensitivity,
          phi: dragStart.current.rot.phi - dy * sensitivity
        });
      } else {
        // Robinson / Mercator — belt-pan via rotation.lambda; vertical drag = vertical pan
        const baseRadius = Math.min(size.w, size.h) * 0.42;
        const projScale = baseRadius * zoom;
        const lonDelta = dx / projScale * 180;
        setRotation({
          lambda: dragStart.current.rot.lambda + lonDelta,
          phi: dragStart.current.rot.phi
        });
        // Vertical pan locked in flat projections; only horizontal (lambda) pan
      }
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, projT, zoom, size]);

  const onWheel = (e) => {
    e.preventDefault();
    const dz = -e.deltaY * 0.0015;
    setZoom((z) => Math.max(0.5, Math.min(8, z + dz * z)));
  };

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
    onMouseDown={onMouseDown} onWheel={onWheel} onMouseMove={onMouseMove}
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
            const isHover = hoverCountry && hoverCountry.id === c.id;
            return (
              <path
                key={c.id || i}
                d={c.path}
                fill={isHover ? theme.landHover : theme.land}
                fillRule="evenodd"
                stroke={theme.ink}
                strokeWidth="0.7"
                strokeLinejoin="round"
                onMouseEnter={() => !dragging && setHoverCountry(c)}
                onMouseLeave={() => setHoverCountry(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = stageRef.current.getBoundingClientRect();
                  setPinnedCountry(c);
                  setPinnedPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                style={{ cursor: 'pointer' }} />);


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

      {/* Country tooltip — hover */}
      {hoverCountry && !dragging && !pinnedCountry && (() => {
        const s = countryStats[hoverCountry.name];
        const total = s ? s.departures + s.arrivals : 0;
        return (
          <div className="country-tooltip" style={{ left: mousePos.x, top: mousePos.y }}>
            <div className="country-tooltip__name">{hoverCountry.name}</div>
            {s ?
            <div className="country-tooltip__stats">
                <span><b>{s.departures}</b> dep</span>
                <span><b>{s.arrivals}</b> arr</span>
                <span><b>{s.airports.size}</b> {s.airports.size === 1 ? 'airport' : 'airports'}</span>
              </div> :

            <div className="country-tooltip__empty">No routes</div>
            }
          </div>);

      })()}

      {/* Pinned country panel — click to open, button to close */}
      {pinnedCountry && (() => {
        const s = countryStats[pinnedCountry.name];
        const total = s ? s.departures + s.arrivals : 0;
        // Clamp position so panel stays within stage
        const stageW = size.w, stageH = size.h;
        const panelW = 280;
        let x = pinnedPos.x + 16;
        let y = pinnedPos.y - 20;
        if (x + panelW > stageW - 16) x = pinnedPos.x - panelW - 16;
        if (y < 16) y = 16;
        if (y > stageH - 120) y = stageH - 120;
        return (
          <div className="country-pin" style={{ left: x, top: y }}>
            <button className="country-pin__close" onClick={() => setPinnedCountry(null)} aria-label="Close">×</button>
            <div className="country-pin__name">{pinnedCountry.name}</div>
            {s ? (
              <>
                <div className="country-pin__big">{total.toLocaleString()}</div>
                <div className="country-pin__sub">{total === 1 ? 'flight' : 'flights'} · {s.airports.size} {s.airports.size === 1 ? 'airport' : 'airports'}</div>
              </>
            ) : (
              <div className="country-pin__sub country-pin__sub--muted">No routes yet</div>
            )}
          </div>
        );
      })()}

      {/* Stats overlay */}
      {flights.length > 0 &&
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
        <button className="zoom-controls__btn" onClick={() => setZoom((z) => Math.min(8, z * 1.3))} title="Zoom in"><Icon.ZoomIn /></button>
        <button className="zoom-controls__btn" onClick={() => setZoom((z) => Math.max(0.5, z / 1.3))} title="Zoom out"><Icon.ZoomOut /></button>
        <button className="zoom-controls__btn" onClick={() => {setZoom(1);setLambdaShift(0);setVerticalPan(0);setRotation({ lambda: -10, phi: 20 });}} title="Reset view"><Icon.Reset /></button>
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

const FLIGHTS_STORAGE_KEY = 'global-explorer-flights';

const DEFAULT_FLIGHTS = [
{ from: 'JFK', to: 'CDG' },
{ from: 'JFK', to: 'NRT' },
{ from: 'LHR', to: 'SYD' }];

function loadFlightsFromStorage() {
  try {
    const raw = localStorage.getItem(FLIGHTS_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((f) =>
    f && typeof f.from === 'string' && typeof f.to === 'string' &&
    f.from.length === 3 && f.to.length === 3 &&
    AIRPORTS[f.from] && AIRPORTS[f.to] && f.from !== f.to
    );
  } catch {
    return null;
  }
}

function saveFlightsToStorage(flights) {
  try {
    localStorage.setItem(FLIGHTS_STORAGE_KEY, JSON.stringify(flights));
  } catch (err) {
    console.warn('Failed to save flights to localStorage:', err);
  }
}


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

  const baseTheme = THEMES[tweaks.mood] || THEMES.daylight;
  // Allow paperColor tweak to override mood's paper background
  const theme = tweaks.paperColor
    ? { ...baseTheme, paper: tweaks.paperColor }
    : baseTheme;
  const routeStyle = ROUTE_STYLES[tweaks.routeStyle] || ROUTE_STYLES.bold;

  // Apply theme as CSS variables on root — when mood is non-default OR custom paperColor is set
  useEffect(() => {
    const r = document.documentElement;
    const customPaper = !!tweaks.paperColor;
    if ((tweaks.mood && tweaks.mood !== 'daylight') || customPaper) {
      r.style.setProperty('--theme-paper', theme.paper);
      r.style.setProperty('--theme-ink', theme.ink);
      r.style.setProperty('--theme-grat', theme.grat);
      r.style.setProperty('--theme-label', theme.labelColor);
    } else {
      r.style.removeProperty('--theme-paper');
      r.style.removeProperty('--theme-ink');
      r.style.removeProperty('--theme-grat');
      r.style.removeProperty('--theme-label');
    }
    document.body.dataset.mood = tweaks.mood;
  }, [tweaks.mood, tweaks.paperColor, theme.paper, theme.ink, theme.grat, theme.labelColor]);

  const [flights, setFlights] = useState(() => {
    const saved = loadFlightsFromStorage();
    return saved !== null ? saved : DEFAULT_FLIGHTS;
  });
  const [projT, setProjT] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const [countries, setCountries] = useState(null);

  useEffect(() => {
    saveFlightsToStorage(flights);
  }, [flights]);

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
      <Header onSample={loadSample} onClear={clearAll} />
      <div className="explorer-layout">
        <Sidebar flights={flights} onAdd={addFlight} onAddBatch={addBatch} onRemove={removeFlight} onHover={setHoverIdx} hoverIdx={hoverIdx} />
        <div className="main">
          <GlobeStage flights={flights} hoverIdx={hoverIdx} projT={projT} countries={countries} />
          <ProjSlider value={projT} onChange={setProjT} />
        </div>
      </div>
      <TweaksPanel title="Tweaks">
        <TweakSection title="Mood" subtitle="Reshapes the whole palette">
          <TweakRadio
            value={tweaks.mood}
            onChange={(v) => setTweak('mood', v)}
            options={[
              { value: 'daylight', label: 'Daylight' },
              { value: 'blueprint', label: 'Blueprint' },
              { value: 'vintage', label: 'Vintage' },
              { value: 'neon', label: 'Neon' }
            ]}
          />
        </TweakSection>
        <TweakSection title="Background" subtitle="Custom paper color (overrides mood)">
          <TweakColor
            value={tweaks.paperColor || baseTheme.paper}
            onChange={(v) => setTweak('paperColor', v)}
          />
          {tweaks.paperColor && (
            <TweakButton onClick={() => setTweak('paperColor', '')}>
              Reset to mood default
            </TweakButton>
          )}
        </TweakSection>
        <TweakSection title="Route style" subtitle="How flight paths are drawn">
          <TweakRadio
            value={tweaks.routeStyle}
            onChange={(v) => setTweak('routeStyle', v)}
            options={[
              { value: 'hairline', label: 'Hairline' },
              { value: 'medium', label: 'Medium' },
              { value: 'bold', label: 'Bold' },
              { value: 'glow', label: 'Glow' },
              { value: 'dashed', label: 'Dashed' }
            ]}
          />
        </TweakSection>
        <TweakSection title="City marks" subtitle="Airport glyph">
          <TweakRadio
            value={tweaks.cityMark}
            onChange={(v) => setTweak('cityMark', v)}
            options={[
              { value: 'dot', label: 'Dot' },
              { value: 'pin', label: 'Pin' },
              { value: 'halo', label: 'Halo' },
              { value: 'cross', label: 'Cross' }
            ]}
          />
        </TweakSection>
        <TweakSection title="Map position" subtitle="Vertical offset (px)">
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