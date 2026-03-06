/**
 * Network Renderer Module
 * Handles all canvas drawing operations
 */

/**
 * Draw a single edge
 * @param {Object} context - Rendering context with ctx, edge, nodes, positions, dimensions, etc.
 */
function drawEdge(context) {
  const {
    ctx,
    edge,
    nodePositions,
    getBoxDimensions,
    gimmick,
    guessedWords,
    physicsConfig,
    lineRectIntersection,
    viewScale,
    toScreenCoords
  } = context;

  const fromVirtual = nodePositions[edge.from];
  const toVirtual = nodePositions[edge.to];
  const from = toScreenCoords(fromVirtual);
  const to = toScreenCoords(toVirtual);
  const fromBoxVirtual = getBoxDimensions(edge.from);
  const toBoxVirtual = getBoxDimensions(edge.to);

  // Scale box dimensions to screen space
  const fromBox = { width: fromBoxVirtual.width * viewScale, height: fromBoxVirtual.height * viewScale };
  const toBox = { width: toBoxVirtual.width * viewScale, height: toBoxVirtual.height * viewScale };

  // Check visibility for invisible_connections gimmick
  if (gimmick === 'invisible_connections') {
    if (!guessedWords.has(edge.from) || !guessedWords.has(edge.to)) {
      return;
    }
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (edge.direction === 'anagram') {
    drawWaveEdge(ctx, from, to, fromBox, toBox, dx, dy, distance, '#ff0000', 'sine', physicsConfig.lengthScale * viewScale, viewScale);
  } else if (edge.direction === 'triangle') {
    drawWaveEdge(ctx, from, to, fromBox, toBox, dx, dy, distance, '#0000ff', 'triangle', physicsConfig.lengthScale * viewScale, viewScale);
  } else {
    drawStraightEdge(ctx, from, to, fromBox, toBox, lineRectIntersection, viewScale);
  }
}

/**
 * Draw a straight edge between two boxes
 */
function drawStraightEdge(ctx, from, to, fromBox, toBox, lineRectIntersection, viewScale) {
  const fromIntersect = lineRectIntersection(from.x, from.y, to.x, to.y, from.x, from.y, fromBox.width, fromBox.height);
  const toIntersect = lineRectIntersection(from.x, from.y, to.x, to.y, to.x, to.y, toBox.width, toBox.height);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4.5 * viewScale;
  ctx.beginPath();
  ctx.moveTo(fromIntersect.x, fromIntersect.y);
  ctx.lineTo(toIntersect.x, toIntersect.y);
  ctx.stroke();
}

/**
 * Draw a wave edge (sine or triangle)
 */
function drawWaveEdge(ctx, from, to, fromBox, toBox, dx, dy, distance, color, waveType, lengthScale, viewScale) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.5 * viewScale;

  const wavelength = waveType === 'sine' ? lengthScale / 4 : lengthScale / 8;
  const amplitude = wavelength / 4;

  const dirX = dx / distance;
  const dirY = dy / distance;
  const perpX = -dirY;
  const perpY = dirX;

  const numSegments = Math.max(50, Math.floor(distance / 2));
  const points = [];

  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const baseX = from.x + t * dx;
    const baseY = from.y + t * dy;

    let offset;
    if (waveType === 'sine') {
      const phase = (t * distance / wavelength) * 2 * Math.PI;
      const sinValue = Math.sin(phase);
      const alpha = 0.5;
      offset = amplitude * Math.pow(Math.abs(sinValue), alpha) * Math.sign(sinValue);
    } else {
      const phase = t * distance / wavelength;
      const phaseInCycle = phase - Math.floor(phase);
      if (phaseInCycle < 0.25) {
        offset = amplitude * (phaseInCycle * 4);
      } else if (phaseInCycle < 0.75) {
        offset = amplitude * (2 - phaseInCycle * 4);
      } else {
        offset = amplitude * (-4 + phaseInCycle * 4);
      }
    }

    points.push({
      x: baseX + offset * perpX,
      y: baseY + offset * perpY
    });
  }

  // Trim to box edges
  let startIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (Math.abs(p.x - from.x) > fromBox.width / 2 || Math.abs(p.y - from.y) > fromBox.height / 2) {
      startIdx = Math.max(0, i - 1);
      break;
    }
  }

  let endIdx = points.length - 1;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (Math.abs(p.x - to.x) > toBox.width / 2 || Math.abs(p.y - to.y) > toBox.height / 2) {
      endIdx = Math.min(points.length - 1, i + 1);
      break;
    }
  }

  ctx.beginPath();
  for (let i = startIdx; i <= endIdx; i++) {
    if (i === startIdx) {
      ctx.moveTo(points[i].x, points[i].y);
    } else {
      ctx.lineTo(points[i].x, points[i].y);
    }
  }
  ctx.stroke();
}

/**
 * Draw directional circles on edge endpoints
 */
