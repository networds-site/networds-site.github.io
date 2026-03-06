# Claude Notes - Networds Site

## ⚠️ CRITICAL RULES ⚠️
- **NEVER EVER PUSH TO GITHUB UNLESS EXPLICITLY TOLD TO DO SO**
- **DO NOT PUSH WITHOUT EXPLICIT PERMISSION**
- **WAIT FOR USER TO SAY "push" OR "git push"**
- User always initiates all git pushes

## Project Overview
Word puzzle game site hosted on GitHub Pages. Minimal Jekyll site with network-based word connection puzzles.

## Architecture

### Site Structure
- Jekyll static site with Gill Sans font, light mode only
- Homepage (`index.html`): Lists all puzzles sorted by level
- Puzzles render at root level: `/level1/`, `/level2/`, etc. (NOT `/puzzles/level1/`)
- Collections configured in `_config.yml` with `permalink: /:name/`

### Puzzle Format
Each puzzle = 2 files in `_puzzles/`:
1. **`.md` file**: Front matter with layout, type, title, level, data_file
2. **`.txt` file**: Puzzle data with edges, given words, random seed, name

Example edge syntax:
```
word1->word2    # directed arrow
word1<->word2   # bidirectional
word1~word2     # anagram (red sine wave, formula: |sin(x)^0.5| * sign(sin(x)))
word1#word2     # change one letter (blue triangle wave, 2x frequency of anagram)
word1-word2     # undirected
```

Given words syntax:
```
given: [leaves]              # only leaf nodes
given: [leaves] + word1, word2   # leaves plus specific words
given: [all]                 # all words shown
```

### Edge Types & Visual Rendering
- **Arrows** (`->`, `<-`, `<->`): Black lines with directional circles
- **Anagram** (`~`): Red sine wave, modified formula `|sin(x)^0.5| * sign(sin(x))`
- **Change-one-letter** (`#`): Blue triangle wave, 2x frequency of anagram wave
- **Undirected** (`-`): Black line, no circles

### Game Engine
- Self-contained in `_layouts/network_puzzle.html`
- Force-directed graph physics with 4 animation phases
- Victory music: `audio/chopin_nocturne.mp3` (Chopin nocturne)
- Progress saved in localStorage per puzzle
- Supports special gimmicks (e.g., invisible_connections)

### Current Puzzles
- Levels 1-7 (Level 2 added during session)
- Level 11 (final) - complete puzzle with mixed edge types

### Key Files
- `_config.yml`: Jekyll config, collections, site metadata
- `_layouts/default.html`: Base layout wrapper
- `_layouts/network_puzzle.html`: Complete game engine
- `assets/css/style.css`: Minimal styles with CSS variables
- `index.html`: Homepage with puzzle list

### GitHub Pages Deployment
- Uses GitHub Actions workflow (`.github/workflows/jekyll.yml`)
- Settings → Pages → Source: GitHub Actions
- Auto-builds on push to main branch
