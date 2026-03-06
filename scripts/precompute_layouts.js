#!/usr/bin/env node

/**
 * Precompute puzzle layouts by running physics simulation headlessly
 * Run with: node scripts/precompute_layouts.js
 */

const fs = require('fs');
const path = require('path');

// Import physics utilities (we'll need to make these work in Node)
// For now, inline the minimal required code

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

// Parse puzzle data file
function parsePuzzleData(text) {
  const lines = text.trim().split('\n');
  const edges = [];
  const nodes = new Set();
  let givenWords = [];
  let randomSeed = 42;
  let puzzleName = '';

  lines.forEach(line => {
    const trimmed = line.trim();

    if (trimmed.startsWith('given:')) {
      const givenRaw = trimmed.substring(6).trim();
      if (givenRaw.startsWith('[')) {
        givenWords = []; // Handle [leaves], [all], etc. specially later
      } else {
        givenWords = givenRaw.split(',').map(w => w.trim()).filter(w => w);
      }
      return;
    }

    if (trimmed.startsWith('random seed:')) {
      randomSeed = parseInt(trimmed.substring(12).trim(), 10);
      return;
    }

    if (trimmed.startsWith('name:')) {
      puzzleName = trimmed.substring(5).trim();
      return;
    }

    if (trimmed === '' || trimmed.startsWith('gimmick:')) return;

    // Parse edges
    let word1, word2, direction;
    if (trimmed.includes('~')) {
      const parts = trimmed.split('~');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'anagram';
    } else if (trimmed.includes('<->')) {
      const parts = trimmed.split('<->');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'bidirectional';
    } else if (trimmed.includes('->')) {
      const parts = trimmed.split('->');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'forward';
    } else if (trimmed.includes('<-')) {
      const parts = trimmed.split('<-');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'backward';
    } else {
      return; // Skip invalid lines
    }

    if (word1 && word2) {
      nodes.add(word1);
      nodes.add(word2);
      edges.push({ from: word1, to: word2, direction });
    }
  });

  return {
    nodes: Array.from(nodes),
    edges,
    givenWords,
    randomSeed,
    puzzleName
  };
}

