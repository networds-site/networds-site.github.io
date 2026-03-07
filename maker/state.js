// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// Core data structures
let nodes = [];  // { id, label, x, y, vx, vy, fx, fy }
let edges = [];  // { id, fromId, toId, direction, typeId }
let edgeTypes = []; // { id, name, color, style, waveType }

let nextNodeId = 0;
let nextEdgeId = 0;
let nextEdgeTypeId = 0;

// Canvas/view state
let zoom = 1.0;
let panX = 0;
let panY = 0;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;

// Interaction state
let activeTool = 'select'; // 'select', 'pan', 'addNode', 'drawEdge', 'eraser'
let selectedNode = null;
let selectedEdge = null;
let selectedNodes = new Set();
let selectedEdges = new Set();
let draggingNode = null;
let edgeDrawStart = null; // Node ID where edge drawing started
let panning = false;
let panStart = { x: 0, y: 0 };
let lastMousePos = { x: 0, y: 0 };
let selectionBox = null; // { startX, startY, endX, endY } in screen coords

// Undo/redo
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Physics constants (match existing puzzles)
const PHYSICS_CONFIG = {
  repulsionFactor: 0.1,
  attractionFactor: 0.5,
  lengthScale: 80,
  damping: 0.03,
  maxVelocity: 100,
  stepsPerFrame: 10
};

// Initialize with default edge type
function initializeState() {
  edgeTypes.push({
    id: nextEdgeTypeId++,
    name: 'default',
    color: '#000000',
    style: 'solid',
    waveType: 'straight'
  });
}

// Coordinate conversion
function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom
  };
}

function worldToScreen(worldX, worldY) {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY
  };
}

// Get node by ID
function getNodeById(id) {
  return nodes.find(n => n.id === id);
}

// Get edge by ID
function getEdgeById(id) {
  return edges.find(e => e.id === id);
}

// Get edge type by ID
function getEdgeTypeById(id) {
  return edgeTypes.find(t => t.id === id);
}

// Check if edge already exists
function edgeExists(fromId, toId) {
  return edges.some(e =>
    (e.fromId === fromId && e.toId === toId) ||
    (e.fromId === toId && e.toId === fromId)
  );
}

// Selection management
const SelectionManager = {
  clearAll() {
    selectedNode = null;
    selectedEdge = null;
    selectedNodes.clear();
    selectedEdges.clear();
  },

  selectNode(node) {
    this.clearAll();
    selectedNode = node;
  },

  selectEdge(edge) {
    this.clearAll();
    selectedEdge = edge;
  },

  isNodeSelected(node) {
    return node === selectedNode || selectedNodes.has(node);
  },

  isEdgeSelected(edge) {
    return edge === selectedEdge || selectedEdges.has(edge);
  },

  hasSelection() {
    return selectedNode !== null || selectedEdge !== null ||
           selectedNodes.size > 0 || selectedEdges.size > 0;
  }
};

// History management
function saveState() {
  // Remove any states after current index
  history = history.slice(0, historyIndex + 1);

  // Save current state
  const state = {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    edgeTypes: JSON.parse(JSON.stringify(edgeTypes))
  };

  history.push(state);

  // Limit history size
  if (history.length > MAX_HISTORY) {
    history.shift();
  } else {
    historyIndex++;
  }

  updateUndoRedoButtons();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    restoreState(history[historyIndex]);
    updateUndoRedoButtons();
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    restoreState(history[historyIndex]);
    updateUndoRedoButtons();
  }
}

function restoreState(state) {
  nodes = JSON.parse(JSON.stringify(state.nodes));
  edges = JSON.parse(JSON.stringify(state.edges));
  edgeTypes = JSON.parse(JSON.stringify(state.edgeTypes));

  // Update next IDs
  nextNodeId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 0;
  nextEdgeId = edges.length > 0 ? Math.max(...edges.map(e => e.id)) + 1 : 0;
  nextEdgeTypeId = edgeTypes.length > 0 ? Math.max(...edgeTypes.map(t => t.id)) + 1 : 0;

  SelectionManager.clearAll();
  updateUI();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undoButton');
  const redoBtn = document.getElementById('redoButton');

  if (undoBtn) {
    undoBtn.style.opacity = historyIndex > 0 ? '1' : '0.3';
    undoBtn.style.cursor = historyIndex > 0 ? 'pointer' : 'not-allowed';
  }

  if (redoBtn) {
    redoBtn.style.opacity = historyIndex < history.length - 1 ? '1' : '0.3';
    redoBtn.style.cursor = historyIndex < history.length - 1 ? 'pointer' : 'not-allowed';
  }
}
