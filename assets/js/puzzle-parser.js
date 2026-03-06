/**
 * Puzzle Data Parser
 * Parses puzzle .txt files into NetworkViz configuration
 */

function parsePuzzleData(text) {
  const lines = text.trim().split('\n');
  const edges = [];
  const nodes = new Set();
  let givenWordsRaw = '';
  let randomSeed = 42;
  let puzzleName = '';
  let gimmick = '';

  lines.forEach(line => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('given:')) {
      givenWordsRaw = trimmedLine.substring(6).trim();
      return;
    }

    if (trimmedLine.startsWith('random seed:')) {
      randomSeed = parseInt(trimmedLine.substring(12).trim(), 10);
      return;
    }

    if (trimmedLine.startsWith('name:')) {
      puzzleName = trimmedLine.substring(5).trim();
      return;
    }

    if (trimmedLine.startsWith('gimmick:')) {
      gimmick = trimmedLine.substring(8).trim();
      return;
    }

    if (trimmedLine === '') return;

    // Parse edge
    let word1, word2, direction;

    if (trimmedLine.includes('~')) {
      const parts = trimmedLine.split('~');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'anagram';
    } else if (trimmedLine.includes('#')) {
      const parts = trimmedLine.split('#');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'triangle';
    } else if (trimmedLine.includes('<->')) {
      const parts = trimmedLine.split('<->');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'bidirectional';
    } else if (trimmedLine.includes('->')) {
      const parts = trimmedLine.split('->');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'forward';
    } else if (trimmedLine.includes('<-')) {
      const parts = trimmedLine.split('<-');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'backward';
    } else if (trimmedLine.includes('-')) {
      const parts = trimmedLine.split('-');
      word1 = parts[0].trim();
      word2 = parts[1].trim();
      direction = 'none';
    } else {
      const parts = trimmedLine.split(' ');
      if (parts.length >= 2) {
        let splitIndex = parts.length - 1;
        word1 = parts.slice(0, splitIndex).join(' ');
        word2 = parts[splitIndex];
        direction = 'none';
      } else {
        return;
      }
    }

    if (word1 && word2) {
      nodes.add(word1);
      nodes.add(word2);
      edges.push({ from: word1, to: word2, direction: direction });
    }
  });

  // Build adjacency list
  const nodeArray = Array.from(nodes);
  const adjacencyList = {};
  nodeArray.forEach(node => {
    adjacencyList[node] = new Set();
  });
  edges.forEach(edge => {
    adjacencyList[edge.from].add(edge.to);
    adjacencyList[edge.to].add(edge.from);
  });

  // Process given words
  const givenWords = [];
  let allWordsGiven = false;

  if (givenWordsRaw === '[all]') {
    allWordsGiven = true;
    givenWords.push(...nodeArray);
  } else if (givenWordsRaw === '[leaves]') {
    nodeArray.forEach(node => {
      if (adjacencyList[node].size === 1) {
        givenWords.push(node);
      }
    });
  } else if (givenWordsRaw.startsWith('[leaves] +')) {
    const additionalPart = givenWordsRaw.substring(11).trim();
    const additionalWords = additionalPart.split(',').map(w => w.trim());
    const nodeSet = new Set(nodeArray);

    nodeArray.forEach(node => {
      if (adjacencyList[node].size === 1) {
        givenWords.push(node);
      }
    });

    additionalWords.forEach(word => {
      if (nodeSet.has(word) && !givenWords.includes(word)) {
        givenWords.push(word);
      }
    });
  } else if (givenWordsRaw.startsWith('[all] -')) {
    const excludedPart = givenWordsRaw.substring(7).trim();
    const excludedWords = new Set(excludedPart.split(',').map(w => w.trim()));
    nodeArray.forEach(node => {
      if (!excludedWords.has(node)) {
        givenWords.push(node);
      }
    });
  } else {
    const specifiedWords = givenWordsRaw.split(',').map(w => w.trim());
    const nodeSet = new Set(nodeArray);
    specifiedWords.forEach(word => {
      if (nodeSet.has(word)) {
        givenWords.push(word);
      }
    });
  }

  return {
    nodes: nodeArray,
    edges: edges,
    givenWords: givenWords,
    randomSeed: randomSeed,
    puzzleName: puzzleName,
    gimmick: gimmick
  };
}
