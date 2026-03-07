// ============================================================================
// PHYSICS ENGINE (adapted from network-physics.js)
// ============================================================================

function updatePhysics() {
  const dt = 1;
  const maxRepulsionDistance = 3 * PHYSICS_CONFIG.lengthScale;

  // Reset forces
  nodes.forEach(node => {
    node.fx = 0;
    node.fy = 0;
  });

  // Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];

      const dx = node2.x - node1.x;
      const dy = node2.y - node1.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq + 0.01);

      if (dist <= maxRepulsionDistance) {
        let forceMagnitude = PHYSICS_CONFIG.repulsionFactor *
          Math.exp(-dist / PHYSICS_CONFIG.lengthScale) *
          (PHYSICS_CONFIG.lengthScale + dist) / (distSq + 0.01);
        forceMagnitude = Math.min(forceMagnitude, PHYSICS_CONFIG.repulsionFactor);

        const fx = (dx / dist) * forceMagnitude;
        const fy = (dy / dist) * forceMagnitude;

        node1.fx -= fx;
        node1.fy -= fy;
        node2.fx += fx;
        node2.fy += fy;
      }
    }
  }

  // Attraction along edges
  edges.forEach(edge => {
    const node1 = getNodeById(edge.fromId);
    const node2 = getNodeById(edge.toId);

    if (!node1 || !node2) return;

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const dist = Math.sqrt(dx * dx + dy * dy + 0.01);

    const forceMagnitude = 1.5 * PHYSICS_CONFIG.attractionFactor *
      Math.sqrt(dist) / Math.pow(PHYSICS_CONFIG.lengthScale, 1.5);

    const fx = (dx / dist) * forceMagnitude;
    const fy = (dy / dist) * forceMagnitude;

    node1.fx += fx;
    node1.fy += fy;
    node2.fx -= fx;
    node2.fy -= fy;
  });

  // Update positions
  nodes.forEach(node => {
    // Skip dragged node
    if (node === draggingNode) {
      node.vx = 0;
      node.vy = 0;
      return;
    }

    // Update velocity
    node.vx = (node.vx + node.fx) * (1 - PHYSICS_CONFIG.damping);
    node.vy = (node.vy + node.fy) * (1 - PHYSICS_CONFIG.damping);

    // Clamp velocity
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > PHYSICS_CONFIG.maxVelocity) {
      node.vx = (node.vx / speed) * PHYSICS_CONFIG.maxVelocity;
      node.vy = (node.vy / speed) * PHYSICS_CONFIG.maxVelocity;
    }

    // Update position
    node.x += node.vx * dt;
    node.y += node.vy * dt;
  });
}

// Run physics simulation
function runPhysics() {
  for (let i = 0; i < PHYSICS_CONFIG.stepsPerFrame; i++) {
    updatePhysics();
  }
}
