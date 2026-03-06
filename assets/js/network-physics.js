/**
 * Network Physics Module
 * Handles all physics computations for both display and game modes
 */

/**
 * Update physics for display mode (simplified 2D physics with boundary constraints)
 * @param {Object} context - Physics context containing nodes, edges, positions, config, etc.
 */
function updateDisplayPhysics(context) {
  const {
    nodes,
    edges,
    nodePositions,
    physicsConfig,
    bounds,
    draggedNode,
    displayConfig,
    seededRandom,
    getBoxDimensions,
    getNearestBoundaryPoint,
    rectToRectDistance3D
  } = context;

  const {
    repulsionFactor,
    attractionFactor,
    lengthScale,
    damping,
    maxVelocity
  } = physicsConfig;

  const maxRepulsionDistance = 3 * lengthScale;
  const dt = 1;

  // Reset forces
  nodes.forEach(node => {
    const pos = nodePositions[node];
    pos.fx = 0;
    pos.fy = 0;
    pos.fz = 0;
  });

  // Repulsion (2D only for display mode)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];
      const pos1 = nodePositions[node1];
      const pos2 = nodePositions[node2];

      const box1 = getBoxDimensions(node1);
      const box2 = getBoxDimensions(node2);

      const edgeDist = rectToRectDistance3D(
        pos1.x, pos1.y, 0, box1.width, box1.height,
        pos2.x, pos2.y, 0, box2.width, box2.height
      );

      if (edgeDist <= maxRepulsionDistance) {
        let forceMagnitude = repulsionFactor * Math.exp(-edgeDist / lengthScale) *
                            (lengthScale + edgeDist) / ((edgeDist + 0.01) * (edgeDist + 0.01));
        forceMagnitude = Math.min(forceMagnitude, repulsionFactor);

        let dx1, dy1, dx2, dy2;

        if (displayConfig.useBoundaryRepulsion) {
          // Boundary-aware repulsion: force from nearest boundary point to center
          const nearestPoint2 = getNearestBoundaryPoint(pos2.x, pos2.y, box2.width, box2.height, pos1.x, pos1.y);
          dx1 = pos1.x - nearestPoint2.x;
          dy1 = pos1.y - nearestPoint2.y;

          const nearestPoint1 = getNearestBoundaryPoint(pos1.x, pos1.y, box1.width, box1.height, pos2.x, pos2.y);
          dx2 = pos2.x - nearestPoint1.x;
          dy2 = pos2.y - nearestPoint1.y;
        } else {
          // Simple center-to-center repulsion
          dx1 = pos1.x - pos2.x;
          dy1 = pos1.y - pos2.y;
          dx2 = pos2.x - pos1.x;
          dy2 = pos2.y - pos1.y;
        }

        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + 0.01);
        const fx1 = (dx1 / dist1) * forceMagnitude;
        const fy1 = (dy1 / dist1) * forceMagnitude;

        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + 0.01);
        const fx2 = (dx2 / dist2) * forceMagnitude;
        const fy2 = (dy2 / dist2) * forceMagnitude;

        pos1.fx += fx1;
        pos1.fy += fy1;
        pos2.fx += fx2;
        pos2.fy += fy2;
      }
    }
  }

  // Attraction along edges (2D)
  edges.forEach(edge => {
    const pos1 = nodePositions[edge.from];
    const pos2 = nodePositions[edge.to];

    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dist = Math.sqrt(dx * dx + dy * dy + 0.01);

    const forceMagnitude = 1.5 * attractionFactor * Math.sqrt(dist) / Math.pow(lengthScale, 1.5);
    const fx = (dx / dist) * forceMagnitude;
    const fy = (dy / dist) * forceMagnitude;

    pos1.fx += fx;
    pos1.fy += fy;
    pos2.fx -= fx;
    pos2.fy -= fy;
  });

  // Slow drift toward center of bounding box
  if (bounds) {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const centeringStrength = 0.00001; // Very very weak force

    nodes.forEach(node => {
      const pos = nodePositions[node];
      const dx = centerX - pos.x;
      const dy = centerY - pos.y;

      pos.fx += dx * centeringStrength;
      pos.fy += dy * centeringStrength;
    });
  }

  // Update positions
  nodes.forEach(node => {
    const pos = nodePositions[node];
    pos.z = 0;
    pos.vz = 0;

    // Skip physics update for dragged node (position is controlled by mouse)
    if (node === draggedNode) {
      pos.vx = 0;
      pos.vy = 0;
      return;
    }

    pos.vx = (pos.vx + pos.fx) * (1 - damping);
    pos.vy = (pos.vy + pos.fy) * (1 - damping);

    // Gentle dancing for display mode
    if (displayConfig.enableDancing) {
      const intensity = displayConfig.danceIntensity;
      pos.vx += (seededRandom() * 2 - 1) * intensity;
      pos.vy += (seededRandom() * 2 - 1) * intensity;
    }

    // Clamp velocity
    const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy);
    if (speed > maxVelocity) {
      pos.vx = (pos.vx / speed) * maxVelocity;
      pos.vy = (pos.vy / speed) * maxVelocity;
    }

    pos.x += pos.vx * dt;
    pos.y += pos.vy * dt;

    // Apply bounds if specified (hard boundary - consider box size)
    if (bounds) {
      const box = getBoxDimensions(node);
      const halfWidth = box.width / 2;
      const halfHeight = box.height / 2;

      const minX = bounds.x + halfWidth;
      const maxX = bounds.x + bounds.width - halfWidth;
      const minY = bounds.y + halfHeight;
      const maxY = bounds.y + bounds.height - halfHeight;

      pos.x = Math.max(minX, Math.min(maxX, pos.x));
      pos.y = Math.max(minY, Math.min(maxY, pos.y));

      // Zero velocity if hitting boundary
      if (pos.x <= minX || pos.x >= maxX) pos.vx = 0;
      if (pos.y <= minY || pos.y >= maxY) pos.vy = 0;
    }
  });
}