// Minimal physics simulation (Phases 1-3 only)
function runPhysicsSimulation(puzzleData) {
  const { nodes, edges, randomSeed } = puzzleData;
  const seededRandom = createSeededRandom(randomSeed);

  // Canvas dimensions
  const width = 1200;
  const height = 800;
  const margin = 50;

  // Calculate scale factor
  const numWords = nodes.length;
  let scaleFactor = 1.4;
  if (numWords > 20) {
    scaleFactor = 1.4 * Math.sqrt(20 / numWords);
  }

  // Physics parameters
  const REPULSION_FACTOR = 0.1;
  const ATTRACTION_FACTOR = 0.5;
  const LENGTH_SCALE = 80 * scaleFactor;
  const MAX_REPULSION_DISTANCE = 3 * LENGTH_SCALE;
  const DT = 10;
  const DAMPING = 0.03;
  const MAX_VELOCITY = 100;

  const PHASE_1_STEPS = 2500;
  const PHASE_2_STEPS = 5000;
  const PHASE_3_STEPS = 10000;

  // Initialize positions
  const nodePositions = {};
  let maxInitialZ = 0;

  nodes.forEach(node => {
    const z = (seededRandom() - 0.5) * 2 * LENGTH_SCALE;
    nodePositions[node] = {
      x: margin + seededRandom() * (width - 2 * margin),
      y: margin + seededRandom() * (height - 2 * margin),
      z: z,
      vx: 0,
      vy: 0,
      vz: 0,
      fx: 0,
      fy: 0,
      fz: 0
    };
    maxInitialZ = Math.max(maxInitialZ, Math.abs(z));
  });

  // Box dimensions (simplified - assume uniform for precompute)
  const BOX_HEIGHT = 36 * scaleFactor;
  const UNIFORM_BOX_HEIGHT = BOX_HEIGHT;
  const UNIFORM_BOX_WIDTH = UNIFORM_BOX_HEIGHT * 2.5;

  function getBoxDimensions() {
    return { width: UNIFORM_BOX_WIDTH, height: UNIFORM_BOX_HEIGHT };
  }

  // 3D rectangle distance
  function rectToRectDistance3D(x1, y1, z1, w1, h1, x2, y2, z2, w2, h2) {
    const hw1 = w1 / 2;
    const hh1 = h1 / 2;
    const hw2 = w2 / 2;
    const hh2 = h2 / 2;

    const dx2D = Math.max(0, Math.abs(x2 - x1) - (hw1 + hw2));
    const dy2D = Math.max(0, Math.abs(y2 - y1) - (hh1 + hh2));
    const dist2D = Math.sqrt(dx2D * dx2D + dy2D * dy2D);

    const dz = z2 - z1;
    return Math.sqrt(dist2D * dist2D + dz * dz);
  }

  // Run physics steps
  for (let step = 0; step < PHASE_3_STEPS; step++) {
    const inPhase1 = step < PHASE_1_STEPS;
    const inPhase2 = step >= PHASE_1_STEPS && step < PHASE_2_STEPS;
    const inPhase3 = step >= PHASE_2_STEPS && step < PHASE_3_STEPS;

    // Reset forces
    nodes.forEach(node => {
      const pos = nodePositions[node];
      pos.fx = 0;
      pos.fy = 0;
      pos.fz = 0;
    });

    // Repulsion
    const box = getBoxDimensions();
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pos1 = nodePositions[nodes[i]];
        const pos2 = nodePositions[nodes[j]];

        const z1 = (inPhase3) ? 0 : pos1.z;
        const z2 = (inPhase3) ? 0 : pos2.z;

        const edgeDist = rectToRectDistance3D(
          pos1.x, pos1.y, z1, box.width, box.height,
          pos2.x, pos2.y, z2, box.width, box.height
        );

        if (edgeDist <= MAX_REPULSION_DISTANCE) {
          let forceMagnitude = REPULSION_FACTOR * Math.exp(-edgeDist / LENGTH_SCALE) *
                              (LENGTH_SCALE + edgeDist) / ((edgeDist + 0.01) * (edgeDist + 0.01));
          forceMagnitude = Math.min(forceMagnitude, REPULSION_FACTOR);

          const dx1 = pos1.x - pos2.x;
          const dy1 = pos1.y - pos2.y;
          const dz1 = z1 - z2;
          const dx2 = -dx1;
          const dy2 = -dy1;
          const dz2 = -dz1;

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

    // Attraction
    edges.forEach(edge => {
      const pos1 = nodePositions[edge.from];
      const pos2 = nodePositions[edge.to];

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dz = (inPhase3) ? 0 : (pos2.z - pos1.z);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz + 0.01);

      const forceMagnitude = 1.5 * ATTRACTION_FACTOR * Math.sqrt(dist) / Math.pow(LENGTH_SCALE, 1.5);
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

    // Centering force
    const centerX = width / 2;
    const centerY = height / 2;
    const centeringStrength = 0.000005;

    let comX = 0, comY = 0;
    nodes.forEach(node => {
      comX += nodePositions[node].x;
      comY += nodePositions[node].y;
    });
    comX /= nodes.length;
    comY /= nodes.length;

    const shiftX = (centerX - comX) * centeringStrength;
    const shiftY = (centerY - comY) * centeringStrength;

    nodes.forEach(node => {
      const pos = nodePositions[node];
      pos.fx += shiftX;
      pos.fy += shiftY;
    });

    // Update positions
    nodes.forEach(node => {
      const pos = nodePositions[node];

      if (inPhase3) {
        // Phase 3: 2D with annealing
        pos.z = 0;
        pos.vz = 0;
        pos.vx = (pos.vx + pos.fx) * (1 - DAMPING);
        pos.vy = (pos.vy + pos.fy) * (1 - DAMPING);

        // Annealing perturbation
        const danceStddev = 0.5 / 30;
        const aDance = danceStddev * Math.sqrt(3);
        pos.vx += (seededRandom() * 2 * aDance) - aDance;
        pos.vy += (seededRandom() * 2 * aDance) - aDance;

        const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy);
        if (speed > MAX_VELOCITY) {
          pos.vx = (pos.vx / speed) * MAX_VELOCITY;
          pos.vy = (pos.vy / speed) * MAX_VELOCITY;
        }

        pos.x += pos.vx * DT;
        pos.y += pos.vy * DT;
      } else {
        // Phases 1 & 2: 3D
        pos.vx = (pos.vx + pos.fx) * (1 - DAMPING);
        pos.vy = (pos.vy + pos.fy) * (1 - DAMPING);
        pos.vz = (pos.vz + pos.fz) * (1 - DAMPING);

        const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy + pos.vz * pos.vz);
        if (speed > MAX_VELOCITY) {
          pos.vx = (pos.vx / speed) * MAX_VELOCITY;
          pos.vy = (pos.vy / speed) * MAX_VELOCITY;
          pos.vz = (pos.vz / speed) * MAX_VELOCITY;
        }

        pos.x += pos.vx * DT;
        pos.y += pos.vy * DT;
        pos.z += pos.vz * DT;

        // Phase 2: squeeze
        if (inPhase2) {
          const progress = (step - PHASE_1_STEPS) / (PHASE_2_STEPS - PHASE_1_STEPS);
          const maxZ = maxInitialZ * (1 - progress);
          pos.z = Math.max(-maxZ, Math.min(maxZ, pos.z));
          if (Math.abs(pos.z) >= maxZ - 0.01) {
            pos.vz = 0;
          }
        }
      }

      // Bounds
      pos.x = Math.max(margin, Math.min(width - margin, pos.x));
      pos.y = Math.max(margin, Math.min(height - margin, pos.y));
    });
  }

  // Extract final positions (x, y only)
  const finalPositions = {};
  nodes.forEach(node => {
    finalPositions[node] = {
      x: nodePositions[node].x,
      y: nodePositions[node].y
    };
  });

  return finalPositions;
}

