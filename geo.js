// Projections with morphing support.
// Globe rotation = {lambda, phi} (degrees) — free rotation
// Flat-projection longitude shift handled by replicating geometry at offsets

function orthographic(lon, lat, rotation) {
  const dtr = Math.PI / 180;
  const { lambda = 0, phi = 0 } = rotation;
  const lonR = (lon + lambda) * dtr;
  const latR = lat * dtr;
  const phiR = phi * dtr;
  // Spherical to cartesian (x = forward, y = right, z = up)
  let cx = Math.cos(latR) * Math.cos(lonR);
  let cy = Math.cos(latR) * Math.sin(lonR);
  let cz = Math.sin(latR);
  // Rotate around y-axis by phi (tilts north/south poles toward viewer).
  // Positive phi brings the north pole toward the viewer.
  const cosP = Math.cos(phiR), sinP = Math.sin(phiR);
  const nx = cx * cosP - cz * sinP;
  const nz = cx * sinP + cz * cosP;
  cx = nx; cz = nz;
  return { x: cy, y: -cz, visible: cx >= -0.001 };
}

// Wrap a longitude into [-180, 180] (for belt-style longitude shift in flat maps)
function wrapLon(lon) {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

function mercator(lon, lat) {
  const dtr = Math.PI / 180;
  const latC = Math.max(-85, Math.min(85, lat));
  const x = lon * dtr / Math.PI;
  const y = -Math.log(Math.tan(Math.PI / 4 + latC * dtr / 2)) / Math.PI;
  return { x, y: y / 1.5, visible: true };
}

const ROBINSON_TABLE = [
  [0,1.0000,0.0000],[5,0.9986,0.0620],[10,0.9954,0.1240],[15,0.9900,0.1860],
  [20,0.9822,0.2480],[25,0.9730,0.3100],[30,0.9600,0.3720],[35,0.9427,0.4340],
  [40,0.9216,0.4958],[45,0.8962,0.5571],[50,0.8679,0.6176],[55,0.8350,0.6769],
  [60,0.7986,0.7346],[65,0.7597,0.7903],[70,0.7186,0.8435],[75,0.6732,0.8936],
  [80,0.6213,0.9394],[85,0.5722,0.9761],[90,0.5322,1.0000]
];
function robinson(lon, lat) {
  const absLat = Math.abs(lat);
  const i = Math.min(Math.floor(absLat / 5), 17);
  const t = (absLat - i * 5) / 5;
  const [, x0, y0] = ROBINSON_TABLE[i];
  const [, x1, y1] = ROBINSON_TABLE[Math.min(i + 1, 18)];
  const xStretch = x0 + (x1 - x0) * t;
  const yPos = y0 + (y1 - y0) * t;
  const x = xStretch * (lon / 180);
  const y = -(lat < 0 ? -yPos : yPos) * 0.508;
  return { x, y, visible: true };
}

// Apply rotation to a (lon, lat) pair, returning the rotated lon/lat plus a "front-face" boolean.
// This is what lets the flat projections recenter on the globe's visible face during the morph.
function rotateLonLat(lon, lat, rotation) {
  const dtr = Math.PI / 180;
  const { lambda = 0, phi = 0 } = rotation;
  const lonR = (lon + lambda) * dtr;
  const latR = lat * dtr;
  const phiR = phi * dtr;
  let cx = Math.cos(latR) * Math.cos(lonR);
  let cy = Math.cos(latR) * Math.sin(lonR);
  let cz = Math.sin(latR);
  // Rotate around y-axis by phi (positive phi → north pole toward viewer)
  const cosP = Math.cos(phiR), sinP = Math.sin(phiR);
  const nx = cx * cosP - cz * sinP;
  const nz = cx * sinP + cz * cosP;
  cx = nx; cz = nz;
  const newLat = Math.asin(Math.max(-1, Math.min(1, cz))) / dtr;
  const newLon = Math.atan2(cy, cx) / dtr;
  return { lon: newLon, lat: newLat, frontFacing: cx >= -0.001 };
}

// Morph: t=0 ortho, t=0.5 robinson, t=1 mercator.
// Rob/Merc are always computed in ROTATED lon/lat space so the visible
// globe face stays in the center of the unfolding map — peel-off feel.
function project(lon, lat, t, rotation) {
  if (t <= 0) return orthographic(lon, lat, rotation);

  // Rotate lon/lat into the viewer-facing frame
  const r = rotateLonLat(lon, lat, rotation);

  const ortho = orthographic(lon, lat, rotation);
  const rob = robinson(r.lon, r.lat);
  const merc = mercator(r.lon, r.lat);

  if (t >= 1) {
    // Use rotated coords at t=1 too, so the slider doesn't snap
    return { ...merc, visible: true, frontFacing: true };
  }

  let from, to, localT;
  if (t < 0.5) { from = ortho; to = rob; localT = t * 2; }
  else { from = rob; to = merc; localT = (t - 0.5) * 2; }
  const e = localT * localT * (3 - 2 * localT);

  // Back-facing points have no meaningful ortho coordinate (they'd overlap the front).
  // For the unwrap feel, place back points at the silhouette of the orthographic sphere
  // (lat preserved, lon clamped to ±90 in rotated frame — i.e. the visible edge).
  // From there they slide outward to their Robinson position as t grows. Keeping every
  // back point pinned to this silhouette edge is what fills the globe boundary right up
  // to the rim (no empty gap). The horizontal "stripe" these can form across the deep
  // antimeridian seam is removed in ringPath by breaking the subpath at that seam.
  let fromX = from.x, fromY = from.y;
  if (!r.frontFacing && t < 0.5) {
    const dtr = Math.PI / 180;
    fromX = (r.lon >= 0 ? 1 : -1) * Math.cos(r.lat * dtr);
    fromY = -Math.sin(r.lat * dtr);
  }

  return {
    x: fromX * (1 - e) + to.x * e,
    y: fromY * (1 - e) + to.y * e,
    visible: true,
    frontFacing: r.frontFacing
  };
}

// Blended flat position (Robinson↔Mercator) for an UNWRAPPED rotated lon/lat.
// Both projections are linear in longitude, so rlon may lie outside [-180,180]
// (used for belt repetition); we deliberately never re-wrap it here.
function flatPointXY(rlon, rlat, t) {
  const rob = robinson(rlon, rlat);
  if (t >= 1) return mercator(rlon, rlat);
  const merc = mercator(rlon, rlat);
  const localT = (t - 0.5) * 2;
  const e = localT * localT * (3 - 2 * localT);
  return {
    x: rob.x * (1 - e) + merc.x * e,
    y: rob.y * (1 - e) + merc.y * e
  };
}

// Belt renderer for the flat projections (t >= 0.5, Robinson → Mercator).
// Rotates each ring into the viewer frame, then UNWRAPS its longitudes so the ring
// is one continuous curve (no ±180° jumps). It renders the ring plus ±360° copies and
// lets the SVG clip outline trim the overflow. With no splitting, wrap-around polygons
// (Antarctica's bottom band, Russia, Fiji) stay closed and fill correctly.
function ringPathFlat(ring, t, effRot, scale, cx, cy, closed) {
  if (ring.length < 2) return '';
  // Rotate into the viewer frame and unwrap longitudes into one continuous run.
  const pts = [];
  let prev = null, sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const r = rotateLonLat(ring[i][0], ring[i][1], effRot);
    let ulon = r.lon;
    if (prev !== null) {
      while (ulon - prev > 180) ulon -= 360;
      while (ulon - prev < -180) ulon += 360;
    }
    prev = ulon;
    sum += ulon;
    pts.push({ ulon, lat: r.lat });
  }
  // Recenter the unwrapped ring so its body lands inside the ±180° window.
  const shift = -360 * Math.round((sum / pts.length) / 360);

  let path = '';
  // Belt copies cover the viewport; the SVG clip trims whatever overflows.
  for (const off of [-360, 0, 360]) {
    const base = shift + off;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const l = pts[i].ulon + base;
      if (l < mn) mn = l;
      if (l > mx) mx = l;
    }
    // Skip copies entirely outside the visible ±180° longitude window.
    if (mx < -185 || mn > 185) continue;
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const p = flatPointXY(pts[i].ulon + base, pts[i].lat, t);
      d += (i === 0 ? 'M' : 'L') + (cx + p.x * scale).toFixed(2) + ' ' + (cy + p.y * scale).toFixed(2);
    }
    if (closed) d += 'Z';
    path += d;
  }
  return path;
}

