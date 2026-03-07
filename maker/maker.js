// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Puzzle Maker initializing...');

  // Initialize state
  initializeState();

  // Initialize UI
  initUI();

  // Initial render
  updateUI();
  updatePropertiesPanel();
  updateUndoRedoButtons();

  // Save initial state to history
  saveState();

  // Start animation loop
  animate();

  console.log('✅ Puzzle Maker ready!');
});