/**
 * Update physics for game mode (full 3D physics with 4 phases)
 * @param {Object} context - Physics context containing nodes, edges, positions, config, etc.
 */
function updateGamePhysics(context) {
  const {
    nodes,
    edges,
    nodePositions,
    physicsConfig,
    physicsStepCount,
    draggedNode,
    guessedWords,
    seededRandom,
    width,
    height,
    maxInitialZ,
    getBoxDimensions,
    getNearestBoundaryPoint,
    rectToRectDistance3D
  } = context;

  const {
    repulsionFactor,
    attractionFactor,
    lengthScale,
    damping,
    maxVelocity
  } = physicsConfig;

  const maxRepulsionDistance = 3 * lengthScale;
  const perturbationStddev = 0.5;

  // Phase constants
  const PHASE_1_STEPS = 7500;   // 3x longer
  const PHASE_2_STEPS = 15000;  // 3x longer
  const PHASE_3_STEPS = 30000;  // 3x longer

  const inPhase1 = physicsStepCount < PHASE_1_STEPS;
  const inPhase2 = physicsStepCount >= PHASE_1_STEPS && physicsStepCount < PHASE_2_STEPS;
  const inPhase3 = physicsStepCount >= PHASE_2_STEPS && physicsStepCount < PHASE_3_STEPS;
  const inPhase4 = physicsStepCount >= PHASE_3_STEPS;

  // Use slower dt in Phase 4 (steady state), fast dt for annealing phases
  const dt = 10;

  // Reset forces
  nodes.forEach(node => {
    const pos = nodePositions[node];
    pos.fx = 0;
    pos.fy = 0;
    pos.fz = 0;
  });

  // Repulsion between all nodes (3D for phases 1-2, 2D for phases 3-4)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];
      const pos1 = nodePositions[node1];
      const pos2 = nodePositions[node2];

      const box1 = getBoxDimensions(node1);
      const box2 = getBoxDimensions(node2);

      const z1 = (inPhase3 || inPhase4) ? 0 : pos1.z;
      const z2 = (inPhase3 || inPhase4) ? 0 : pos2.z;

      const edgeDist = rectToRectDistance3D(
        pos1.x, pos1.y, z1, box1.width, box1.height,
        pos2.x, pos2.y, z2, box2.width, box2.height
      );

      if (edgeDist <= maxRepulsionDistance) {
        let forceMagnitude = repulsionFactor * Math.exp(-edgeDist / lengthScale) *
                            (lengthScale + edgeDist) / ((edgeDist + 0.01) * (edgeDist + 0.01));
        forceMagnitude = Math.min(forceMagnitude, repulsionFactor);

        let dx1, dy1, dx2, dy2;

        // Note: useBoundaryRepulsion not typically used in game mode, but supported
        if (false) { // Always use center-to-center for game mode
          const nearestPoint2 = getNearestBoundaryPoint(pos2.x, pos2.y, box2.width, box2.height, pos1.x, pos1.y);
          dx1 = pos1.x - nearestPoint2.x;
          dy1 = pos1.y - nearestPoint2.y;

          const nearestPoint1 = getNearestBoundaryPoint(pos1.x, pos1.y, box1.width, box1.height, pos2.x, pos2.y);
          dx2 = pos2.x - nearestPoint1.x;
          dy2 = pos2.y - nearestPoint1.y;
        } else {
          // Simple center-to-center repulsion
          dx1 = pos1.x - pos2.x;
          dy1 = pos1.y - pos2.y;
          dx2 = pos2.x - pos1.x;
          dy2 = pos2.y - pos1.y;
        }

        const dz1 = z1 - z2;
        const dz2 = z2 - z1;

        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1 + 0.01);
        pos1.fx += (dx1 / dist1) * forceMagnitude;
        pos1.fy += (dy1 / dist1) * forceMagnitude;
        if (inPhase1 || inPhase2) {
          pos1.fz += (dz1 / dist1) * forceMagnitude;
        }

        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2 + 0.01);
        pos2.fx += (dx2 / dist2) * forceMagnitude;
        pos2.fy += (dy2 / dist2) * forceMagnitude;
        if (inPhase1 || inPhase2) {
          pos2.fz += (dz2 / dist2) * forceMagnitude;
        }
      }
    }
  }

  // Attraction along edges
  edges.forEach(edge => {
    const pos1 = nodePositions[edge.from];
    const pos2 = nodePositions[edge.to];

    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = (inPhase3 || inPhase4) ? 0 : (pos2.z - pos1.z);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz + 0.01);

    const forceMagnitude = 1.5 * attractionFactor * Math.sqrt(dist) / Math.pow(lengthScale, 1.5);
    const fx = (dx / dist) * forceMagnitude;
    const fy = (dy / dist) * forceMagnitude;
    const fz = (dz / dist) * forceMagnitude;

    pos1.fx += fx;
    pos1.fy += fy;
    pos2.fx -= fx;
    pos2.fy -= fy;

    if (inPhase1 || inPhase2) {
      pos1.fz += fz;
      pos2.fz -= fz;
    }
  });

  // Gentle centering force (COM-based - all boxes feel same force)
  const centerX = width / 2;
  const centerY = height / 2;
  const centeringStrength = 0.000005; // Very weak constant force toward center (10x weaker)

  // Calculate center of mass
  let comX = 0, comY = 0;
  nodes.forEach(node => {
    comX += nodePositions[node].x;
    comY += nodePositions[node].y;
  });
  comX /= nodes.length;
  comY /= nodes.length;

  // Force proportional to COM displacement from center
  const shiftX = (centerX - comX) * centeringStrength;
  const shiftY = (centerY - comY) * centeringStrength;

  // Apply same force to all nodes
  nodes.forEach(node => {
    const pos = nodePositions[node];
    pos.fx += shiftX;
    pos.fy += shiftY;
  });

  // Update positions
  nodes.forEach(node => {
    const pos = nodePositions[node];

    // Skip position update for dragged node (only in phase 4)
    if (node === draggedNode && inPhase4) {
      pos.vx = 0;
      pos.vy = 0;
      return;
    }

    if (inPhase3 || inPhase4) {
      // Phases 3 & 4: Pure 2D
      pos.z = 0;
      pos.vz = 0;
      pos.vx = (pos.vx + pos.fx) * (1 - damping);
      pos.vy = (pos.vy + pos.fy) * (1 - damping);

      if (inPhase3) {
        // Phase 3: Annealing - always add dancing perturbation
        const danceStddev = perturbationStddev / 30;
        const aDance = danceStddev * Math.sqrt(3);
        pos.vx += (seededRandom() * 2 * aDance) - aDance;
        pos.vy += (seededRandom() * 2 * aDance) - aDance;
      } else if (inPhase4) {
        // Phase 4: Steady state - only dance if puzzle is complete
        if (guessedWords.size === nodes.length) {
          const danceStddev = perturbationStddev / 300;
          const aDance = danceStddev * Math.sqrt(3);
          pos.vx += (seededRandom() * 2 * aDance) - aDance;
          pos.vy += (seededRandom() * 2 * aDance) - aDance;
        }
      }

      // Clamp velocity
      const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy);
      if (speed > maxVelocity) {
        pos.vx = (pos.vx / speed) * maxVelocity;
        pos.vy = (pos.vy / speed) * maxVelocity;
      }

      pos.x += pos.vx * dt;
      pos.y += pos.vy * dt;
    } else {
      // Phases 1 & 2: 3D dynamics
      pos.vx = (pos.vx + pos.fx) * (1 - damping);
      pos.vy = (pos.vy + pos.fy) * (1 - damping);
      pos.vz = (pos.vz + pos.fz) * (1 - damping);

      // Clamp velocity
      const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy + pos.vz * pos.vz);
      if (speed > maxVelocity) {
        pos.vx = (pos.vx / speed) * maxVelocity;
        pos.vy = (pos.vy / speed) * maxVelocity;
        pos.vz = (pos.vz / speed) * maxVelocity;
      }

      pos.x += pos.vx * dt;
      pos.y += pos.vy * dt;
      pos.z += pos.vz * dt;

      // Phase 2: Linear squeeze to 2D
      if (inPhase2) {
        const progress = (physicsStepCount - PHASE_1_STEPS) / (PHASE_2_STEPS - PHASE_1_STEPS);
        const maxZ = maxInitialZ * (1 - progress);

        pos.z = Math.max(-maxZ, Math.min(maxZ, pos.z));

        if (Math.abs(pos.z) >= maxZ - 0.01) {
          pos.vz = 0;
        }
      }
    }

    // Keep within canvas bounds
    const margin = 50;
    pos.x = Math.max(margin, Math.min(width - margin, pos.x));
    pos.y = Math.max(margin, Math.min(height - margin, pos.y));
  });
}

/**
 * Center the graph within its bounds or canvas
 * @param {Object} context - Contains nodes, nodePositions, bounds, width, height
 */
function centerGraph(context) {
  const { nodes, nodePositions, bounds, width, height } = context;

  let avgX = 0, avgY = 0;
  nodes.forEach(node => {
    avgX += nodePositions[node].x;
    avgY += nodePositions[node].y;
  });
  avgX /= nodes.length;
  avgY /= nodes.length;

  const targetX = bounds ? (bounds.x + bounds.width / 2) : (width / 2);
  const targetY = bounds ? (bounds.y + bounds.height / 2) : (height / 2);

  const shiftX = targetX - avgX;
  const shiftY = targetY - avgY;

  nodes.forEach(node => {
    nodePositions[node].x += shiftX;
    nodePositions[node].y += shiftY;
  });
}