function drawEdgeCircles(context) {
  const { ctx, edge, nodePositions, getBoxDimensions, lineRectIntersection, viewScale, toScreenCoords } = context;

  if (edge.direction === 'anagram' || edge.direction === 'triangle') return;

  const fromVirtual = nodePositions[edge.from];
  const toVirtual = nodePositions[edge.to];
  const from = toScreenCoords(fromVirtual);
  const to = toScreenCoords(toVirtual);
  const fromBoxVirtual = getBoxDimensions(edge.from);
  const toBoxVirtual = getBoxDimensions(edge.to);
  const fromBox = { width: fromBoxVirtual.width * viewScale, height: fromBoxVirtual.height * viewScale };
  const toBox = { width: toBoxVirtual.width * viewScale, height: toBoxVirtual.height * viewScale };

  ctx.fillStyle = '#000';

  if (edge.direction === 'forward' || edge.direction === 'bidirectional') {
    const toIntersect = lineRectIntersection(from.x, from.y, to.x, to.y, to.x, to.y, toBox.width, toBox.height);
    ctx.beginPath();
    ctx.arc(toIntersect.x, toIntersect.y, 7.5 * viewScale, 0, 2 * Math.PI);
    ctx.fill();
  }

  if (edge.direction === 'backward' || edge.direction === 'bidirectional') {
    const fromIntersect = lineRectIntersection(to.x, to.y, from.x, from.y, from.x, from.y, fromBox.width, fromBox.height);
    ctx.beginPath();
    ctx.arc(fromIntersect.x, fromIntersect.y, 7.5 * viewScale, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/**
 * Main render function
 * @param {Object} context - Full rendering context
 */
function render(context) {
  const {
    ctx,
    width,
    height,
    mode,
    physicsStepCount,
    showBounds,
    bounds,
    edges,
    nodes,
    nodePositions,
    guessedWords,
    displayConfig,
    fontSize,
    viewScale,
    victoryText,
    getBoxDimensions,
    getNodeColor,
    gimmick,
    physicsConfig,
    lineRectIntersection,
    toScreenCoords
  } = context;

  ctx.clearRect(0, 0, width, height);

  // Draw game mode UI elements
  if (mode === 'game') {
    const PHASE_1_STEPS = 2500;
    const PHASE_2_STEPS = 5000;
    const PHASE_3_STEPS = 10000;
    const inPhase4 = physicsStepCount >= PHASE_3_STEPS;

    // Draw "annealing..." text if not in steady state
    if (!inPhase4) {
      ctx.font = '20px "Gill Sans", sans-serif';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('annealing...', 10, 10);
    }
  }

  // Draw bounding box if enabled (transform to screen coordinates)
  if (showBounds && bounds) {
    const topLeft = toScreenCoords({ x: bounds.x, y: bounds.y });
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2 * viewScale;
    ctx.strokeRect(topLeft.x, topLeft.y, bounds.width * viewScale, bounds.height * viewScale);
  }

  // Draw edges
  edges.forEach(edge => {
    drawEdge({
      ctx,
      edge,
      nodePositions,
      getBoxDimensions,
      gimmick,
      guessedWords,
      physicsConfig,
      lineRectIntersection,
      viewScale,
      toScreenCoords
    });
  });

  // Draw nodes
  ctx.font = `${fontSize}px "Gill Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  nodes.forEach(node => {
    const posVirtual = nodePositions[node];
    const pos = toScreenCoords(posVirtual);
    const boxVirtual = getBoxDimensions(node);
    const box = { width: boxVirtual.width * viewScale, height: boxVirtual.height * viewScale };

    ctx.fillStyle = getNodeColor(node);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2 * viewScale;
    ctx.fillRect(pos.x - box.width/2, pos.y - box.height/2, box.width, box.height);
    ctx.strokeRect(pos.x - box.width/2, pos.y - box.height/2, box.width, box.height);

    if (guessedWords.has(node) || displayConfig.showLabelsAlways) {
      ctx.fillStyle = '#000';
      ctx.fillText(node, pos.x, pos.y);
    }
  });

  // Draw edge direction circles
  edges.forEach(edge => {
    drawEdgeCircles({
      ctx,
      edge,
      nodePositions,
      getBoxDimensions,
      lineRectIntersection,
      viewScale,
      toScreenCoords
    });
  });

  // Draw game mode bottom text
  if (mode === 'game') {
    const PHASE_3_STEPS = 10000;
    const inPhase4 = physicsStepCount >= PHASE_3_STEPS;

    // Draw drag instruction
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile && inPhase4) {
      ctx.font = '18px "Gill Sans", sans-serif';
      ctx.fillStyle = '#999';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('click and drag to adjust the graph', width - 10, height - 10);
    }

    // Draw song name when complete
    if (guessedWords.size === nodes.length) {
      ctx.font = '18px "Gill Sans", sans-serif';
      ctx.fillStyle = '#999';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(victoryText, 10, height - 10);
    }
  }
}