// Single-tile polyline. The longitude rotation is handled inside project() via the rotation arg.
// Here we just need to detect when consecutive projected points jump across the screen
// (antimeridian wrap on flat) and start a new subpath there.
function ringPath(ring, t, rotation, scale, cx, cy, lambdaShift = 0, closed = false) {
  // Combine lambdaShift into rotation.lambda — both ultimately rotate longitude
  const effRot = { lambda: (rotation.lambda || 0) + lambdaShift, phi: rotation.phi || 0 };
  // Flat projections (Robinson → Mercator): belt-render in continuous longitude so
  // wrap-around polygons stay closed and fill. The globe/unfold morph (t < 0.5) below
  // is untouched.
  if (t >= 0.5) return ringPathFlat(ring, t, effRot, scale, cx, cy, closed);
  let path = '';
  let lastVisible = false;
  let lastSx = 0, lastSy = 0;
  let subFirstSx = 0, subFirstSy = 0;
  let subOpen = false;
  let prevRlon = null;
  let prevBack = false;
  const flat = t > 0.05;
  // Threshold: a jump bigger than a third of the unit-projection-width (~0.66) means antimeridian split.
  const jumpThreshold = 0.66 * scale;
  const closeSub = () => {
    if (closed && subOpen) path += 'Z';
    subOpen = false;
  };
  for (let i = 0; i < ring.length; i++) {
    const lon = ring[i][0];
    const lat = ring[i][1];
    const r = rotateLonLat(lon, lat, effRot);
    const p = project(lon, lat, t, effRot);
    if (!p || !p.visible) {
      if (lastVisible) closeSub();
      lastVisible = false;
      prevRlon = r.lon;
      prevBack = !r.frontFacing;
      continue;
    }
    const sx = cx + p.x * scale;
    const sy = cy + p.y * scale;
    let breakHere = false;
    // Deep-seam break: back-facing points are pinned to the silhouette edge x = sign(rlon)·cos(lat).
    // The sign flips only when the rotated longitude wraps across ±180 (the far antimeridian),
    // so connecting across it would draw a full-width horizontal "stripe". Break the subpath
    // there instead. This works at ALL t (the pixel test below is off for t ≤ 0.05).
    if (lastVisible && prevBack && !r.frontFacing && prevRlon !== null &&
        Math.abs(r.lon - prevRlon) > 180) {
      breakHere = true;
    }
    if (flat && lastVisible && !breakHere) {
      const dx = sx - lastSx, dy = sy - lastSy;
      // Big horizontal leap with small vertical change = antimeridian wrap
      if (Math.abs(dx) > jumpThreshold && Math.abs(dy) < jumpThreshold * 0.6) breakHere = true;
    }
    if (!lastVisible || breakHere) {
      if (lastVisible && breakHere) closeSub();
      path += `M${sx.toFixed(2)} ${sy.toFixed(2)}`;
      lastSx = sx; lastSy = sy;
      subFirstSx = sx; subFirstSy = sy;
      subOpen = true;
      lastVisible = true;
    } else {
      const dx = sx - lastSx, dy = sy - lastSy;
      if (dx*dx + dy*dy > 0.4) {
        path += `L${sx.toFixed(2)} ${sy.toFixed(2)}`;
        lastSx = sx; lastSy = sy;
      }
    }
    prevRlon = r.lon;
    prevBack = !r.frontFacing;
  }
  closeSub();
  return path;
}

