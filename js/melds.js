(function () {
  const MahjongDrop = (window.MahjongDrop = window.MahjongDrop || {});
  const { GAME_CONFIG, LAYOUT, tileKey } = MahjongDrop;

  function cloneTile(tile) {
    return {
      id: tile.id,
      suit: tile.suit,
      rank: tile.rank,
      width: GAME_CONFIG.tileWidth,
      height: GAME_CONFIG.tileHeight,
    };
  }

  function isTriplet(tiles) {
    return tiles.length === 3 && tiles.every((tile) => tileKey(tile) === tileKey(tiles[0]));
  }

  function isStraight(tiles) {
    if (tiles.length !== 3) return false;
    const sameSuit = tiles.every((tile) => tile.suit === tiles[0].suit);
    if (!sameSuit) return false;
    const ranks = tiles.map((tile) => tile.rank).sort((a, b) => a - b);
    return ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2];
  }

  function canEnterSingle(existingTile, incomingTile) {
    if (tileKey(existingTile) === tileKey(incomingTile)) return true;
    return existingTile.suit === incomingTile.suit && Math.abs(existingTile.rank - incomingTile.rank) === 1;
  }

  function canEnterPair(existingTiles, incomingTile) {
    const first = existingTiles[0];
    const second = existingTiles[1];
    const sameAsPair = tileKey(first) === tileKey(second);
    if (sameAsPair) {
      return tileKey(first) === tileKey(incomingTile);
    }

    const sameSuit = first.suit === second.suit && first.suit === incomingTile.suit;
    if (!sameSuit) return false;

    const minRank = Math.min(first.rank, second.rank);
    const maxRank = Math.max(first.rank, second.rank);
    const diff = Math.abs(first.rank - second.rank);

    if (diff === 1) {
      return incomingTile.rank === minRank - 1 || incomingTile.rank === maxRank + 1;
    }

    if (diff === 2) {
      return Math.abs(incomingTile.rank - first.rank) === 1 && Math.abs(incomingTile.rank - second.rank) === 1;
    }

    return false;
  }

  function canEnterZone(existingTiles, incomingTile) {
    if (existingTiles.length === 0) return true;
    if (existingTiles.length === 1) return canEnterSingle(existingTiles[0], incomingTile);
    if (existingTiles.length === 2) return canEnterPair(existingTiles, incomingTile);
    return false;
  }

  function buildCounts(tiles) {
    const counts = {
      bamboo: Array(10).fill(0),
      dots: Array(10).fill(0),
      chars: Array(10).fill(0),
    };
    tiles.forEach((tile) => {
      counts[tile.suit][tile.rank] += 1;
    });
    return counts;
  }

  function cloneCounts(counts) {
    return {
      bamboo: counts.bamboo.slice(),
      dots: counts.dots.slice(),
      chars: counts.chars.slice(),
    };
  }

  function encodeCounts(counts) {
    return ["bamboo", "dots", "chars"]
      .map((suit) => counts[suit].slice(1).join(""))
      .join("|");
  }

  function findGlobalMeldPlan(counts, memo = new Map()) {
    const key = encodeCounts(counts);
    if (memo.has(key)) return memo.get(key);

    let suitKey = null;
    let rank = 0;
    for (const candidateSuit of ["bamboo", "dots", "chars"]) {
      for (let candidateRank = 1; candidateRank <= 9; candidateRank += 1) {
        if (counts[candidateSuit][candidateRank] > 0) {
          suitKey = candidateSuit;
          rank = candidateRank;
          break;
        }
      }
      if (suitKey) break;
    }

    if (!suitKey) {
      memo.set(key, []);
      return [];
    }

    const sameCounts = counts[suitKey][rank];
    if (sameCounts >= 3) {
      const nextCounts = cloneCounts(counts);
      nextCounts[suitKey][rank] -= 3;
      const remainder = findGlobalMeldPlan(nextCounts, memo);
      if (remainder) {
        const result = [[
          { suit: suitKey, rank },
          { suit: suitKey, rank },
          { suit: suitKey, rank },
        ]].concat(remainder);
        memo.set(key, result);
        return result;
      }
    }

    if (rank <= 7 && counts[suitKey][rank + 1] > 0 && counts[suitKey][rank + 2] > 0) {
      const nextCounts = cloneCounts(counts);
      nextCounts[suitKey][rank] -= 1;
      nextCounts[suitKey][rank + 1] -= 1;
      nextCounts[suitKey][rank + 2] -= 1;
      const remainder = findGlobalMeldPlan(nextCounts, memo);
      if (remainder) {
        const result = [[
          { suit: suitKey, rank },
          { suit: suitKey, rank: rank + 1 },
          { suit: suitKey, rank: rank + 2 },
        ]].concat(remainder);
        memo.set(key, result);
        return result;
      }
    }

    memo.set(key, null);
    return null;
  }

  class MeldSystem {
    constructor(effects) {
      this.effects = effects;
      this.reset();
    }

    reset() {
      this.failed = false;
      this.resolvingZones = new Set();
      this.zones = Array.from({ length: 6 }, (_, zoneIndex) => ({
        id: `zone_${zoneIndex}`,
        slots: [null, null, null],
      }));
      this.holding = [];
    }

    getZoneRect(zoneIndex) {
      const row = Math.floor(zoneIndex / 3);
      const col = zoneIndex % 3;
      const area = LAYOUT.meldArea;
      return {
        x: area.left + col * (area.zoneWidth + area.gapX),
        y: area.top + row * (area.zoneHeight + area.gapY),
        width: area.zoneWidth,
        height: area.zoneHeight,
      };
    }

    getSlotRect(zoneIndex, slotIndex) {
      const zoneRect = this.getZoneRect(zoneIndex);
      return {
        x: zoneRect.x + LAYOUT.meldArea.slotInsetX + slotIndex * (GAME_CONFIG.tileWidth + LAYOUT.meldArea.slotGap),
        y: zoneRect.y + 48,
        width: GAME_CONFIG.tileWidth,
        height: GAME_CONFIG.tileHeight,
      };
    }

    getHoldingRect() {
      return { ...LAYOUT.holdingArea };
    }

    getHoldingSlotRect(slotIndex) {
      return {
        x: LAYOUT.holdingArea.x + LAYOUT.holdingArea.insetX + slotIndex * (GAME_CONFIG.tileWidth + LAYOUT.holdingArea.slotGap),
        y: LAYOUT.holdingArea.y + 18,
        width: GAME_CONFIG.tileWidth,
        height: GAME_CONFIG.tileHeight,
      };
    }

    routeTile(tile) {
      const incoming = cloneTile(tile);
      const directClear = [];
      const progressZones = [];
      const emptyZones = [];

      this.zones.forEach((zone, zoneIndex) => {
        const tiles = zone.slots.filter(Boolean);
        const freeIndex = zone.slots.findIndex((slot) => !slot);
        if (freeIndex === -1) return;
        if (!canEnterZone(tiles, incoming)) {
          if (tiles.length === 0) {
            emptyZones.push({ zoneIndex, freeIndex });
          }
          return;
        }

        if (tiles.length === 2 && (isTriplet(tiles.concat([incoming])) || isStraight(tiles.concat([incoming])))) {
          directClear.push({ zoneIndex, freeIndex });
          return;
        }

        if (tiles.length > 0) {
          progressZones.push({ zoneIndex, freeIndex, tileCount: tiles.length });
          return;
        }

        emptyZones.push({ zoneIndex, freeIndex });
      });

      let target = null;
      if (directClear.length > 0) {
        target = directClear[0];
      } else if (progressZones.length > 0) {
        progressZones.sort((a, b) => b.tileCount - a.tileCount || a.zoneIndex - b.zoneIndex);
        target = progressZones[0];
      } else if (emptyZones.length > 0) {
        target = emptyZones[0];
      }

      if (!target) {
        this.pushHolding(incoming);
        return { placement: null, held: true };
      }

      const placement = this.placeIntoZone(target.zoneIndex, target.freeIndex, incoming, { x: tile.x, y: tile.y });
      this.tryResolveZone(target.zoneIndex);
      return { placement, held: false };
    }

    placeIntoZone(zoneIndex, freeIndex, tile, fromPoint) {
      const zoneTile = cloneTile(tile);
      const rect = this.getSlotRect(zoneIndex, freeIndex);
      zoneTile.x = rect.x + rect.width / 2;
      zoneTile.y = rect.y + rect.height / 2;
      this.zones[zoneIndex].slots[freeIndex] = zoneTile;
      this.effects.startPlace(zoneTile, fromPoint, { x: zoneTile.x, y: zoneTile.y });
      return { zoneIndex, freeIndex, tile: zoneTile };
    }

    compactZone(zoneIndex) {
      const zone = this.zones[zoneIndex];
      const tiles = zone.slots.filter(Boolean);
      zone.slots = [null, null, null];
      tiles.forEach((tile, slotIndex) => {
        const rect = this.getSlotRect(zoneIndex, slotIndex);
        tile.x = rect.x + rect.width / 2;
        tile.y = rect.y + rect.height / 2;
        zone.slots[slotIndex] = tile;
      });
    }

    removeZoneTiles(removals) {
      const dirtyZones = new Set();
      removals.forEach(({ zoneIndex, slotIndex }) => {
        if (!this.zones[zoneIndex].slots[slotIndex]) return;
        this.zones[zoneIndex].slots[slotIndex] = null;
        dirtyZones.add(zoneIndex);
      });
      dirtyZones.forEach((zoneIndex) => this.compactZone(zoneIndex));
      return Array.from(dirtyZones);
    }

    tryBorrowPairForClear(zoneIndex) {
      const zone = this.zones[zoneIndex];
      const targetTiles = zone.slots.filter(Boolean);
      if (targetTiles.length !== 1) return false;

      const looseTiles = [];
      this.zones.forEach((otherZone, otherZoneIndex) => {
        if (otherZoneIndex === zoneIndex) return;
        const tileCount = otherZone.slots.filter(Boolean).length;
        otherZone.slots.forEach((tile, slotIndex) => {
          if (!tile) return;
          looseTiles.push({
            zoneIndex: otherZoneIndex,
            slotIndex,
            tileCount,
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
          const sameSource = first.zoneIndex === second.zoneIndex;
          const disruption = first.tileCount + second.tileCount;
          candidates.push({
            first,
            second,
            sameSource,
            disruption,
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
      const firstTile = this.zones[picked.first.zoneIndex].slots[picked.first.slotIndex];
      const secondTile = this.zones[picked.second.zoneIndex].slots[picked.second.slotIndex];
      if (!firstTile || !secondTile) return false;

      const firstFrom = { x: firstTile.x, y: firstTile.y };
      const secondFrom = { x: secondTile.x, y: secondTile.y };
      this.removeZoneTiles([
        { zoneIndex: picked.first.zoneIndex, slotIndex: picked.first.slotIndex },
        { zoneIndex: picked.second.zoneIndex, slotIndex: picked.second.slotIndex },
      ]);

      let freeIndex = zone.slots.findIndex((slot) => !slot);
      this.placeIntoZone(zoneIndex, freeIndex, firstTile, firstFrom);
      freeIndex = this.zones[zoneIndex].slots.findIndex((slot) => !slot);
      this.placeIntoZone(zoneIndex, freeIndex, secondTile, secondFrom);
      return true;
    }

    tryBorrowForClear(zoneIndex) {
      const zone = this.zones[zoneIndex];
      const targetTiles = zone.slots.filter(Boolean);
      if (targetTiles.length !== 2) return false;

      const candidates = [];
      this.zones.forEach((otherZone, otherZoneIndex) => {
        if (otherZoneIndex === zoneIndex) return;
        otherZone.slots.forEach((tile, slotIndex) => {
          if (!tile) return;
          const merged = targetTiles.concat([tile]);
          if (isTriplet(merged) || isStraight(merged)) {
            candidates.push({
              fromZoneIndex: otherZoneIndex,
              fromSlotIndex: slotIndex,
              tileCount: otherZone.slots.filter(Boolean).length,
              tile,
            });
          }
        });
      });

      if (candidates.length === 0) return false;

      candidates.sort((a, b) => a.tileCount - b.tileCount || a.fromZoneIndex - b.fromZoneIndex || a.fromSlotIndex - b.fromSlotIndex);
      const picked = candidates[0];
      const donorZone = this.zones[picked.fromZoneIndex];
      const movingTile = donorZone.slots[picked.fromSlotIndex];
      if (!movingTile) return false;

      const from = { x: movingTile.x, y: movingTile.y };
      donorZone.slots[picked.fromSlotIndex] = null;
      this.compactZone(picked.fromZoneIndex);

      const freeIndex = zone.slots.findIndex((slot) => !slot);
      if (freeIndex === -1) return false;

      this.placeIntoZone(zoneIndex, freeIndex, movingTile, from);
      return true;
    }

    tryZoneCrossBorrow(zoneIndex) {
      let moved = false;
      let changed = true;
      while (changed) {
        changed = false;
        if (this.tryBorrowPairForClear(zoneIndex)) {
          moved = true;
          changed = true;
          continue;
        }
        if (this.tryBorrowForClear(zoneIndex)) {
          moved = true;
          changed = true;
        }
      }
      return moved;
    }

    tryResolveZone(zoneIndex) {
      if (this.resolvingZones.has(zoneIndex)) return;
      this.resolvingZones.add(zoneIndex);
      const zone = this.zones[zoneIndex];
      try {
        this.tryZoneCrossBorrow(zoneIndex);

        let moved = true;
        while (moved) {
          moved = false;
          const currentTiles = zone.slots.filter(Boolean);
          const freeIndex = zone.slots.findIndex((slot) => !slot);
          if (freeIndex === -1) break;

          const holdingIndex = this.holding.findIndex((holdingTile) => canEnterZone(currentTiles, holdingTile));
          if (holdingIndex !== -1) {
            const holdingTile = this.holding.splice(holdingIndex, 1)[0];
            const from = { x: holdingTile.x, y: holdingTile.y };
            this.refreshHoldingPositions();
            this.placeIntoZone(zoneIndex, freeIndex, holdingTile, from);
            this.tryZoneCrossBorrow(zoneIndex);
            moved = true;
          }
        }

        const finalTiles = zone.slots.filter(Boolean);
        if (finalTiles.length === 3 && (isTriplet(finalTiles) || isStraight(finalTiles))) {
          this.effects.startClear(finalTiles.map((tile, slotIndex) => ({
            ...tile,
            zoneIndex,
            slotIndex,
            x: tile.x,
            y: tile.y,
          })));
          this.zones[zoneIndex].slots = [null, null, null];
        }
      } finally {
        this.resolvingZones.delete(zoneIndex);
      }
    }

    pushHolding(tile) {
      const holdingTile = cloneTile(tile);
      this.holding.push(holdingTile);
      this.refreshHoldingPositions();
      if (this.holding.length > GAME_CONFIG.holdingLimit) {
        this.failed = true;
      }
    }

    refreshHoldingPositions() {
      this.holding.forEach((tile, index) => {
        const rect = this.getHoldingSlotRect(index);
        tile.x = rect.x + rect.width / 2;
        tile.y = rect.y + rect.height / 2;
      });
    }

    getRemainingZones() {
      return this.zones.filter((zone) => zone.slots.some((slot) => slot)).length;
    }

    getAllRemainingTiles() {
      return this.zones.flatMap((zone) => zone.slots.filter(Boolean)).concat(this.holding);
    }

    tryGlobalCleanup() {
      const tiles = this.getAllRemainingTiles();
      if (tiles.length === 0 || tiles.length % 3 !== 0) return false;

      const plan = findGlobalMeldPlan(buildCounts(tiles));
      if (!plan) return false;

      const tilePools = new Map();
      tiles.forEach((tile) => {
        const key = tileKey(tile);
        if (!tilePools.has(key)) tilePools.set(key, []);
        tilePools.get(key).push(tile);
      });

      plan.forEach((meld) => {
        const clearTiles = meld.map((pattern) => {
          const pool = tilePools.get(tileKey(pattern));
          return pool?.shift();
        }).filter(Boolean);
        if (clearTiles.length === 3) {
          this.effects.startClear(clearTiles.map((tile) => ({
            ...tile,
            x: tile.x,
            y: tile.y,
          })));
        }
      });

      this.zones.forEach((zone) => {
        zone.slots = [null, null, null];
      });
      this.holding = [];
      return true;
    }

    isEmpty() {
      return this.zones.every((zone) => zone.slots.every((slot) => !slot)) && this.holding.length === 0;
    }
  }

  MahjongDrop.MeldSystem = MeldSystem;
})();
