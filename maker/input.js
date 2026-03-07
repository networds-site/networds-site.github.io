// ============================================================================
// INPUT HANDLING
// ============================================================================

// Hit detection
function findNodeAt(worldX, worldY) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const box = getBoxDimensions(node.label);
    if (Math.abs(worldX - node.x) <= box.width / 2 &&
        Math.abs(worldY - node.y) <= box.height / 2) {
      return node;
    }
  }
  return null;
}

function findEdgeAt(worldX, worldY) {
  const threshold = 20 / zoom;

  for (let i = edges.length - 1; i >= 0; i--) {
    const edge = edges[i];
    const fromNode = getNodeById(edge.fromId);
    const toNode = getNodeById(edge.toId);
    if (!fromNode || !toNode) continue;

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) continue;

    // Project point onto line
    const t = Math.max(0, Math.min(1,
      ((worldX - fromNode.x) * dx + (worldY - fromNode.y) * dy) / lengthSq
    ));

    const projX = fromNode.x + t * dx;
    const projY = fromNode.y + t * dy;
    const dist = Math.sqrt((worldX - projX) ** 2 + (worldY - projY) ** 2);

    if (dist <= threshold) {
      return edge;
    }
  }

  return null;
}

// Mouse event handlers
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  const world = screenToWorld(screenX, screenY);

  lastMousePos = { x: screenX, y: screenY };

  if (activeTool === 'select') {
    const node = findNodeAt(world.x, world.y);
    const edge = findEdgeAt(world.x, world.y);

    if (node) {
      SelectionManager.selectNode(node);
      draggingNode = node;
      updatePropertiesPanel();
    } else if (edge) {
      SelectionManager.selectEdge(edge);
      updatePropertiesPanel();
    } else {
      // Start selection box
      SelectionManager.clearAll();
      selectionBox = { startX: screenX, startY: screenY, endX: screenX, endY: screenY };
      updatePropertiesPanel();
    }
  } else if (activeTool === 'pan') {
    panning = true;
    panStart = { x: e.clientX - panX, y: e.clientY - panY };
    canvas.classList.add('panning');
  } else if (activeTool === 'addNode') {
    // Create node at click position
    saveState();
    const newNode = {
      id: nextNodeId++,
      label: 'word',
      x: world.x,
      y: world.y,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0
    };
    nodes.push(newNode);
    SelectionManager.selectNode(newNode);
    updatePropertiesPanel();
    updateUI();
  } else if (activeTool === 'drawEdge') {
    const node = findNodeAt(world.x, world.y);
    if (node) {
      if (edgeDrawStart === null) {
        // Start drawing edge
        edgeDrawStart = node.id;
      } else {
        // Complete edge
        if (edgeDrawStart !== node.id && !edgeExists(edgeDrawStart, node.id)) {
          saveState();
          const newEdge = {
            id: nextEdgeId++,
            fromId: edgeDrawStart,
            toId: node.id,
            direction: 'forward',
            typeId: edgeTypes[0].id // Default type
          };
          edges.push(newEdge);
          SelectionManager.selectEdge(newEdge);
          updatePropertiesPanel();
          updateUI();
        }
        edgeDrawStart = null;
      }
    }
  } else if (activeTool === 'eraser') {
    const node = findNodeAt(world.x, world.y);
    const edge = findEdgeAt(world.x, world.y);

    if (node) {
      saveState();
      // Remove node and connected edges
      edges = edges.filter(e => e.fromId !== node.id && e.toId !== node.id);
      nodes = nodes.filter(n => n.id !== node.id);
      SelectionManager.clearAll();
      updatePropertiesPanel();
      updateUI();
    } else if (edge) {
      saveState();
      edges = edges.filter(e => e.id !== edge.id);
      SelectionManager.clearAll();
      updatePropertiesPanel();
      updateUI();
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  const world = screenToWorld(screenX, screenY);

  lastMousePos = { x: screenX, y: screenY };

  if (panning) {
    panX = e.clientX - panStart.x;
    panY = e.clientY - panStart.y;
  } else if (draggingNode) {
    draggingNode.x = world.x;
    draggingNode.y = world.y;
  } else if (selectionBox) {
    selectionBox.endX = screenX;
    selectionBox.endY = screenY;
  } else {
    // Update cursor based on what's under mouse
    const node = findNodeAt(world.x, world.y);
    const edge = findEdgeAt(world.x, world.y);

    if (activeTool === 'select' && (node || edge)) {
      canvas.style.cursor = 'pointer';
    } else if (activeTool === 'drawEdge' && node) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (draggingNode) {
    saveState();
    draggingNode = null;
  }

  if (panning) {
    panning = false;
    canvas.classList.remove('panning');
  }

  if (selectionBox) {
    // Select nodes/edges in box
    const minX = Math.min(selectionBox.startX, selectionBox.endX);
    const maxX = Math.max(selectionBox.startX, selectionBox.endX);
    const minY = Math.min(selectionBox.startY, selectionBox.endY);
    const maxY = Math.max(selectionBox.startY, selectionBox.endY);

    nodes.forEach(node => {
      const screen = worldToScreen(node.x, node.y);
      if (screen.x >= minX && screen.x <= maxX &&
          screen.y >= minY && screen.y <= maxY) {
        selectedNodes.add(node);
      }
    });

    selectionBox = null;

    if (selectedNodes.size > 0) {
      selectedNode = null;
      selectedEdge = null;
    }

    updatePropertiesPanel();
  }
});

// Mouse wheel for zoom
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  // World position before zoom
  const worldBefore = screenToWorld(screenX, screenY);

  // Update zoom
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomFactor));

  // World position after zoom
  const worldAfter = screenToWorld(screenX, screenY);

  // Adjust pan to keep mouse position fixed
  panX += (worldAfter.x - worldBefore.x) * zoom;
  panY += (worldAfter.y - worldBefore.y) * zoom;

  updateUI();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Tool shortcuts
  if (e.key === '1') setActiveTool('select');
  else if (e.key === '2') setActiveTool('pan');
  else if (e.key === '3') setActiveTool('addNode');
  else if (e.key === '4') setActiveTool('drawEdge');
  else if (e.key === '5') setActiveTool('eraser');

  // Undo/redo
  else if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      redo();
    }
  }

  // Delete
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedNode || selectedNodes.size > 0) {
      saveState();
      const nodesToDelete = selectedNode ? [selectedNode] : Array.from(selectedNodes);
      nodesToDelete.forEach(node => {
        edges = edges.filter(e => e.fromId !== node.id && e.toId !== node.id);
        nodes = nodes.filter(n => n.id !== node.id);
      });
      SelectionManager.clearAll();
      updatePropertiesPanel();
      updateUI();
    } else if (selectedEdge || selectedEdges.size > 0) {
      saveState();
      const edgesToDelete = selectedEdge ? [selectedEdge] : Array.from(selectedEdges);
      edgesToDelete.forEach(edge => {
        edges = edges.filter(e => e.id !== edge.id);
      });
      SelectionManager.clearAll();
      updatePropertiesPanel();
      updateUI();
    }
  }

  // Escape - cancel current action
  else if (e.key === 'Escape') {
    edgeDrawStart = null;
    SelectionManager.clearAll();
    updatePropertiesPanel();
  }
});
