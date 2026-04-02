(function () {
  const MahjongDrop = (window.MahjongDrop = window.MahjongDrop || {});

  const VIEWPORT = { width: 750, height: 1500 };
  const SUITS = {
    bamboo: { key: "bamboo", label: "B", color: "#55a96c" },
    dots: { key: "dots", label: "D", color: "#ee8a52" },
    chars: { key: "chars", label: "W", color: "#5a84e0" },
  };

  const GAME_CONFIG = {
    levelName: "Mahjong Drop",
    tileWidth: 48,
    tileHeight: 64,
    tileRadius: 12,
    holdingLimit: 4,
    refillTriggerRows: 2,
    refillDropDistance: 220,
    refillDropSpeed: 0.52,
    physics: {
      gravityY: 1.05,
      restitution: 0.08,
      friction: 0.06,
      airFriction: 0.018,
      engineScale: 0.001,
    },
    effects: {
      placeDuration: 260,
      clearDuration: 340,
    },
  };

  const topLayout = [
    [110, 195, 280, 365, 450, 535, 620],
    [152, 237, 322, 407, 492, 577],
    [110, 195, 280, 365, 450, 535, 620],
    [152, 237, 322, 407, 492, 577],
    [110, 195, 280, 365, 450, 535, 620],
    [152, 237, 322, 407, 492, 577],
  ];

  function shuffle(items) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = result[index];
      result[index] = result[swapIndex];
      result[swapIndex] = temp;
    }
    return result;
  }

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function randomChoice(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function createTriplet(theme) {
    const suitKeys = Object.keys(SUITS);
    const suit = theme?.suit ?? randomChoice(suitKeys);
    const rank = theme?.tripletRanks?.length ? randomChoice(theme.tripletRanks) : randomInt(1, 9);
    return [
      { suit, rank },
      { suit, rank },
      { suit, rank },
    ];
  }

  function createStraight(theme) {
    const suitKeys = Object.keys(SUITS);
    const suit = theme?.suit ?? randomChoice(suitKeys);
    const start = theme?.straightStarts?.length ? randomChoice(theme.straightStarts) : randomInt(1, 7);
    const group = [
      { suit, rank: start },
      { suit, rank: start + 1 },
      { suit, rank: start + 2 },
    ];
    return Math.random() > 0.5 ? group : group.slice().reverse();
  }

  function buildThemes(groupCount) {
    const suitKeys = shuffle(Object.keys(SUITS));
    const themeCount = Math.min(3, Math.max(2, Math.round(groupCount / 5)));
    const themes = [];

    for (let index = 0; index < themeCount; index += 1) {
      const suit = suitKeys[index % suitKeys.length];
      const edgeBias = index === 0 && Math.random() < 0.65;
      const center = edgeBias ? randomChoice([2, 3, 7, 8]) : randomInt(2, 8);
      const spread = edgeBias ? 3 : 2;
      const startMin = Math.max(1, center - spread);
      const startMax = Math.min(7, center);
      const tripletMin = Math.max(1, center - 2);
      const tripletMax = Math.min(9, center + 2);
      themes.push({
        suit,
        straightStarts: Array.from({ length: startMax - startMin + 1 }, (_, offset) => startMin + offset),
        tripletRanks: Array.from({ length: tripletMax - tripletMin + 1 }, (_, offset) => tripletMin + offset),
      });
    }

    return themes;
  }

  function weaveGroups(groups) {
    const orderStyle = Math.random();
    if (orderStyle < 0.34) {
      return shuffle(groups).flatMap((group) => group);
    }

    const arranged = shuffle(groups);
    const bag = [];

    if (orderStyle < 0.67) {
      for (let step = 0; step < 3; step += 1) {
        arranged.forEach((group) => bag.push(group[step]));
      }
      return bag;
    }

    const firstPass = shuffle(arranged.map((group) => group[0]));
    const secondPass = shuffle(arranged.map((group) => group[1]));
    const thirdPass = shuffle(arranged.map((group) => group[2]));
    return firstPass.concat(secondPass, thirdPass);
  }

  function sameTile(a, b) {
    return a.suit === b.suit && a.rank === b.rank;
  }

  function isTriplet(tiles) {
    return tiles.length === 3 && tiles.every((tile) => sameTile(tile, tiles[0]));
  }

  function isStraight(tiles) {
    if (tiles.length !== 3) return false;
    if (!tiles.every((tile) => tile.suit === tiles[0].suit)) return false;
    const ranks = tiles.map((tile) => tile.rank).sort((a, b) => a - b);
    return ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2];
  }

  function canEnterSingle(existingTile, incomingTile) {
    if (sameTile(existingTile, incomingTile)) return true;
    return existingTile.suit === incomingTile.suit && Math.abs(existingTile.rank - incomingTile.rank) === 1;
  }

  function canEnterPair(existingTiles, incomingTile) {
    const first = existingTiles[0];
    const second = existingTiles[1];
    if (sameTile(first, second)) {
      return sameTile(first, incomingTile);
    }
    const sameSuit = first.suit === second.suit && first.suit === incomingTile.suit;
    if (!sameSuit) return false;
    const minRank = Math.min(first.rank, second.rank);
    const maxRank = Math.max(first.rank, second.rank);
    const diff = Math.abs(first.rank - second.rank);
    if (diff === 1) return incomingTile.rank === minRank - 1 || incomingTile.rank === maxRank + 1;
    if (diff === 2) return Math.abs(incomingTile.rank - first.rank) === 1 && Math.abs(incomingTile.rank - second.rank) === 1;
    return false;
  }

  function canEnterZone(existingTiles, incomingTile) {
    if (existingTiles.length === 0) return true;
    if (existingTiles.length === 1) return canEnterSingle(existingTiles[0], incomingTile);
    if (existingTiles.length === 2) return canEnterPair(existingTiles, incomingTile);
    return false;
  }

  function simulateLevel(tileBag) {
    const zones = Array.from({ length: 6 }, () => []);
    const holding = [];
    const resolvingZones = new Set();
    const stats = {
      solvable: false,
      maxHolding: 0,
      holdEvents: 0,
      autoMovesFromHolding: 0,
      directClears: 0,
      delayedClears: 0,
      progressPlacements: 0,
      emptyPlacements: 0,
    };

    function compactZone(zoneIndex) {
      zones[zoneIndex] = zones[zoneIndex].filter(Boolean);
    }

    function removeZoneTiles(removals) {
      removals.forEach(({ zoneIndex, slotIndex }) => {
        if (!zones[zoneIndex][slotIndex]) return;
        zones[zoneIndex][slotIndex] = null;
      });
      removals.forEach(({ zoneIndex }) => compactZone(zoneIndex));
    }

    function tryBorrowPairForClear(zoneIndex) {
      const targetTiles = zones[zoneIndex];
      if (targetTiles.length !== 1) return false;

      const looseTiles = [];
      zones.forEach((zone, otherZoneIndex) => {
        if (otherZoneIndex === zoneIndex) return;
        zone.forEach((tile, slotIndex) => {
          if (!tile) return;
          looseTiles.push({
            zoneIndex: otherZoneIndex,
            slotIndex,
            tileCount: zone.length,
            tile,
          });
        });
      });

      const candidates = [];
      for (let firstIndex = 0; firstIndex < looseTiles.length - 1; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < looseTiles.length; secondIndex += 1) {
          const first = looseTiles[firstIndex];
          const second = looseTiles[secondIndex];
          const merged = targetTiles.concat([first.tile, second.tile]);
          if (!isTriplet(merged) && !isStraight(merged)) continue;
          candidates.push({
            first,
            second,
            sameSource: first.zoneIndex === second.zoneIndex,
            disruption: first.tileCount + second.tileCount,
          });
        }
      }

      if (candidates.length === 0) return false;

      candidates.sort(
        (a, b) =>
          Number(b.sameSource) - Number(a.sameSource) ||
          a.disruption - b.disruption ||
          a.first.zoneIndex - b.first.zoneIndex ||
          a.first.slotIndex - b.first.slotIndex
      );

      const picked = candidates[0];
      const firstTile = zones[picked.first.zoneIndex][picked.first.slotIndex];
      const secondTile = zones[picked.second.zoneIndex][picked.second.slotIndex];
      if (!firstTile || !secondTile) return false;

      removeZoneTiles([
        { zoneIndex: picked.first.zoneIndex, slotIndex: picked.first.slotIndex },
        { zoneIndex: picked.second.zoneIndex, slotIndex: picked.second.slotIndex },
      ]);

      zones[zoneIndex].push(firstTile, secondTile);
      return true;
    }

    function tryBorrowForClear(zoneIndex) {
      const targetTiles = zones[zoneIndex];
      if (targetTiles.length !== 2) return false;

      const candidates = [];
      zones.forEach((zone, otherZoneIndex) => {
        if (otherZoneIndex === zoneIndex) return;
        zone.forEach((tile, slotIndex) => {
          if (!tile) return;
          const merged = targetTiles.concat([tile]);
          if (!isTriplet(merged) && !isStraight(merged)) return;
          candidates.push({
            fromZoneIndex: otherZoneIndex,
            fromSlotIndex: slotIndex,
            tileCount: zone.length,
          });
        });
      });

      if (candidates.length === 0) return false;

      candidates.sort((a, b) => a.tileCount - b.tileCount || a.fromZoneIndex - b.fromZoneIndex || a.fromSlotIndex - b.fromSlotIndex);
      const picked = candidates[0];
      const tile = zones[picked.fromZoneIndex][picked.fromSlotIndex];
      if (!tile) return false;

      zones[picked.fromZoneIndex][picked.fromSlotIndex] = null;
      compactZone(picked.fromZoneIndex);
      zones[zoneIndex].push(tile);
      return true;
    }

    function tryZoneCrossBorrow(zoneIndex) {
      let moved = false;
      let changed = true;
      while (changed) {
        changed = false;
        if (tryBorrowPairForClear(zoneIndex)) {
          moved = true;
          changed = true;
          continue;
        }
        if (tryBorrowForClear(zoneIndex)) {
          moved = true;
          changed = true;
        }
      }
      return moved;
    }

    function tryResolveZone(zoneIndex) {
      if (resolvingZones.has(zoneIndex)) return;
      resolvingZones.add(zoneIndex);
      try {
        tryZoneCrossBorrow(zoneIndex);

        let moved = true;
        while (moved) {
          moved = false;
          const zone = zones[zoneIndex];
          if (zone.length >= 3) break;
          const holdingIndex = holding.findIndex((tile) => canEnterZone(zone, tile));
          if (holdingIndex !== -1) {
            zone.push(holding.splice(holdingIndex, 1)[0]);
            stats.autoMovesFromHolding += 1;
            tryZoneCrossBorrow(zoneIndex);
            moved = true;
          }
        }

        const zone = zones[zoneIndex];
        if (zone.length === 3 && (isTriplet(zone) || isStraight(zone))) {
          zone.length = 0;
          stats.delayedClears += 1;
        }
      } finally {
        resolvingZones.delete(zoneIndex);
      }
    }

    for (const tile of tileBag) {
      const directClear = [];
      const progressZones = [];
      const emptyZones = [];

      zones.forEach((zone, zoneIndex) => {
        if (zone.length >= 3) return;
        if (!canEnterZone(zone, tile)) {
          if (zone.length === 0) emptyZones.push(zoneIndex);
          return;
        }
        if (zone.length === 2 && (isTriplet(zone.concat([tile])) || isStraight(zone.concat([tile])))) {
          directClear.push(zoneIndex);
        } else if (zone.length > 0) {
          progressZones.push(zoneIndex);
        } else {
          emptyZones.push(zoneIndex);
        }
      });

      let target = null;
      if (directClear.length > 0) {
        target = directClear[0];
        stats.directClears += 1;
      } else if (progressZones.length > 0) {
        target = progressZones[0];
        stats.progressPlacements += 1;
      } else if (emptyZones.length > 0) {
        target = emptyZones[0];
        stats.emptyPlacements += 1;
      }

      if (target === null) {
        holding.push(tile);
        stats.holdEvents += 1;
        stats.maxHolding = Math.max(stats.maxHolding, holding.length);
        if (holding.length > GAME_CONFIG.holdingLimit) return stats;
        continue;
      }

      zones[target].push(tile);
      tryResolveZone(target);
    }

    stats.maxHolding = Math.max(stats.maxHolding, holding.length);
    stats.solvable = zones.every((zone) => zone.length === 0) && holding.length === 0;
    return stats;
  }

  function scoreLevel(stats) {
    if (!stats.solvable) return -Infinity;
    return (
      stats.maxHolding * 140 +
      stats.holdEvents * 18 +
      stats.autoMovesFromHolding * 24 +
      stats.progressPlacements * 4 -
      stats.directClears * 6 -
      stats.emptyPlacements * 2
    );
  }

  function buildCandidateGroups(groupCount) {
    const themes = buildThemes(groupCount);
    const groups = [];
    for (let index = 0; index < groupCount; index += 1) {
      const theme = themes[index % themes.length];
      const useStraight = Math.random() < 0.72;
      groups.push(useStraight ? createStraight(theme) : createTriplet(theme));
    }
    return shuffle(groups);
  }

  function getTopPositions() {
    const rowOffsetPattern = [-18, 14, -10, 18, -14, 10];
    const colJitterPattern = [0, -10, 8, -6, 10, -8, 6];
    return topLayout.flatMap((row, rowIndex) =>
      row.map((x, colIndex) => ({
        rowIndex,
        colIndex,
        x: x + rowOffsetPattern[rowIndex % rowOffsetPattern.length] + colJitterPattern[colIndex % colJitterPattern.length],
        y: 132 + rowIndex * 72,
      }))
    );
  }

  function buildTileBatch(positions, batchKey, options = {}) {
    const count = positions.length;
    if (count === 0) return [];
    const minGroups = Math.ceil(count / 3);
    const groups = buildCandidateGroups(minGroups);
    const tileBag = weaveGroups(groups).slice(0, count);

    return positions.map((position, index) => {
      const tile = tileBag[index];
      return {
        id: `${batchKey}_tile_${position.rowIndex + 1}_${position.colIndex + 1}_${index + 1}`,
        x: position.x,
        y: position.y,
        suit: tile.suit,
        rank: tile.rank,
        width: GAME_CONFIG.tileWidth,
        height: GAME_CONFIG.tileHeight,
        rowIndex: position.rowIndex,
        colIndex: position.colIndex,
        batchKey,
        refill: Boolean(options.refill),
      };
    });
  }

  function buildSolvableLevelTiles() {
    const positions = getTopPositions();
    const totalSlots = positions.length;
    const groupCount = Math.floor(totalSlots / 3);
    let bestBag = null;
    let bestScore = -Infinity;

    for (let safety = 0; safety < 520; safety += 1) {
      const groups = buildCandidateGroups(groupCount);
      const tileBag = weaveGroups(groups);
      const stats = simulateLevel(tileBag);
      const score = scoreLevel(stats);
      if (score > bestScore) {
        bestScore = score;
        bestBag = tileBag;
      }
    }

    if (!bestBag) {
      for (let safety = 0; safety < 1200 && !bestBag; safety += 1) {
        const tileBag = weaveGroups(buildCandidateGroups(groupCount));
        if (simulateLevel(tileBag).solvable) {
          bestBag = tileBag;
        }
      }
    }

    const tileBag = bestBag || shuffle(buildCandidateGroups(groupCount)).flatMap((group) => group);
    return positions.map((position, index) => ({
      id: `tile_${position.rowIndex + 1}_${position.colIndex + 1}`,
      x: position.x,
      y: position.y,
      suit: tileBag[index].suit,
      rank: tileBag[index].rank,
      width: GAME_CONFIG.tileWidth,
      height: GAME_CONFIG.tileHeight,
      rowIndex: position.rowIndex,
      colIndex: position.colIndex,
      batchKey: "initial",
    }));
  }

  const INITIAL_TILES = buildSolvableLevelTiles();

  const LAYOUT = {
    topZoneBottom: 560,
    funnelTopY: 570,
    funnelBottomY: 820,
    funnelExitWidth: 110,
    funnelMouthWidth: 560,
    funnelWalls: {
      left: { x: -200, y: 150, length: 700, thickness: 10, angle: Math.PI * 0.21 },
      right: { x: 200, y: 150, length: 700, thickness: 10, angle: -Math.PI * 0.21 },
    },
    holdingArea: {
      x: 182,
      y: 848,
      width: 386,
      height: 96,
      slotGap: 14,
      insetX: 23,
    },
    meldArea: {
      top: 972,
      left: 60,
      zoneWidth: 196,
      zoneHeight: 146,
      gapX: 18,
      gapY: 22,
      slotGap: 12,
      slotInsetX: 14,
    },
  };

  MahjongDrop.VIEWPORT = VIEWPORT;
  MahjongDrop.SUITS = SUITS;
  MahjongDrop.GAME_CONFIG = GAME_CONFIG;
  MahjongDrop.INITIAL_TILES = INITIAL_TILES;
  MahjongDrop.TOP_POSITIONS = getTopPositions();
  MahjongDrop.buildTileBatch = buildTileBatch;
  MahjongDrop.LAYOUT = LAYOUT;
})();
