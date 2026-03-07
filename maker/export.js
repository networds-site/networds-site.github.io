// ============================================================================
// IMPORT/EXPORT
// ============================================================================

function exportToText() {
  let text = '# Puzzle created with Maker\n\n';

  // Export nodes
  text += '# Nodes (label, x, y)\n';
  nodes.forEach(node => {
    text += `${node.label}, ${Math.round(node.x)}, ${Math.round(node.y)}\n`;
  });

  text += '\n# Edges\n';

  // Export edges
  edges.forEach(edge => {
    const fromNode = getNodeById(edge.fromId);
    const toNode = getNodeById(edge.toId);
    if (!fromNode || !toNode) return;

    const edgeType = getEdgeTypeById(edge.typeId);
    const symbol = getEdgeSymbol(edge.direction, edgeType);

    text += `${fromNode.label}${symbol}${toNode.label}\n`;
  });

  // Export edge types (if not default)
  const customTypes = edgeTypes.filter(t => t.name !== 'default');
  if (customTypes.length > 0) {
    text += '\n# Edge Types\n';
    customTypes.forEach(type => {
      text += `edgetype: ${type.name}, ${type.color}, ${type.style}, ${type.waveType}\n`;
    });
  }

  text += '\n# Metadata\n';
  text += 'title: Untitled Puzzle\n';
  text += 'given: []\n';
  text += 'random seed: 42\n';

  // Copy to clipboard and download
  navigator.clipboard.writeText(text).then(() => {
    alert('Exported to clipboard!\n\nAlso downloading as file...');
  });

  // Download as file
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'puzzle.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function getEdgeSymbol(direction, edgeType) {
  // Use custom symbol if edge type is not default
  if (edgeType && edgeType.name !== 'default') {
    return `~${edgeType.name}~`;
  }

  // Standard symbols
  switch (direction) {
    case 'forward': return '->';
    case 'backward': return '<-';
    case 'bidirectional': return '<->';
    case 'undirected': return '-';
    default: return '->';
  }
}

function importFromText() {
  const text = prompt('Paste puzzle text:');
  if (!text) return;

  try {
    saveState();

    // Clear current state
    nodes = [];
    edges = [];
    edgeTypes = [{
      id: 0,
      name: 'default',
      color: '#000000',
      style: 'solid',
      waveType: 'straight'
    }];
    nextNodeId = 0;
    nextEdgeId = 0;
    nextEdgeTypeId = 1;

    const nodeMap = new Map(); // label -> node
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse node (label, x, y)
      if (trimmed.includes(',')) {
        const parts = trimmed.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          const label = parts[0];
          const x = parseFloat(parts[1]);
          const y = parseFloat(parts[2]);

          if (!isNaN(x) && !isNaN(y)) {
            const node = {
              id: nextNodeId++,
              label: label,
              x: x,
              y: y,
              vx: 0,
              vy: 0,
              fx: 0,
              fy: 0
            };
            nodes.push(node);
            nodeMap.set(label, node);
            continue;
          }
        }
      }

      // Parse edge
      const edgeMatch = trimmed.match(/^([^<>\-~]+)(<?-?>?|~[^~]+~)([^<>\-~]+)$/);
      if (edgeMatch) {
        const fromLabel = edgeMatch[1].trim();
        const symbol = edgeMatch[2];
        const toLabel = edgeMatch[3].trim();

        const fromNode = nodeMap.get(fromLabel);
        const toNode = nodeMap.get(toLabel);

        if (fromNode && toNode) {
          let direction = 'forward';
          let typeId = edgeTypes[0].id;

          // Parse direction
          if (symbol === '<->') direction = 'bidirectional';
          else if (symbol === '<-') direction = 'backward';
          else if (symbol === '->') direction = 'forward';
          else if (symbol === '-') direction = 'undirected';
          else if (symbol.startsWith('~')) {
            // Custom type
            const typeName = symbol.slice(1, -1);
            const type = edgeTypes.find(t => t.name === typeName);
            if (type) {
              typeId = type.id;
            }
          }

          // Create nodes if they don't exist (auto-position)
          if (!fromNode) {
            const newNode = {
              id: nextNodeId++,
              label: fromLabel,
              x: Math.random() * 800,
              y: Math.random() * 600,
              vx: 0, vy: 0, fx: 0, fy: 0
            };
            nodes.push(newNode);
            nodeMap.set(fromLabel, newNode);
          }

          if (!toNode) {
            const newNode = {
              id: nextNodeId++,
              label: toLabel,
              x: Math.random() * 800,
              y: Math.random() * 600,
              vx: 0, vy: 0, fx: 0, fy: 0
            };
            nodes.push(newNode);
            nodeMap.set(toLabel, newNode);
          }

          const edge = {
            id: nextEdgeId++,
            fromId: nodeMap.get(fromLabel).id,
            toId: nodeMap.get(toLabel).id,
            direction: direction,
            typeId: typeId
          };
          edges.push(edge);
        }
      }

      // Parse edge type definition
      if (trimmed.startsWith('edgetype:')) {
        const parts = trimmed.substring(9).split(',').map(p => p.trim());
        if (parts.length >= 2) {
          edgeTypes.push({
            id: nextEdgeTypeId++,
            name: parts[0],
            color: parts[1] || '#000000',
            style: parts[2] || 'solid',
            waveType: parts[3] || 'straight'
          });
        }
      }
    }

    SelectionManager.clearAll();
    updatePropertiesPanel();
    updateUI();

    alert(`Imported ${nodes.length} nodes and ${edges.length} edges!`);

  } catch (e) {
    alert('Error importing: ' + e.message);
    console.error(e);
  }
}