// Main script
function main() {
  console.log('🔧 Precomputing puzzle layouts...\n');

  const puzzlesDir = path.join(__dirname, '..', '_puzzles');
  const outputFile = path.join(__dirname, '..', 'assets', 'data', 'puzzle_layouts.json');

  // Read all puzzle files
  const files = fs.readdirSync(puzzlesDir).filter(f => f.endsWith('.txt'));

  const layouts = {};

  files.forEach(file => {
    const filePath = path.join(puzzlesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    console.log(`📊 Processing ${file}...`);

    const puzzleData = parsePuzzleData(content);

    if (puzzleData.nodes.length === 0) {
      console.log(`   ⚠️  Skipped (no nodes found)\n`);
      return;
    }

    console.log(`   Nodes: ${puzzleData.nodes.length}, Seed: ${puzzleData.randomSeed}`);
    console.log(`   Running physics simulation (10,000 steps)...`);

    const startTime = Date.now();
    const positions = runPhysicsSimulation(puzzleData);
    const elapsed = Date.now() - startTime;

    console.log(`   ✅ Completed in ${elapsed}ms\n`);

    layouts[puzzleData.puzzleName] = {
      randomSeed: puzzleData.randomSeed,
      nodes: puzzleData.nodes,
      positions: positions
    };
  });

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(outputFile, JSON.stringify(layouts, null, 2));

  console.log(`\n✨ Done! Wrote ${Object.keys(layouts).length} puzzle layouts to:`);
  console.log(`   ${outputFile}`);
}

main();
