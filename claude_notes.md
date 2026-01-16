# Claude Notes - Networds Site

## Important Rules
- **NEVER push to GitHub unless explicitly told to do so**
- User will initiate all git pushes

## Architecture Notes

### Site Structure
- Minimal Jekyll site with Gill Sans font
- Homepage lists all puzzles sorted by level
- Each puzzle is a network word connection game
- Puzzles render at root level (e.g., `/level1/`, not `/puzzles/level1/`)

### Puzzle Format
Each puzzle consists of two files:
1. `.md` file with front matter (layout, type, title, level, data_file)
2. `.txt` file with puzzle data (edges, given words, random seed, name)

### Collections
- Puzzles are in `_puzzles/` directory
- Jekyll collections configured in `_config.yml`
- Permalink pattern: `/:name/`

### Current Puzzles
- Level 1-7 (7 was originally "Untitled")
- Level 11 (final) - placeholder, copy of Level 1

### Game Engine
- Complete self-contained game in `_layouts/network_puzzle.html` (1,326 lines)
- Includes physics engine, rendering, audio, game logic
- Victory music: `audio/chopin_nocturne.mp3`
- Supports directional arrows, anagrams (~), and special gimmicks

### Styling
- Light mode only (dark mode was added then removed)
- Minimal aesthetic with Gill Sans font
- CSS variables for colors in `assets/css/style.css`
