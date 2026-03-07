// ============================================================================
// UI INTERACTIONS
// ============================================================================

// Tool switching
function setActiveTool(tool) {
  activeTool = tool;

  // Update toolbar buttons
  document.querySelectorAll('.tool-button').forEach(btn => {
    btn.classList.remove('active');
  });

  const toolMap = {
    'select': 'selectTool',
    'pan': 'panTool',
    'addNode': 'addNodeTool',
    'drawEdge': 'drawEdgeTool',
    'eraser': 'eraserTool'
  };

  const btnId = toolMap[tool];
  if (btnId) {
    document.getElementById(btnId).classList.add('active');
  }

  // Update status text
  const statusMap = {
    'select': 'Select tool active',
    'pan': 'Pan tool active - drag to pan',
    'addNode': 'Add node tool - click to create',
    'drawEdge': 'Draw edge tool - click nodes to connect',
    'eraser': 'Eraser tool - click to delete'
  };

  document.getElementById('statusText').textContent = statusMap[tool] || '';

  // Update cursor
  canvas.className = '';
  if (tool === 'pan') {
    canvas.classList.add('pan-cursor');
  } else if (tool === 'addNode' || tool === 'drawEdge') {
    canvas.classList.add('crosshair-cursor');
  } else {
    canvas.classList.add('select-cursor');
  }

  // Cancel ongoing actions
  edgeDrawStart = null;
}

// Update properties panel
function updatePropertiesPanel() {
  const panel = document.getElementById('propertiesPanel');
  const nodeEditor = document.getElementById('nodeEditor');
  const edgeEditor = document.getElementById('edgeEditor');

  if (selectedNode) {
    // Show node editor
    panel.style.display = 'block';
    nodeEditor.style.display = 'block';
    edgeEditor.style.display = 'none';

    document.getElementById('nodeLabel').value = selectedNode.label;
  } else if (selectedEdge) {
    // Show edge editor
    panel.style.display = 'block';
    nodeEditor.style.display = 'none';
    edgeEditor.style.display = 'block';

    const fromNode = getNodeById(selectedEdge.fromId);
    const toNode = getNodeById(selectedEdge.toId);

    document.getElementById('edgeFrom').textContent = fromNode?.label || '?';
    document.getElementById('edgeTo').textContent = toNode?.label || '?';
    document.getElementById('edgeDirection').value = selectedEdge.direction;
    document.getElementById('edgeType').value = selectedEdge.typeId;
  } else {
    // Hide panel
    panel.style.display = 'none';
  }
}

// Update UI elements (counts, zoom, etc.)
function updateUI() {
  document.getElementById('nodeCount').textContent = nodes.length;
  document.getElementById('edgeCount').textContent = edges.length;
  document.getElementById('zoomLevel').textContent = Math.round(zoom * 100) + '%';

  // Update edge type dropdowns
  updateEdgeTypeDropdowns();
  updateEdgeLegend();
}

// Update edge type dropdowns
function updateEdgeTypeDropdowns() {
  const select = document.getElementById('edgeType');
  if (!select) return;

  select.innerHTML = '';
  edgeTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type.id;
    option.textContent = type.name;
    select.appendChild(option);
  });
}

// Update edge type legend
function updateEdgeLegend() {
  const list = document.getElementById('edgeTypeList');
  if (!list) return;

  list.innerHTML = '';
  edgeTypes.forEach(type => {
    const item = document.createElement('div');
    item.className = 'edge-type-item';

    const preview = document.createElement('canvas');
    preview.className = 'edge-type-preview';
    preview.width = 30;
    preview.height = 20;
    const pctx = preview.getContext('2d');
    pctx.strokeStyle = type.color;
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(0, 10);
    pctx.lineTo(30, 10);
    pctx.stroke();

    const name = document.createElement('span');
    name.textContent = type.name;

    item.appendChild(preview);
    item.appendChild(name);
    list.appendChild(item);
  });
}

// Initialize UI event listeners
function initUI() {
  // Toolbar
  document.getElementById('selectTool').addEventListener('click', () => setActiveTool('select'));
  document.getElementById('panTool').addEventListener('click', () => setActiveTool('pan'));
  document.getElementById('addNodeTool').addEventListener('click', () => setActiveTool('addNode'));
  document.getElementById('drawEdgeTool').addEventListener('click', () => setActiveTool('drawEdge'));
  document.getElementById('eraserTool').addEventListener('click', () => setActiveTool('eraser'));

  document.getElementById('undoButton').addEventListener('click', undo);
  document.getElementById('redoButton').addEventListener('click', redo);

  // Node editor
  document.getElementById('nodeLabel').addEventListener('input', (e) => {
    if (selectedNode) {
      selectedNode.label = e.target.value || 'word';
    }
  });

  document.getElementById('deleteNodeButton').addEventListener('click', () => {
    if (selectedNode) {
      saveState();
      edges = edges.filter(e => e.fromId !== selectedNode.id && e.toId !== selectedNode.id);
      nodes = nodes.filter(n => n.id !== selectedNode.id);
      SelectionManager.clearAll();
      updatePropertiesPanel();
      updateUI();
    }
  });

  // Edge editor
  document.getElementById('edgeDirection').addEventListener('change', (e) => {
    if (selectedEdge) {
      saveState();
      selectedEdge.direction = e.target.value;
    }
  });

  document.getElementById('edgeType').addEventListener('change', (e) => {
    if (selectedEdge) {
      saveState();
      selectedEdge.typeId = parseInt(e.target.value);
    }
  });

  document.getElementById('deleteEdgeButton').addEventListener('click', () => {
    if (selectedEdge) {
      saveState();
      edges = edges.filter(e => e.id !== selectedEdge.id);
      SelectionManager.clearAll();
      updatePropertiesPanel();
      updateUI();
    }
  });

  // Import/export
  document.getElementById('exportButton').addEventListener('click', exportToText);
  document.getElementById('importButton').addEventListener('click', importFromText);

  document.getElementById('clearAllButton').addEventListener('click', () => {
    if (confirm('Clear all nodes and edges? This cannot be undone.')) {
      saveState();
      nodes = [];
      edges = [];
      SelectionManager.clearAll();
      updatePropertiesPanel();
      updateUI();
    }
  });

  // Edge type management
  document.getElementById('addEdgeTypeButton').addEventListener('click', () => {
    const name = prompt('Edge type name:');
    if (name) {
      saveState();
      edgeTypes.push({
        id: nextEdgeTypeId++,
        name: name,
        color: '#000000',
        style: 'solid',
        waveType: 'straight'
      });
      updateUI();
    }
  });
}
