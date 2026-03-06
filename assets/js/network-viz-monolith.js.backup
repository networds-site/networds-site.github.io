/**
 * Network Visualization Component
 * Modular force-directed graph renderer for String Theory puzzles
 */

class NetworkViz {
  constructor(config) {
    // Required config
    this.canvas = config.canvas;
    this.nodes = config.nodes || []; // Array of node names
    this.edges = config.edges || []; // Array of {from, to, direction}

    // Optional config
    this.mode = config.mode || 'game'; // 'game' or 'display'
    this.randomSeed = config.randomSeed || 42;
    this.givenWords = new Set(config.givenWords || []);
    this.bounds = config.bounds || null; // {x, y, width, height} to constrain movement
    this.showBounds = config.showBounds || false; // Draw bounding box for debugging
    this.scaleFactor = config.scaleFactor || 1.0;
    this.fontSize = config.fontSize || null; // Auto-calculate if not provided
    this.onGuess = config.onGuess || null; // Callback for when word is guessed
    this.gimmick = config.gimmick || '';
    this.puzzleName = config.puzzleName || 'Puzzle';
    this.storageKey = config.storageKey || null; // For saving progress
    this.victoryText = config.victoryText || 'Chopin - Nocturne in E Flat Major'; // Default

    // Physics config (can be overridden)
    this.physicsConfig = {
      repulsionFactor: config.repulsionFactor || 0.1,
      attractionFactor: config.attractionFactor || 0.5,
      lengthScale: config.lengthScale || (80 * this.scaleFactor),
      damping: config.damping || 0.05,
      maxVelocity: config.maxVelocity || 100,
      physicsStepsPerFrame: config.physicsStepsPerFrame || (this.mode === 'display' ? 20 : 100),
      targetFPS: config.targetFPS || 50,
      ...config.physicsConfig
    };

    // Display mode specific config
    this.displayConfig = {
      enablePhysics: config.enablePhysics !== false,
      enableDancing: config.enableDancing !== false,
      danceIntensity: config.danceIntensity || 0.01,
      showLabelsAlways: config.showLabelsAlways || false,
      boxStyle: config.boxStyle || 'auto', // 'auto', 'uniform', 'fitted'
      ...config.displayConfig
    };

    // Internal state
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.nodePositions = {};
    this.guessedWords = new Set(this.givenWords);
    this.physicsStepCount = 0;
    this.currentIteration = 0;
    this.lastFrameTime = null;
    this.lastRenderTime = null;
    this.draggedNode = null;
    this.dragOffset = { x: 0, y: 0 }; // Current offset (decays over time)
    this.initialDragOffset = { x: 0, y: 0 }; // Initial click offset
    this.dragStartTime = 0; // Timestamp when drag started
    this.lastMousePos = { x: 0, y: 0 }; // Last known mouse position
    this.animationFrameId = null;

    // Initialize
    this.seededRandom = this.createSeededRandom(this.randomSeed);
    this.normalRandom = this.createNormalRandom(this.seededRandom);
    this.initializeNodes();
    this.setupEventListeners();

    // Audio context (shared)
    if (!NetworkViz.audioContext) {
      NetworkViz.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Game mode state
    if (this.mode === 'game') {
      this.wasAlreadyComplete = this.guessedWords.size === this.nodes.length;
      this.NEUTRAL_PITCH = 155.56; // Eb3
    }
  }

  // ========== Sound System (Game Mode) ==========

  getWordPitch(word) {
    const hash = this.hashString(word);
    const index = hash % 11;
    const pentatonicIntervals = [0, 2, 4, 7, 9];

    if (index < 5) {
      return this.NEUTRAL_PITCH * Math.pow(2, pentatonicIntervals[index] / 12);
    } else if (index < 10) {
      return this.NEUTRAL_PITCH * 2 * Math.pow(2, pentatonicIntervals[index - 5] / 12);
    } else {
      return this.NEUTRAL_PITCH * 4;
    }
  }

  playSound(word, type = 'neutral', volume = 0.2) {
    if (!NetworkViz.audioContext) return;

    const oscillator = NetworkViz.audioContext.createOscillator();
    const gainNode = NetworkViz.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(NetworkViz.audioContext.destination);

    const startTime = NetworkViz.audioContext.currentTime;

    if (type === 'neutral') {
      oscillator.frequency.value = this.NEUTRAL_PITCH;
      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.15);
    } else if (type === 'positive') {
      oscillator.frequency.value = this.getWordPitch(word);
      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.4);
    } else if (type === 'negative') {
      const startFreq = this.NEUTRAL_PITCH * Math.pow(2, 1/12);
      const endFreq = this.NEUTRAL_PITCH;
      oscillator.frequency.setValueAtTime(startFreq, startTime);
      oscillator.frequency.setValueAtTime(endFreq, startTime + 0.25);
      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.5);
    }
  }

  startRipple(startNode) {
    const JUMP_TIME = 0.2;
    const visited = new Set();
    visited.add(startNode);

    const neighbors = Array.from(this.adjacencyList[startNode] || []);
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        const delay = (JUMP_TIME / 2 + Math.random() * (JUMP_TIME / 2)) * 1000;
        setTimeout(() => {
          this.rippleToNode(neighbor, visited);
        }, delay);
      }
    });
  }

  rippleToNode(node, visited) {
    if (visited.has(node)) return;
    visited.add(node);

    const pos = this.nodePositions[node];
    const perturbationStddev = 0.5 * 0.25;
    const a = perturbationStddev * this.scaleFactor * Math.sqrt(3);
    pos.vx += (this.seededRandom() * 2 * a) - a;
    pos.vy += (this.seededRandom() * 2 * a) - a;

    if (this.guessedWords.has(node) && !this.givenWords.has(node)) {
      this.playSound(node, 'positive', 0.05);
    }

    const neighbors = Array.from(this.adjacencyList[node] || []);
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        const JUMP_TIME = 0.2;
        const delay = (JUMP_TIME / 2 + Math.random() * (JUMP_TIME / 2)) * 1000;
        setTimeout(() => {
          this.rippleToNode(neighbor, visited);
        }, delay);
      }
    });
  }

  // ========== Guess Handling (Game Mode) ==========

  handleGuess(guess) {
    if (!guess || this.mode !== 'game') return null;

    guess = guess.trim().toLowerCase();
    let found = false;
    let foundNode = null;
    let alreadyRevealed = false;

    this.nodes.forEach(node => {
      if (node.toLowerCase() === guess) {
        foundNode = node;
        if (!this.guessedWords.has(node)) {
          this.guessedWords.add(node);
          found = true;
        } else {
          alreadyRevealed = true;
        }
      }
    });

    // Save progress
    if (found && this.storageKey) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.guessedWords)));
      } catch (e) {
        console.error('Error saving progress:', e);
      }
    }

    // Apply velocity perturbation
    if (foundNode) {
      const pos = this.nodePositions[foundNode];
      const perturbationStddev = alreadyRevealed ? 0.25 : 0.75;
      const a = perturbationStddev * this.scaleFactor * Math.sqrt(3);
      pos.vx += (this.seededRandom() * 2 * a) - a;
      pos.vy += (this.seededRandom() * 2 * a) - a;

      // Play sound
      if (alreadyRevealed) {
        if (this.givenWords.has(foundNode)) {
          this.playSound(foundNode, 'neutral');
        } else {
          this.playSound(foundNode, 'positive');
        }
      } else {
        this.playSound(foundNode, 'positive');
        this.startRipple(foundNode);
      }

      // Check victory
      if (found && this.guessedWords.size === this.nodes.length) {
        this.playVictoryMusic();
      }
    } else {
      this.playSound('', 'negative');
    }

    return { found, alreadyRevealed, node: foundNode };
  }

  playVictoryMusic() {
    // This will be overridden by the HTML page to provide the audio file path
  }

  resetProgress() {
    if (this.storageKey) {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (e) {
        console.error('Error resetting progress:', e);
      }
    }
  }

  // ========== Utility Functions ==========

  createSeededRandom(seed) {
    return function() {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  createNormalRandom(randomFunc) {
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

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  hsvToRgb(h, s, v) {
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

  // ========== Node Initialization ==========

  initializeNodes() {
    // Build adjacency list
    this.adjacencyList = {};
    this.nodes.forEach(node => {
      this.adjacencyList[node] = new Set();
    });
    this.edges.forEach(edge => {
      this.adjacencyList[edge.from].add(edge.to);
      this.adjacencyList[edge.to].add(edge.from);
    });

    // Calculate node dimensions
    if (!this.fontSize) {
      const numWords = this.nodes.length;
      let scale = this.scaleFactor;
      if (numWords > 20) {
        scale = this.scaleFactor * Math.sqrt(20 / numWords);
      }
      this.fontSize = Math.round(24 * scale);
    }

    this.ctx.font = `${this.fontSize}px "Gill Sans", sans-serif`;
    this.nodeTextWidths = {};
    let maxTextWidth = 0;
    this.nodes.forEach(node => {
      const textWidth = this.ctx.measureText(node).width;
      this.nodeTextWidths[node] = textWidth;
      if (textWidth > maxTextWidth) maxTextWidth = textWidth;
    });

    this.boxHeight = 36 * this.scaleFactor;
    this.boxPadding = 16 * this.scaleFactor;
    this.uniformBoxHeight = this.boxHeight;
    this.uniformBoxWidth = this.uniformBoxHeight * 2.5;

    // Initialize positions
    const margin = 50;
    const lengthScale = this.physicsConfig.lengthScale;
    this.maxInitialZ = 0;

    this.nodes.forEach(node => {
      const z = (this.seededRandom() - 0.5) * 2 * lengthScale;
      this.nodePositions[node] = {
        x: margin + this.seededRandom() * (this.width - 2 * margin),
        y: margin + this.seededRandom() * (this.height - 2 * margin),
        z: z,
        vx: 0,
        vy: 0,
        vz: 0,
        fx: 0,
        fy: 0,
        fz: 0
      };
      this.maxInitialZ = Math.max(this.maxInitialZ, Math.abs(z));
    });
  }

  // ========== Box Dimensions ==========

  getBoxDimensions(node) {
    if (this.displayConfig.boxStyle === 'fitted') {
      return {
        width: this.nodeTextWidths[node] + this.boxPadding,
        height: this.boxHeight
      };
    } else if (this.displayConfig.boxStyle === 'uniform') {
      return {
        width: this.uniformBoxWidth,
        height: this.uniformBoxHeight
      };
    } else {
      // Auto: fitted if guessed, uniform otherwise
      if (this.guessedWords.has(node) || this.displayConfig.showLabelsAlways) {
        return {
          width: this.nodeTextWidths[node] + this.boxPadding,
          height: this.boxHeight
        };
      } else {
        return {
          width: this.uniformBoxWidth,
          height: this.uniformBoxHeight
        };
      }
    }
  }

  getNodeColor(node) {
    if (this.guessedWords.has(node) && !this.givenWords.has(node)) {
      const hash = this.hashString(node);
      const hue = (hash % 360) / 360;
      const rgb = this.hsvToRgb(hue, 0.3, 1.0);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    return '#ffffff';
  }

  // ========== Physics & Geometry ==========

  // Get nearest point on rectangle boundary to a target point
  // If target is inside rectangle, return center instead
  getNearestBoundaryPoint(rectX, rectY, rectWidth, rectHeight, targetX, targetY) {
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

  rectToRectDistance3D(x1, y1, z1, w1, h1, x2, y2, z2, w2, h2) {
    const hw1 = w1 / 2, hh1 = h1 / 2;
    const hw2 = w2 / 2, hh2 = h2 / 2;

    const dx2D = Math.max(0, Math.abs(x2 - x1) - (hw1 + hw2));
    const dy2D = Math.max(0, Math.abs(y2 - y1) - (hh1 + hh2));
    const dist2D = Math.sqrt(dx2D * dx2D + dy2D * dy2D);
    const dz = z2 - z1;

    return Math.sqrt(dist2D * dist2D + dz * dz);
  }

  lineRectIntersection(fromX, fromY, toX, toY, rectCenterX, rectCenterY, rectWidth, rectHeight) {
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

  // ========== Physics Update ==========

  updatePhysics() {
    const {
      repulsionFactor,
      attractionFactor,
      lengthScale,
      damping,
      maxVelocity
    } = this.physicsConfig;

    const maxRepulsionDistance = 3 * lengthScale;
    const dt = 10;

    // Display mode: simplified physics with boundary constraints
    if (this.mode === 'display') {
      // Reset forces
      this.nodes.forEach(node => {
        const pos = this.nodePositions[node];
        pos.fx = 0;
        pos.fy = 0;
        pos.fz = 0;
      });

      // Repulsion (2D only for display mode)
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const node1 = this.nodes[i];
          const node2 = this.nodes[j];
          const pos1 = this.nodePositions[node1];
          const pos2 = this.nodePositions[node2];

          const box1 = this.getBoxDimensions(node1);
          const box2 = this.getBoxDimensions(node2);

          const edgeDist = this.rectToRectDistance3D(
            pos1.x, pos1.y, 0, box1.width, box1.height,
            pos2.x, pos2.y, 0, box2.width, box2.height
          );

          if (edgeDist <= maxRepulsionDistance) {
            let forceMagnitude = repulsionFactor * Math.exp(-edgeDist / lengthScale) *
                                (lengthScale + edgeDist) / ((edgeDist + 0.01) * (edgeDist + 0.01));
            forceMagnitude = Math.min(forceMagnitude, repulsionFactor);

            // Force on node1: from nearest point on node2's boundary to node1's center
            const nearestPoint2 = this.getNearestBoundaryPoint(pos2.x, pos2.y, box2.width, box2.height, pos1.x, pos1.y);
            const dx1 = pos1.x - nearestPoint2.x;
            const dy1 = pos1.y - nearestPoint2.y;
            const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + 0.01);

            const fx1 = (dx1 / dist1) * forceMagnitude;
            const fy1 = (dy1 / dist1) * forceMagnitude;

            // Force on node2: from nearest point on node1's boundary to node2's center
            const nearestPoint1 = this.getNearestBoundaryPoint(pos1.x, pos1.y, box1.width, box1.height, pos2.x, pos2.y);
            const dx2 = pos2.x - nearestPoint1.x;
            const dy2 = pos2.y - nearestPoint1.y;
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
      this.edges.forEach(edge => {
        const pos1 = this.nodePositions[edge.from];
        const pos2 = this.nodePositions[edge.to];

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
      if (this.bounds) {
        const centerX = this.bounds.x + this.bounds.width / 2;
        const centerY = this.bounds.y + this.bounds.height / 2;
        const centeringStrength = 0.00001; // Very very weak force

        this.nodes.forEach(node => {
          const pos = this.nodePositions[node];
          const dx = centerX - pos.x;
          const dy = centerY - pos.y;

          pos.fx += dx * centeringStrength;
          pos.fy += dy * centeringStrength;
        });
      }

      // Update positions
      this.nodes.forEach(node => {
        const pos = this.nodePositions[node];
        pos.z = 0;
        pos.vz = 0;

        // Skip physics update for dragged node (position is controlled by mouse)
        if (node === this.draggedNode) {
          pos.vx = 0;
          pos.vy = 0;
          return;
        }

        pos.vx = (pos.vx + pos.fx) * (1 - damping);
        pos.vy = (pos.vy + pos.fy) * (1 - damping);

        // Gentle dancing for display mode
        if (this.displayConfig.enableDancing) {
          const intensity = this.displayConfig.danceIntensity;
          pos.vx += (this.seededRandom() * 2 - 1) * intensity;
          pos.vy += (this.seededRandom() * 2 - 1) * intensity;
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
        if (this.bounds) {
          const box = this.getBoxDimensions(node);
          const halfWidth = box.width / 2;
          const halfHeight = box.height / 2;

          const minX = this.bounds.x + halfWidth;
          const maxX = this.bounds.x + this.bounds.width - halfWidth;
          const minY = this.bounds.y + halfHeight;
          const maxY = this.bounds.y + this.bounds.height - halfHeight;

          pos.x = Math.max(minX, Math.min(maxX, pos.x));
          pos.y = Math.max(minY, Math.min(maxY, pos.y));

          // Zero velocity if hitting boundary
          if (pos.x <= minX || pos.x >= maxX) pos.vx = 0;
          if (pos.y <= minY || pos.y >= maxY) pos.vy = 0;
        }
      });

      // Don't auto-center in display mode - let them move freely within bounds
    } else {
      // Game mode: Full 3D physics with 4 phases
      this.updateGamePhysics();
    }
  }

  updateGamePhysics() {
    const {
      repulsionFactor,
      attractionFactor,
      lengthScale,
      damping,
      maxVelocity
    } = this.physicsConfig;

    const maxRepulsionDistance = 3 * lengthScale;
    const dt = 10;
    const perturbationStddev = 0.5;

    // Phase constants
    const PHASE_1_STEPS = 2500;
    const PHASE_2_STEPS = 5000;
    const PHASE_3_STEPS = 10000;

    const inPhase1 = this.physicsStepCount < PHASE_1_STEPS;
    const inPhase2 = this.physicsStepCount >= PHASE_1_STEPS && this.physicsStepCount < PHASE_2_STEPS;
    const inPhase3 = this.physicsStepCount >= PHASE_2_STEPS && this.physicsStepCount < PHASE_3_STEPS;
    const inPhase4 = this.physicsStepCount >= PHASE_3_STEPS;

    // Reset forces
    this.nodes.forEach(node => {
      const pos = this.nodePositions[node];
      pos.fx = 0;
      pos.fy = 0;
      pos.fz = 0;
    });

    // Repulsion between all nodes (3D for phases 1-2, 2D for phases 3-4)
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const node1 = this.nodes[i];
        const node2 = this.nodes[j];
        const pos1 = this.nodePositions[node1];
        const pos2 = this.nodePositions[node2];

        const box1 = this.getBoxDimensions(node1);
        const box2 = this.getBoxDimensions(node2);

        const z1 = (inPhase3 || inPhase4) ? 0 : pos1.z;
        const z2 = (inPhase3 || inPhase4) ? 0 : pos2.z;

        const edgeDist = this.rectToRectDistance3D(
          pos1.x, pos1.y, z1, box1.width, box1.height,
          pos2.x, pos2.y, z2, box2.width, box2.height
        );

        if (edgeDist <= maxRepulsionDistance) {
          let forceMagnitude = repulsionFactor * Math.exp(-edgeDist / lengthScale) *
                              (lengthScale + edgeDist) / ((edgeDist + 0.01) * (edgeDist + 0.01));
          forceMagnitude = Math.min(forceMagnitude, repulsionFactor);

          // Force on node1: from nearest point on node2's boundary to node1's center
          const nearestPoint2 = this.getNearestBoundaryPoint(pos2.x, pos2.y, box2.width, box2.height, pos1.x, pos1.y);
          const dx1 = pos1.x - nearestPoint2.x;
          const dy1 = pos1.y - nearestPoint2.y;
          const dz1 = z1 - z2;
          const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1 + 0.01);

          pos1.fx += (dx1 / dist1) * forceMagnitude;
          pos1.fy += (dy1 / dist1) * forceMagnitude;
          if (inPhase1 || inPhase2) {
            pos1.fz += (dz1 / dist1) * forceMagnitude;
          }

          // Force on node2: from nearest point on node1's boundary to node2's center
          const nearestPoint1 = this.getNearestBoundaryPoint(pos1.x, pos1.y, box1.width, box1.height, pos2.x, pos2.y);
          const dx2 = pos2.x - nearestPoint1.x;
          const dy2 = pos2.y - nearestPoint1.y;
          const dz2 = z2 - z1;
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
    this.edges.forEach(edge => {
      const pos1 = this.nodePositions[edge.from];
      const pos2 = this.nodePositions[edge.to];

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

    // Update positions
    this.nodes.forEach(node => {
      const pos = this.nodePositions[node];

      // Skip position update for dragged node (only in phase 4)
      if (node === this.draggedNode && inPhase4) {
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
          pos.vx += (this.seededRandom() * 2 * aDance) - aDance;
          pos.vy += (this.seededRandom() * 2 * aDance) - aDance;
        } else if (inPhase4) {
          // Phase 4: Steady state - only dance if puzzle is complete
          if (this.guessedWords.size === this.nodes.length) {
            const danceStddev = perturbationStddev / 300;
            const aDance = danceStddev * Math.sqrt(3);
            pos.vx += (this.seededRandom() * 2 * aDance) - aDance;
            pos.vy += (this.seededRandom() * 2 * aDance) - aDance;
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
          const progress = (this.physicsStepCount - PHASE_1_STEPS) / (PHASE_2_STEPS - PHASE_1_STEPS);
          const maxZ = this.maxInitialZ * (1 - progress);

          pos.z = Math.max(-maxZ, Math.min(maxZ, pos.z));

          if (Math.abs(pos.z) >= maxZ - 0.01) {
            pos.vz = 0;
          }
        }
      }

      // Keep within canvas bounds
      const margin = 50;
      pos.x = Math.max(margin, Math.min(this.width - margin, pos.x));
      pos.y = Math.max(margin, Math.min(this.height - margin, pos.y));
    });

    // Center correction
    let avgX = 0, avgY = 0;
    this.nodes.forEach(node => {
      avgX += this.nodePositions[node].x;
      avgY += this.nodePositions[node].y;
    });
    avgX /= this.nodes.length;
    avgY /= this.nodes.length;

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const shiftX = centerX - avgX;
    const shiftY = centerY - avgY;

    this.nodes.forEach(node => {
      this.nodePositions[node].x += shiftX;
      this.nodePositions[node].y += shiftY;
    });
  }

  centerGraph() {
    let avgX = 0, avgY = 0;
    this.nodes.forEach(node => {
      avgX += this.nodePositions[node].x;
      avgY += this.nodePositions[node].y;
    });
    avgX /= this.nodes.length;
    avgY /= this.nodes.length;

    const targetX = this.bounds ? (this.bounds.x + this.bounds.width / 2) : (this.width / 2);
    const targetY = this.bounds ? (this.bounds.y + this.bounds.height / 2) : (this.height / 2);

    const shiftX = targetX - avgX;
    const shiftY = targetY - avgY;

    this.nodes.forEach(node => {
      this.nodePositions[node].x += shiftX;
      this.nodePositions[node].y += shiftY;
    });
  }

  // ========== Rendering ==========

  drawEdge(edge) {
    const from = this.nodePositions[edge.from];
    const to = this.nodePositions[edge.to];
    const fromBox = this.getBoxDimensions(edge.from);
    const toBox = this.getBoxDimensions(edge.to);

    // Check visibility for invisible_connections gimmick
    if (this.gimmick === 'invisible_connections') {
      if (!this.guessedWords.has(edge.from) || !this.guessedWords.has(edge.to)) {
        return;
      }
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (edge.direction === 'anagram') {
      this.drawWaveEdge(from, to, fromBox, toBox, dx, dy, distance, '#ff0000', 'sine');
    } else if (edge.direction === 'triangle') {
      this.drawWaveEdge(from, to, fromBox, toBox, dx, dy, distance, '#0000ff', 'triangle');
    } else {
      this.drawStraightEdge(from, to, fromBox, toBox);
    }
  }

  drawStraightEdge(from, to, fromBox, toBox) {
    const fromIntersect = this.lineRectIntersection(from.x, from.y, to.x, to.y, from.x, from.y, fromBox.width, fromBox.height);
    const toIntersect = this.lineRectIntersection(from.x, from.y, to.x, to.y, to.x, to.y, toBox.width, toBox.height);

    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(fromIntersect.x, fromIntersect.y);
    this.ctx.lineTo(toIntersect.x, toIntersect.y);
    this.ctx.stroke();
  }

  drawWaveEdge(from, to, fromBox, toBox, dx, dy, distance, color, waveType) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;

    const lengthScale = this.physicsConfig.lengthScale;
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

    this.ctx.beginPath();
    for (let i = startIdx; i <= endIdx; i++) {
      if (i === startIdx) {
        this.ctx.moveTo(points[i].x, points[i].y);
      } else {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
    }
    this.ctx.stroke();
  }

  drawEdgeCircles(edge) {
    if (edge.direction === 'anagram' || edge.direction === 'triangle') return;

    const from = this.nodePositions[edge.from];
    const to = this.nodePositions[edge.to];
    const fromBox = this.getBoxDimensions(edge.from);
    const toBox = this.getBoxDimensions(edge.to);

    this.ctx.fillStyle = '#000';

    if (edge.direction === 'forward' || edge.direction === 'bidirectional') {
      const toIntersect = this.lineRectIntersection(from.x, from.y, to.x, to.y, to.x, to.y, toBox.width, toBox.height);
      this.ctx.beginPath();
      this.ctx.arc(toIntersect.x, toIntersect.y, 5, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    if (edge.direction === 'backward' || edge.direction === 'bidirectional') {
      const fromIntersect = this.lineRectIntersection(to.x, to.y, from.x, from.y, from.x, from.y, fromBox.width, fromBox.height);
      this.ctx.beginPath();
      this.ctx.arc(fromIntersect.x, fromIntersect.y, 5, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw game mode UI elements
    if (this.mode === 'game') {
      const PHASE_1_STEPS = 2500;
      const PHASE_2_STEPS = 5000;
      const PHASE_3_STEPS = 10000;
      const inPhase4 = this.physicsStepCount >= PHASE_3_STEPS;

      // Draw "annealing..." text if not in steady state
      if (!inPhase4) {
        this.ctx.font = '20px "Gill Sans", sans-serif';
        this.ctx.fillStyle = '#888';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('annealing...', 10, 10);
      }
    }

    // Draw bounding box if enabled
    if (this.showBounds && this.bounds) {
      this.ctx.strokeStyle = '#ff0000';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
    }

    // Draw edges
    this.edges.forEach(edge => this.drawEdge(edge));

    // Draw nodes
    this.ctx.font = `${this.fontSize}px "Gill Sans", sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.nodes.forEach(node => {
      const pos = this.nodePositions[node];
      const box = this.getBoxDimensions(node);

      this.ctx.fillStyle = this.getNodeColor(node);
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(pos.x - box.width/2, pos.y - box.height/2, box.width, box.height);
      this.ctx.strokeRect(pos.x - box.width/2, pos.y - box.height/2, box.width, box.height);

      if (this.guessedWords.has(node) || this.displayConfig.showLabelsAlways) {
        this.ctx.fillStyle = '#000';
        this.ctx.fillText(node, pos.x, pos.y);
      }
    });

    // Draw edge direction circles
    this.edges.forEach(edge => this.drawEdgeCircles(edge));

    // Draw game mode bottom text
    if (this.mode === 'game') {
      const PHASE_3_STEPS = 10000;
      const inPhase4 = this.physicsStepCount >= PHASE_3_STEPS;

      // Draw drag instruction
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (!isMobile && inPhase4) {
        this.ctx.font = '18px "Gill Sans", sans-serif';
        this.ctx.fillStyle = '#999';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText('click and drag to adjust the graph', this.width - 10, this.height - 10);
      }

      // Draw song name when complete
      if (this.guessedWords.size === this.nodes.length) {
        this.ctx.font = '18px "Gill Sans", sans-serif';
        this.ctx.fillStyle = '#999';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(this.victoryText, 10, this.height - 10);
      }
    }
  }

  // ========== Animation Loop ==========

  animate() {
    const frameStart = performance.now();
    const frameInterval = 1000 / this.physicsConfig.targetFPS;

    if (this.lastRenderTime !== null && (frameStart - this.lastRenderTime) < frameInterval) {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
      return;
    }
    this.lastRenderTime = frameStart;

    // Update drag offset decay and position
    if (this.draggedNode) {
      const elapsed = (frameStart - this.dragStartTime) / 1000; // seconds
      const tau = 1.0; // time constant in seconds
      const factor = Math.exp(-elapsed / tau);

      this.dragOffset.x = this.initialDragOffset.x * factor;
      this.dragOffset.y = this.initialDragOffset.y * factor;

      // Update dragged node position continuously
      const pos = this.nodePositions[this.draggedNode];
      pos.x = this.lastMousePos.x - this.dragOffset.x;
      pos.y = this.lastMousePos.y - this.dragOffset.y;

      // Apply bounds if specified (hard boundary - consider box size)
      if (this.bounds) {
        const box = this.getBoxDimensions(this.draggedNode);
        const halfWidth = box.width / 2;
        const halfHeight = box.height / 2;

        const minX = this.bounds.x + halfWidth;
        const maxX = this.bounds.x + this.bounds.width - halfWidth;
        const minY = this.bounds.y + halfHeight;
        const maxY = this.bounds.y + this.bounds.height - halfHeight;

        pos.x = Math.max(minX, Math.min(maxX, pos.x));
        pos.y = Math.max(minY, Math.min(maxY, pos.y));
      }
    }

    // Run physics
    if (this.displayConfig.enablePhysics) {
      const steps = this.physicsConfig.physicsStepsPerFrame;
      for (let i = 0; i < steps; i++) {
        this.physicsStepCount++;
        this.updatePhysics();
      }
    }

    // Render
    this.render();

    this.currentIteration++;
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  start() {
    if (!this.animationFrameId) {
      this.animate();
    }
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // ========== Event Listeners ==========

  setupEventListeners() {
    // Setup mouse events for dragging (works in both game and display mode)
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());

    // Global listeners to track mouse outside canvas and catch releases
    document.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
    document.addEventListener('mouseup', () => this.handleMouseUp());
  }

  handleGlobalMouseMove(e) {
    // Only process if we're dragging
    if (!this.draggedNode) return;

    // Convert to canvas coordinates
    const rect = this.canvas.getBoundingClientRect();
    let mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    let mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    // Clamp to canvas bounds
    mouseX = Math.max(0, Math.min(this.width, mouseX));
    mouseY = Math.max(0, Math.min(this.height, mouseY));

    // Store clamped position
    this.lastMousePos.x = mouseX;
    this.lastMousePos.y = mouseY;
  }

  handleMouseDown(e) {
    // Game mode: only allow dragging in phase 4
    if (this.mode === 'game') {
      const PHASE_3_STEPS = 10000;
      if (this.physicsStepCount < PHASE_3_STEPS) return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    for (const node of this.nodes) {
      const pos = this.nodePositions[node];
      const box = this.getBoxDimensions(node);

      if (Math.abs(mouseX - pos.x) <= box.width / 2 &&
          Math.abs(mouseY - pos.y) <= box.height / 2) {
        this.draggedNode = node;
        this.canvas.style.cursor = 'grabbing';

        // Store the initial offset from box center to click point
        this.initialDragOffset.x = mouseX - pos.x;
        this.initialDragOffset.y = mouseY - pos.y;
        this.dragOffset.x = this.initialDragOffset.x;
        this.dragOffset.y = this.initialDragOffset.y;
        this.dragStartTime = performance.now();

        // Play sound on click (game mode)
        if (this.mode === 'game') {
          if (this.guessedWords.has(node) && !this.givenWords.has(node)) {
            this.playSound(node, 'positive');
          } else {
            this.playSound(node, 'neutral');
          }
        }

        break;
      }
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    let mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    let mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    // Clamp mouse position to canvas bounds
    mouseX = Math.max(0, Math.min(this.width, mouseX));
    mouseY = Math.max(0, Math.min(this.height, mouseY));

    // Store last mouse position
    this.lastMousePos.x = mouseX;
    this.lastMousePos.y = mouseY;

    if (this.draggedNode) {
      // Position update happens in animation loop
    } else {
      let hovering = false;
      for (const node of this.nodes) {
        const pos = this.nodePositions[node];
        const box = this.getBoxDimensions(node);

        if (Math.abs(mouseX - pos.x) <= box.width / 2 &&
            Math.abs(mouseY - pos.y) <= box.height / 2) {
          hovering = true;
          break;
        }
      }
      // Game mode: only show grab cursor in phase 4
      if (this.mode === 'game') {
        const PHASE_3_STEPS = 10000;
        if (this.physicsStepCount < PHASE_3_STEPS) {
          this.canvas.style.cursor = 'default';
          return;
        }
      }

      this.canvas.style.cursor = hovering ? 'grab' : 'default';
    }
  }

  handleMouseUp() {
    if (this.draggedNode) {
      this.draggedNode = null;
      this.canvas.style.cursor = 'default';
    }
  }

  handleMouseLeave() {
    // Don't release drag when mouse leaves - let user keep dragging
    // Only release on actual mouseup
  }
}

// Shared audio context
NetworkViz.audioContext = null;
