// ============================================================================
// RENDERING
// ============================================================================

const canvas = document.getElementById('makerCanvas');
const ctx = canvas.getContext('2d');

// Drawing constants
const NODE_PADDING = 10;
const NODE_BORDER = 2;
const EDGE_WIDTH = 4.5;
const CIRCLE_RADIUS = 6.0;
const SELECTION_HIGHLIGHT = '#2a9d8f';

// Get box dimensions for a node label
function getBoxDimensions(label) {
  ctx.font = '24px "Gill Sans", sans-serif';
  const metrics = ctx.measureText(label);
  const width = metrics.width + NODE_PADDING * 2;
  const height = 30; // Approximate height for 24px font
  return { width, height };
}

// Find intersection of line with rectangle
function lineRectIntersection(x1, y1, x2, y2, cx, cy, w, h) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: cx, y: cy };

  const dirX = dx / len;
  const dirY = dy / len;

  // Extend from center to edge
  const hw = w / 2;
  const hh = h / 2;

  let t = Math.abs(dirX) > Math.abs(dirY) ?
    (dirX > 0 ? hw / dirX : -hw / dirX) :
    (dirY > 0 ? hh / dirY : -hh / dirY);

  return {
    x: cx + dirX * t,
    y: cy + dirY * t
  };
}

// Main render function
function render() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  // Apply zoom and pan
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Draw edges
  edges.forEach(edge => {
    const fromNode = getNodeById(edge.fromId);
    const toNode = getNodeById(edge.toId);
    if (!fromNode || !toNode) return;

    const edgeType = getEdgeTypeById(edge.typeId);
    const isSelected = SelectionManager.isEdgeSelected(edge);

    drawEdge(fromNode, toNode, edge.direction, edgeType, isSelected);
  });

  // Draw nodes
  nodes.forEach(node => {
    const isSelected = SelectionManager.isNodeSelected(node);
    drawNode(node, isSelected);
  });

  // Draw edge direction circles
  edges.forEach(edge => {
    const fromNode = getNodeById(edge.fromId);
    const toNode = getNodeById(edge.toId);
    if (!fromNode || !toNode) return;

    drawEdgeCircles(fromNode, toNode, edge.direction);
  });

  // Draw edge being drawn
  if (edgeDrawStart !== null && lastMousePos) {
    const startNode = getNodeById(edgeDrawStart);
    if (startNode) {
      const worldEnd = screenToWorld(lastMousePos.x, lastMousePos.y);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(startNode.x, startNode.y);
      ctx.lineTo(worldEnd.x, worldEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.restore();

  // Draw selection box (in screen space)
  if (selectionBox) {
    ctx.strokeStyle = SELECTION_HIGHLIGHT;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      selectionBox.startX,
      selectionBox.startY,
      selectionBox.endX - selectionBox.startX,
      selectionBox.endY - selectionBox.startY
    );
    ctx.setLineDash([]);
  }
}

function drawNode(node, isSelected) {
  const box = getBoxDimensions(node.label);

  // Fill
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(node.x - box.width / 2, node.y - box.height / 2, box.width, box.height);

  // Border
  ctx.strokeStyle = isSelected ? SELECTION_HIGHLIGHT : '#000';
  ctx.lineWidth = isSelected ? NODE_BORDER * 2 : NODE_BORDER;
  ctx.strokeRect(node.x - box.width / 2, node.y - box.height / 2, box.width, box.height);

  // Label
  ctx.fillStyle = '#000';
  ctx.font = '24px "Gill Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, node.x, node.y);
}

function drawEdge(fromNode, toNode, direction, edgeType, isSelected) {
  const fromBox = getBoxDimensions(fromNode.label);
  const toBox = getBoxDimensions(toNode.label);

  const fromIntersect = lineRectIntersection(
    fromNode.x, fromNode.y, toNode.x, toNode.y,
    fromNode.x, fromNode.y, fromBox.width, fromBox.height
  );

  const toIntersect = lineRectIntersection(
    fromNode.x, fromNode.y, toNode.x, toNode.y,
    toNode.x, toNode.y, toBox.width, toBox.height
  );

  ctx.strokeStyle = isSelected ? SELECTION_HIGHLIGHT : (edgeType?.color || '#000');
  ctx.lineWidth = EDGE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(fromIntersect.x, fromIntersect.y);
  ctx.lineTo(toIntersect.x, toIntersect.y);
  ctx.stroke();
}

function drawEdgeCircles(fromNode, toNode, direction) {
  if (direction === 'undirected') return;

  const fromBox = getBoxDimensions(fromNode.label);
  const toBox = getBoxDimensions(toNode.label);

  ctx.fillStyle = '#000';

  if (direction === 'forward' || direction === 'bidirectional') {
    const toIntersect = lineRectIntersection(
      fromNode.x, fromNode.y, toNode.x, toNode.y,
      toNode.x, toNode.y, toBox.width, toBox.height
    );
    ctx.beginPath();
    ctx.arc(toIntersect.x, toIntersect.y, CIRCLE_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
  }

  if (direction === 'backward' || direction === 'bidirectional') {
    const fromIntersect = lineRectIntersection(
      toNode.x, toNode.y, fromNode.x, fromNode.y,
      fromNode.x, fromNode.y, fromBox.width, fromBox.height
    );
    ctx.beginPath();
    ctx.arc(fromIntersect.x, fromIntersect.y, CIRCLE_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// Animation loop
function animate() {
  runPhysics();
  render();
  requestAnimationFrame(animate);
}
