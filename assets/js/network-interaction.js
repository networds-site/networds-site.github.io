/**
 * Network Interaction Module
 * Handles mouse interaction and drag behavior
 */

/**
 * Handle global mouse move (for dragging outside canvas)
 * @param {Object} context - Contains canvas, draggedNode, width, height, lastMousePos, toVirtualCoords
 */
function handleGlobalMouseMove(context, e) {
  const { canvas, draggedNode, width, height, lastMousePos, toVirtualCoords } = context;

  // Only process if we're dragging
  if (!draggedNode) return;

  // Convert to canvas pixel coordinates
  const rect = canvas.getBoundingClientRect();
  let screenX = (e.clientX - rect.left) * (canvas.width / rect.width);
  let screenY = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Convert to virtual coordinates
  const virtual = toVirtualCoords({ x: screenX, y: screenY });

  // Clamp to virtual canvas bounds
  virtual.x = Math.max(0, Math.min(width, virtual.x));
  virtual.y = Math.max(0, Math.min(height, virtual.y));

  // Store clamped position in virtual coordinates
  lastMousePos.x = virtual.x;
  lastMousePos.y = virtual.y;
}

/**
 * Handle mouse down (start drag)
 * @param {Object} context - Contains mode, physicsStepCount, canvas, nodes, positions, etc.
 */
function handleMouseDown(context, e) {
  const {
    mode,
    physicsStepCount,
    canvas,
    nodes,
    nodePositions,
    getBoxDimensions,
    initialDragOffset,
    dragOffset,
    guessedWords,
    givenWords,
    playSoundCallback,
    toVirtualCoords
  } = context;

  // Game mode: only allow dragging in phase 4
  if (mode === 'game') {
    const PHASE_3_STEPS = 10000;
    if (physicsStepCount < PHASE_3_STEPS) return null;
  }

  const rect = canvas.getBoundingClientRect();
  const screenX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const screenY = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Convert to virtual coordinates
  const mouse = toVirtualCoords({ x: screenX, y: screenY });

  for (const node of nodes) {
    const pos = nodePositions[node];
    const box = getBoxDimensions(node);

    if (Math.abs(mouse.x - pos.x) <= box.width / 2 &&
        Math.abs(mouse.y - pos.y) <= box.height / 2) {
      canvas.style.cursor = 'grabbing';

      // Store the initial offset from box center to click point (in virtual coordinates)
      initialDragOffset.x = mouse.x - pos.x;
      initialDragOffset.y = mouse.y - pos.y;
      dragOffset.x = initialDragOffset.x;
      dragOffset.y = initialDragOffset.y;

      // Play sound on click (game mode)
      if (mode === 'game') {
        if (guessedWords.has(node) && !givenWords.has(node)) {
          playSoundCallback(node, 'positive');
        } else {
          playSoundCallback(node, 'neutral');
        }
      }

      return { draggedNode: node, dragStartTime: performance.now() };
    }
  }

  return null;
}

/**
 * Handle mouse move (hover or drag)
 * @param {Object} context - Contains canvas, draggedNode, nodes, positions, etc.
 */
function handleMouseMove(context, e) {
  const {
    canvas,
    draggedNode,
    nodes,
    nodePositions,
    getBoxDimensions,
    width,
    height,
    lastMousePos,
    mode,
    physicsStepCount,
    toVirtualCoords
  } = context;

  const rect = canvas.getBoundingClientRect();
  let screenX = (e.clientX - rect.left) * (canvas.width / rect.width);
  let screenY = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Convert to virtual coordinates
  const mouse = toVirtualCoords({ x: screenX, y: screenY });

  // Clamp mouse position to virtual canvas bounds
  mouse.x = Math.max(0, Math.min(width, mouse.x));
  mouse.y = Math.max(0, Math.min(height, mouse.y));

  // Store last mouse position (in virtual coordinates)
  lastMousePos.x = mouse.x;
  lastMousePos.y = mouse.y;

  if (draggedNode) {
    // Position update happens in animation loop
  } else {
    let hovering = false;
    for (const node of nodes) {
      const pos = nodePositions[node];
      const box = getBoxDimensions(node);

      if (Math.abs(mouse.x - pos.x) <= box.width / 2 &&
          Math.abs(mouse.y - pos.y) <= box.height / 2) {
        hovering = true;
        break;
      }
    }
    // Game mode: only show grab cursor in phase 4
    if (mode === 'game') {
      const PHASE_3_STEPS = 10000;
      if (physicsStepCount < PHASE_3_STEPS) {
        canvas.style.cursor = 'default';
        return;
      }
    }

    canvas.style.cursor = hovering ? 'grab' : 'default';
  }
}

/**
 * Handle mouse up (end drag)
 * @param {Object} context - Contains canvas
 */
function handleMouseUp(context) {
  const { canvas } = context;

  canvas.style.cursor = 'default';
  return { draggedNode: null };
}

/**
 * Handle mouse leave canvas
 * Don't release drag when mouse leaves - let user keep dragging
 */
function handleMouseLeave(context) {
  // Don't release drag when mouse leaves - let user keep dragging
  // Only release on actual mouseup
}

/**
 * Update drag offset with exponential decay
 * @param {Object} context - Contains dragStartTime, initialDragOffset, dragOffset
 */
function updateDragOffset(context) {
  const { dragStartTime, initialDragOffset, dragOffset } = context;

  const elapsed = (performance.now() - dragStartTime) / 1000;
  const tau = 1.0; // 1 second time constant
  const factor = Math.exp(-elapsed / tau);

  dragOffset.x = initialDragOffset.x * factor;
  dragOffset.y = initialDragOffset.y * factor;
}

/**
 * Update dragged node position
 * @param {Object} context - Contains draggedNode, lastMousePos, dragOffset, nodePositions, bounds, getBoxDimensions
 */
function updateDraggedNodePosition(context) {
  const { draggedNode, lastMousePos, dragOffset, nodePositions, bounds, getBoxDimensions } = context;

  if (!draggedNode) return;

  const pos = nodePositions[draggedNode];
  pos.x = lastMousePos.x - dragOffset.x;
  pos.y = lastMousePos.y - dragOffset.y;

  // Apply bounds if specified (hard boundary - consider box size)
  if (bounds) {
    const box = getBoxDimensions(draggedNode);
    const halfWidth = box.width / 2;
    const halfHeight = box.height / 2;

    const minX = bounds.x + halfWidth;
    const maxX = bounds.x + bounds.width - halfWidth;
    const minY = bounds.y + halfHeight;
    const maxY = bounds.y + bounds.height - halfHeight;

    pos.x = Math.max(minX, Math.min(maxX, pos.x));
    pos.y = Math.max(minY, Math.min(maxY, pos.y));
  }
}
