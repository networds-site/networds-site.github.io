/**
 * Network Sound Module
 * Handles all audio and sound synthesis
 */

/**
 * Play a sound with oscillator
 * @param {Object} context - Contains audioContext, word, type, volume, pitches
 */
function playSound(context) {
  const { audioContext, word, type = 'neutral', volume = 0.2, NEUTRAL_PITCH, getWordPitch } = context;

  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const startTime = audioContext.currentTime;

  if (type === 'neutral') {
    oscillator.frequency.value = NEUTRAL_PITCH;
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.15);
  } else if (type === 'positive') {
    oscillator.frequency.value = getWordPitch(word);
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.4);
  } else if (type === 'negative') {
    const startFreq = NEUTRAL_PITCH * Math.pow(2, 1/12);
    const endFreq = NEUTRAL_PITCH;
    oscillator.frequency.setValueAtTime(startFreq, startTime);
    oscillator.frequency.setValueAtTime(endFreq, startTime + 0.25);
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.5);
  }
}

/**
 * Start a ripple effect from a node
 * @param {Object} context - Contains startNode, adjacencyList, rippleToNode callback
 */
function startRipple(context) {
  const { startNode, adjacencyList, rippleToNodeCallback } = context;

  const JUMP_TIME = 0.2;
  const visited = new Set();
  visited.add(startNode);

  const neighbors = Array.from(adjacencyList[startNode] || []);
  neighbors.forEach(neighbor => {
    if (!visited.has(neighbor)) {
      const delay = (JUMP_TIME / 2 + Math.random() * (JUMP_TIME / 2)) * 1000;
      setTimeout(() => {
        rippleToNodeCallback(neighbor, visited);
      }, delay);
    }
  });
}

/**
 * Ripple to a specific node with sound and velocity perturbation
 * @param {Object} context - Contains node, visited set, positions, adjacencyList, etc.
 */
function rippleToNode(context) {
  const {
    node,
    visited,
    nodePositions,
    guessedWords,
    givenWords,
    scaleFactor,
    seededRandom,
    adjacencyList,
    playSoundCallback,
    rippleToNodeCallback
  } = context;

  if (visited.has(node)) return;
  visited.add(node);

  const pos = nodePositions[node];
  const perturbationStddev = 0.5 * 0.25;
  const a = perturbationStddev * scaleFactor * Math.sqrt(3);
  pos.vx += (seededRandom() * 2 * a) - a;
  pos.vy += (seededRandom() * 2 * a) - a;

  if (guessedWords.has(node) && !givenWords.has(node)) {
    playSoundCallback(node, 'positive', 0.05);
  }

  const neighbors = Array.from(adjacencyList[node] || []);
  neighbors.forEach(neighbor => {
    if (!visited.has(neighbor)) {
      const JUMP_TIME = 0.2;
      const delay = (JUMP_TIME / 2 + Math.random() * (JUMP_TIME / 2)) * 1000;
      setTimeout(() => {
        rippleToNodeCallback(neighbor, visited);
      }, delay);
    }
  });
}
