/**
 * Network Visualization Core
 * Orchestrates modular force-directed graph renderer for String Theory puzzles
 *
 * Requires: network-utils.js, network-physics.js, network-renderer.js,
 *           network-sound.js, network-interaction.js
 */

class NetworkViz {
  constructor(config) {
    // Required config
    this.canvas = config.canvas;
    this.nodes = config.nodes || [];
    this.edges = config.edges || [];

    // Optional config
    this.mode = config.mode || 'game';
    this.randomSeed = config.randomSeed || 42;
    this.givenWords = new Set(config.givenWords || []);
    this.savedWords = new Set(config.savedWords || []);
    this.bounds = config.bounds || null;
    this.showBounds = config.showBounds || false;
    this.scaleFactor = config.scaleFactor || 1.0;
    this.fontSize = config.fontSize || null;
    this.onGuess = config.onGuess || null;
    this.gimmick = config.gimmick || '';
    this.puzzleName = config.puzzleName || 'Puzzle';
    this.level = config.level || null;
    this.storageKey = config.storageKey || null;
    this.victoryText = config.victoryText || 'Chopin - Nocturne in E Flat Major';
    this.precomputedPositions = config.precomputedPositions || null;

    // Physics config
    this.physicsConfig = {
      repulsionFactor: config.repulsionFactor || 0.1,
      attractionFactor: config.attractionFactor || 0.5,
      lengthScale: config.lengthScale || (80 * this.scaleFactor),
      damping: config.damping || 0.03,
      maxVelocity: config.maxVelocity || 100,
      physicsStepsPerFrame: config.physicsStepsPerFrame || (this.mode === 'display' ? 20 : 100),
      targetFPS: config.targetFPS || 50,
      ...config.physicsConfig
    };

    // Display mode config
    this.displayConfig = {
      enablePhysics: config.enablePhysics !== false,
      enableDancing: config.enableDancing !== false,
      danceIntensity: config.danceIntensity || 0.01,
      showLabelsAlways: config.showLabelsAlways || false,
      boxStyle: config.boxStyle || 'auto',
      useBoundaryRepulsion: config.useBoundaryRepulsion || false,
      ...config.displayConfig
    };

    // Internal state
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.nodePositions = {};
    // Initialize guessedWords with both given words and saved words
    this.guessedWords = new Set([...this.givenWords, ...this.savedWords]);
    this.physicsStepCount = 0;
    this.currentIteration = 0;
    this.lastFrameTime = null;
    this.lastRenderTime = null;
    this.draggedNode = null;
    this.dragOffset = { x: 0, y: 0 };
    this.initialDragOffset = { x: 0, y: 0 };
    this.dragStartTime = 0;
    this.lastMousePos = { x: 0, y: 0 };
    this.animationFrameId = null;

    // Virtual canvas dimensions will be set in initializeNodes after viewScale is calculated
    this.virtualWidth = null;
    this.virtualHeight = null;

    // Initialize
    this.seededRandom = createSeededRandom(this.randomSeed);
    this.normalRandom = createNormalRandom(this.seededRandom);

    // Set theme color for this puzzle
    // ROYGBIV hues (normalized to [0, 1]) matching the level select menu
    const roygbivHues = [0.000, 0.082, 0.167, 0.333, 0.585, 0.748, 0.833];

    if (this.level !== null && this.level >= 1 && this.level <= 7) {
      // Use ROYGBIV color scheme for levels 1-7
      this.themeHue = roygbivHues[this.level - 1];
      this.themeSat = 0.2;  // Pastel saturation (matching ROYGBIV)
      this.themeVal = 1.0;  // Full brightness
    } else {
      // Fallback to hash-based color for non-level puzzles
      const themeHash = hashString(this.puzzleName);
      this.themeHue = ((themeHash % 360) / 360);  // [0, 1]
      this.themeSat = 0.3;
      this.themeVal = 1.0;
    }

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

  // ========== Sound System ==========

  getWordPitch(word) {
    const hash = hashString(word);
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
    playSound({
      audioContext: NetworkViz.audioContext,
      word,
      type,
      volume,
      NEUTRAL_PITCH: this.NEUTRAL_PITCH,
      getWordPitch: (w) => this.getWordPitch(w)
    });
  }

  startRipple(startNode) {
    startRipple({
      startNode,
      adjacencyList: this.adjacencyList,
      rippleToNodeCallback: (node, visited) => this.rippleToNode(node, visited)
    });
  }

  rippleToNode(node, visited) {
    rippleToNode({
      node,
      visited,
      nodePositions: this.nodePositions,
      guessedWords: this.guessedWords,
      givenWords: this.givenWords,
      scaleFactor: this.scaleFactor,
      seededRandom: this.seededRandom,
      adjacencyList: this.adjacencyList,
      playSoundCallback: (w, t, v) => this.playSound(w, t, v),
      rippleToNodeCallback: (n, vis) => this.rippleToNode(n, vis)
    });
  }

  // ========== Guess Handling ==========

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
      const perturbationStddev = alreadyRevealed ? 1.0 : 3.0;
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

    // Calculate view scale (always needed for visual element sizing)
    const numWords = this.nodes.length;
    let scale = this.scaleFactor;
    if (numWords > 10) {
      scale = this.scaleFactor * Math.sqrt(10 / numWords);
    }
    this.viewScale = scale * 2.0;  // Unified view scale - doubled to show less virtual space (zoom in)

    // Set up virtual canvas dimensions - physics operates in this space
    this.virtualWidth = this.width / this.viewScale;
    this.virtualHeight = this.height / this.viewScale;

    // Calculate node dimensions
    // Base font size in virtual units (before viewScale applied)
    const baseFontSizeVirtual = 32;

    if (!this.fontSize) {
      this.fontSize = Math.round(baseFontSizeVirtual * this.viewScale);
    }

    this.ctx.font = `${this.fontSize}px "Gill Sans", sans-serif`;
    this.nodeTextWidths = {};
    let maxTextWidth = 0;
    this.nodes.forEach(node => {
      const textWidthScreen = this.ctx.measureText(node).width;
      // Convert to virtual units
      const textWidth = textWidthScreen / this.viewScale;
      this.nodeTextWidths[node] = textWidth;
      if (textWidth > maxTextWidth) maxTextWidth = textWidth;
    });

    // Box dimensions in virtual units, proportional to base font size
    // If fontSize is explicitly set, derive the virtual font size from it
    const virtualFontSize = this.fontSize / this.viewScale;
    this.boxHeight = virtualFontSize * 1.25;   // Increased from 1.125 for more vertical space
    this.boxPadding = virtualFontSize * 0.6;   // Increased from 0.5 for more horizontal space
    this.uniformBoxHeight = this.boxHeight;
    this.uniformBoxWidth = this.uniformBoxHeight * 2.5;

    // Initialize positions in virtual space
    const margin = 50;
    const lengthScale = this.physicsConfig.lengthScale;
    this.maxInitialZ = 0;

    // Check if we have precomputed positions
    if (this.precomputedPositions) {
      console.log('📍 Using precomputed positions, skipping annealing phases');

      // Validate all nodes are present
      const missingNodes = this.nodes.filter(node => !this.precomputedPositions[node]);
      if (missingNodes.length > 0) {
        console.error('❌ Missing precomputed positions for nodes:', missingNodes);
        console.error('   Puzzle may have changed since last precompute. Run: node scripts/precompute_layouts.js');
        throw new Error(`Missing precomputed positions for ${missingNodes.length} nodes`);
      }

      // Use precomputed positions, start at Phase 4 (steady state)
      this.nodes.forEach(node => {
        this.nodePositions[node] = {
          x: this.precomputedPositions[node].x,
          y: this.precomputedPositions[node].y,
          z: 0,  // Already in 2D after Phase 3
          vx: 0,
          vy: 0,
          vz: 0,
          fx: 0,
          fy: 0,
          fz: 0
        };
      });

      // Set physics step count to Phase 4 start to skip annealing
      this.physicsStepCount = 10000;
    } else {
      // No precomputed positions, use random initialization (will anneal)
      if (this.mode === 'game') {
        console.log('⚠️  No precomputed positions found, running full annealing (slow!)');
        console.log('   Run: node scripts/precompute_layouts.js');
      }

      this.nodes.forEach(node => {
        const z = (this.seededRandom() - 0.5) * 2 * lengthScale;
        this.nodePositions[node] = {
          x: margin + this.seededRandom() * (this.virtualWidth - 2 * margin),
          y: margin + this.seededRandom() * (this.virtualHeight - 2 * margin),
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
  }

  // ========== Coordinate Transformation ==========

  // Transform from virtual (physics) coordinates to screen (canvas) coordinates
  toScreenCoords(virtualPos) {
    return {
      x: virtualPos.x * this.viewScale,
      y: virtualPos.y * this.viewScale
    };
  }

  // Transform from screen coordinates to virtual coordinates (for mouse input)
  toVirtualCoords(screenPos) {
    return {
      x: screenPos.x / this.viewScale,
      y: screenPos.y / this.viewScale
    };
  }

  // ========== Box Dimensions & Color ==========

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
    const isGiven = this.givenWords.has(node);
    const isGuessed = this.guessedWords.has(node);
    const allNeighborsSolved = isGiven && this.edges.every(e => {
      const neighbor = e.from === node ? e.to : e.to === node ? e.from : null;
      return neighbor === null || this.guessedWords.has(neighbor);
    });
    if (isGuessed && (!isGiven || allNeighborsSolved)) {
      // Use puzzle's theme color with per-word variation
      const hash = hashString(node);

      // Generate variation using hash as seed
      const rand1 = ((hash * 2654435761) % 1000) / 1000;  // Pseudo-random [0, 1]
      const rand2 = ((hash * 1103515245 + 12345) % 1000) / 1000;
      const rand3 = ((hash * 134775813) % 1000) / 1000;

      // Apply variation: U[-0.1, 0.1]
      const hVar = (rand1 - 0.5) * 0.2;  // Maps [0,1] to [-0.1, 0.1]
      const sVar = (rand2 - 0.5) * 0.2;
      const vVar = (rand3 - 0.5) * 0.2;

      // Apply to theme color with clamping
      const h = Math.max(0, Math.min(1, this.themeHue + hVar));
      const s = Math.max(0, Math.min(1, this.themeSat + sVar));
      const v = Math.max(0, Math.min(1, this.themeVal + vVar));

      const rgb = hsvToRgb(h, s, v);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    return '#ffffff';
  }

  // ========== Physics ==========

  updatePhysics() {
    if (this.mode === 'display') {
      updateDisplayPhysics({
        nodes: this.nodes,
        edges: this.edges,
        nodePositions: this.nodePositions,
        physicsConfig: this.physicsConfig,
        bounds: this.bounds,
        draggedNode: this.draggedNode,
        displayConfig: this.displayConfig,
        seededRandom: this.seededRandom,
        width: this.virtualWidth,
        height: this.virtualHeight,
        getBoxDimensions: (n) => this.getBoxDimensions(n),
        getNearestBoundaryPoint: getNearestBoundaryPoint,
        rectToRectDistance3D: rectToRectDistance3D
      });
    } else {
      updateGamePhysics({
        nodes: this.nodes,
        edges: this.edges,
        nodePositions: this.nodePositions,
        physicsConfig: this.physicsConfig,
        physicsStepCount: this.physicsStepCount,
        draggedNode: this.draggedNode,
        guessedWords: this.guessedWords,
        seededRandom: this.seededRandom,
        width: this.virtualWidth,
        height: this.virtualHeight,
        maxInitialZ: this.maxInitialZ,
        getBoxDimensions: (n) => this.getBoxDimensions(n),
        getNearestBoundaryPoint: getNearestBoundaryPoint,
        rectToRectDistance3D: rectToRectDistance3D
      });
    }
  }

  centerGraph() {
    centerGraph({
      nodes: this.nodes,
      nodePositions: this.nodePositions,
      bounds: this.bounds,
      width: this.virtualWidth,
      height: this.virtualHeight
    });
  }

  // ========== Rendering ==========

  render() {
    render({
      ctx: this.ctx,
      width: this.width,
      height: this.height,
      mode: this.mode,
      physicsStepCount: this.physicsStepCount,
      showBounds: this.showBounds,
      bounds: this.bounds,
      edges: this.edges,
      nodes: this.nodes,
      nodePositions: this.nodePositions,
      guessedWords: this.guessedWords,
      displayConfig: this.displayConfig,
      fontSize: this.fontSize,
      viewScale: this.viewScale,
      victoryText: this.victoryText,
      getBoxDimensions: (n) => this.getBoxDimensions(n),
      getNodeColor: (n) => this.getNodeColor(n),
      givenWords: this.givenWords,
      gimmick: this.gimmick,
      physicsConfig: this.physicsConfig,
      lineRectIntersection: lineRectIntersection,
      toScreenCoords: (pos) => this.toScreenCoords(pos)
    });
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
      updateDragOffset({
        dragStartTime: this.dragStartTime,
        initialDragOffset: this.initialDragOffset,
        dragOffset: this.dragOffset
      });

      updateDraggedNodePosition({
        draggedNode: this.draggedNode,
        lastMousePos: this.lastMousePos,
        dragOffset: this.dragOffset,
        nodePositions: this.nodePositions,
        bounds: this.bounds,
        getBoxDimensions: (n) => this.getBoxDimensions(n)
      });
    }

    // Run physics
    if (this.displayConfig.enablePhysics) {
      // In Phase 4 (steady state), use fewer steps per frame like the old version
      // This prevents numerical instability and high-frequency oscillations
      const PHASE_3_STEPS = 10000;
      const inPhase4 = this.physicsStepCount >= PHASE_3_STEPS;
      const stepsPerFrame = inPhase4 ? 5 : this.physicsConfig.physicsStepsPerFrame;

      for (let i = 0; i < stepsPerFrame; i++) {
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
    // Setup mouse events for dragging
    this.canvas.addEventListener('mousedown', (e) => this._handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._handleMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this._handleMouseUp());
    this.canvas.addEventListener('mouseleave', () => this._handleMouseLeave());

    // Global listeners to track mouse outside canvas and catch releases
    document.addEventListener('mousemove', (e) => this._handleGlobalMouseMove(e));
    document.addEventListener('mouseup', () => this._handleMouseUp());
  }

  _handleGlobalMouseMove(e) {
    handleGlobalMouseMove({
      canvas: this.canvas,
      draggedNode: this.draggedNode,
      width: this.virtualWidth,
      height: this.virtualHeight,
      lastMousePos: this.lastMousePos,
      toVirtualCoords: (pos) => this.toVirtualCoords(pos)
    }, e);
  }

  _handleMouseDown(e) {
    const result = handleMouseDown({
      mode: this.mode,
      physicsStepCount: this.physicsStepCount,
      canvas: this.canvas,
      nodes: this.nodes,
      nodePositions: this.nodePositions,
      getBoxDimensions: (n) => this.getBoxDimensions(n),
      initialDragOffset: this.initialDragOffset,
      dragOffset: this.dragOffset,
      guessedWords: this.guessedWords,
      givenWords: this.givenWords,
      playSoundCallback: (w, t) => this.playSound(w, t),
      toVirtualCoords: (pos) => this.toVirtualCoords(pos)
    }, e);

    if (result) {
      this.draggedNode = result.draggedNode;
      this.dragStartTime = result.dragStartTime;
    }
  }

  _handleMouseMove(e) {
    handleMouseMove({
      canvas: this.canvas,
      draggedNode: this.draggedNode,
      nodes: this.nodes,
      nodePositions: this.nodePositions,
      getBoxDimensions: (n) => this.getBoxDimensions(n),
      width: this.virtualWidth,
      height: this.virtualHeight,
      lastMousePos: this.lastMousePos,
      mode: this.mode,
      physicsStepCount: this.physicsStepCount,
      toVirtualCoords: (pos) => this.toVirtualCoords(pos)
    }, e);
  }

  _handleMouseUp() {
    const result = handleMouseUp({
      canvas: this.canvas
    });
    if (result) {
      this.draggedNode = result.draggedNode;
    }
  }

  _handleMouseLeave() {
    handleMouseLeave({});
  }
}

// Shared audio context
NetworkViz.audioContext = null;
