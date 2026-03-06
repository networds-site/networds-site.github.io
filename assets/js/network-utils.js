/**
 * Network Utilities
 * Shared utility functions and geometry helpers
 */

// Seeded random number generator (mulberry32)
function createSeededRandom(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for normal distribution
function createNormalRandom(randomFunc) {
  let spare = null;
  return function(mean = 0, stddev = 1) {
    if (spare !== null) {
      const result = spare * stddev + mean;
      spare = null;
      return result;
    }
    const u1 = randomFunc();
    const u2 = randomFunc();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spare = r * Math.sin(theta);
    return r * Math.cos(theta) * stddev + mean;
  };
}

// Hash function for strings (deterministic)
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// HSV to RGB color conversion
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = v - c;

  let r, g, b;
  if (h < 1/6) { r = c; g = x; b = 0; }
  else if (h < 2/6) { r = x; g = c; b = 0; }
  else if (h < 3/6) { r = 0; g = c; b = x; }
  else if (h < 4/6) { r = 0; g = x; b = c; }
  else if (h < 5/6) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

// Get nearest point on rectangle boundary to a target point
function getNearestBoundaryPoint(rectX, rectY, rectWidth, rectHeight, targetX, targetY) {
  const hw = rectWidth / 2;
  const hh = rectHeight / 2;
  const left = rectX - hw;
  const right = rectX + hw;
  const top = rectY - hh;
  const bottom = rectY + hh;

  // Check if target is inside rectangle
  if (targetX >= left && targetX <= right && targetY >= top && targetY <= bottom) {
    return { x: rectX, y: rectY }; // Return center
  }

  // Clamp target point to rectangle boundary
  const clampedX = Math.max(left, Math.min(right, targetX));
  const clampedY = Math.max(top, Math.min(bottom, targetY));

  return { x: clampedX, y: clampedY };
}

// Calculate 3D distance between two rectangles (edge-to-edge)
function rectToRectDistance3D(x1, y1, z1, w1, h1, x2, y2, z2, w2, h2) {
  const hw1 = w1 / 2, hh1 = h1 / 2;
  const hw2 = w2 / 2, hh2 = h2 / 2;

  const dx2D = Math.max(0, Math.abs(x2 - x1) - (hw1 + hw2));
  const dy2D = Math.max(0, Math.abs(y2 - y1) - (hh1 + hh2));
  const dist2D = Math.sqrt(dx2D * dx2D + dy2D * dy2D);
  const dz = z2 - z1;

  return Math.sqrt(dist2D * dist2D + dz * dz);
}

// Calculate line-rectangle intersection point
function lineRectIntersection(fromX, fromY, toX, toY, rectCenterX, rectCenterY, rectWidth, rectHeight) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const hw = rectWidth / 2;
  const hh = rectHeight / 2;

  let tMin = Infinity;
  let intersectX = toX;
  let intersectY = toY;

  const edges = [
    { t: (rectCenterX - hw - fromX) / dx, isVertical: true, x: rectCenterX - hw },
    { t: (rectCenterX + hw - fromX) / dx, isVertical: true, x: rectCenterX + hw },
    { t: (rectCenterY - hh - fromY) / dy, isVertical: false, y: rectCenterY - hh },
    { t: (rectCenterY + hh - fromY) / dy, isVertical: false, y: rectCenterY + hh }
  ];

  edges.forEach(edge => {
    if (edge.t > 0 && edge.t < tMin) {
      const x = edge.isVertical ? edge.x : fromX + edge.t * dx;
      const y = edge.isVertical ? fromY + edge.t * dy : edge.y;

      if (x >= rectCenterX - hw && x <= rectCenterX + hw &&
          y >= rectCenterY - hh && y <= rectCenterY + hh) {
        tMin = edge.t;
        intersectX = x;
        intersectY = y;
      }
    }
  });

  return { x: intersectX, y: intersectY };
}