function arcPath(p1, p2, t, rotation, scale, cx, cy, lambdaShift = 0, segments = 96) {
  const dtr = Math.PI / 180;
  const lon1 = p1.lon, lat1 = p1.lat, lon2 = p2.lon, lat2 = p2.lat;
  const a = [Math.cos(lat1*dtr)*Math.cos(lon1*dtr), Math.cos(lat1*dtr)*Math.sin(lon1*dtr), Math.sin(lat1*dtr)];
  const b = [Math.cos(lat2*dtr)*Math.cos(lon2*dtr), Math.cos(lat2*dtr)*Math.sin(lon2*dtr), Math.sin(lat2*dtr)];
  let dot = a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  dot = Math.max(-1, Math.min(1, dot));
  const omega = Math.acos(dot);
  const sinO = Math.sin(omega);
  // Build a great-circle ring (degrees) once
  const ring = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    let lon, lat;
    if (sinO < 1e-6) { lon = lon1 + (lon2-lon1)*f; lat = lat1 + (lat2-lat1)*f; }
    else {
      const s1 = Math.sin((1-f)*omega)/sinO, s2 = Math.sin(f*omega)/sinO;
      const x = a[0]*s1+b[0]*s2, y = a[1]*s1+b[1]*s2, z = a[2]*s1+b[2]*s2;
      lat = Math.asin(Math.max(-1, Math.min(1, z)))/dtr;
      lon = Math.atan2(y, x)/dtr;
    }
    // Disambiguate antimeridian crossings by accumulating lon
    if (i > 0) {
      const prev = ring[i-1][0];
      while (lon - prev > 180) lon -= 360;
      while (lon - prev < -180) lon += 360;
    }
    ring.push([lon, lat]);
  }
  return ringPath(ring, t, rotation, scale, cx, cy, lambdaShift, false);
}

function gcDistance(p1, p2) {
  const R = 6371, dtr = Math.PI/180;
  const dLat = (p2.lat-p1.lat)*dtr, dLon = (p2.lon-p1.lon)*dtr;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat*dtr)*Math.cos(p2.lat*dtr)*Math.sin(dLon/2)**2;
  return Math.round(2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function graticule() {
  const lines = [];
  for (let lon = -180; lon <= 180; lon += 15) {
    const ring = [];
    for (let lat = -85; lat <= 85; lat += 4) ring.push([lon, lat]);
    lines.push(ring);
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const ring = [];
    for (let lon = -180; lon <= 180; lon += 4) ring.push([lon, lat]);
    lines.push(ring);
  }
  return lines;
}

// Project a single point. Rotation now handles both globe-orientation and flat lambda-shift.
function projectPoint(lon, lat, t, rotation, lambdaShift = 0) {
  const effRot = { lambda: (rotation.lambda || 0) + lambdaShift, phi: rotation.phi || 0 };
  return project(lon, lat, t, effRot);
}

window.Geo = { orthographic, mercator, robinson, project, projectPoint, arcPath, ringPath, gcDistance, graticule };
