(function () {
  const MahjongDrop = (window.MahjongDrop = window.MahjongDrop || {});
  const { GAME_CONFIG, INITIAL_TILES, LAYOUT, TOP_POSITIONS, VIEWPORT, buildTileBatch, pointInRect } = MahjongDrop;
  const { Bodies, Body, Composite, Engine, Events, World } = Matter;

  class PhysicsSystem {
    constructor() {
      this.engine = null;
      this.world = null;
      this.tileMap = new Map();
      this.funnelSensor = null;
      this.funnelSegments = [];
      this.onTileExit = null;
      this.refillSpawned = false;
      this.refillBatchIndex = 0;
    }

    setup(onTileExit) {
      this.onTileExit = onTileExit;
      this.engine = Engine.create({
        gravity: { x: 0, y: GAME_CONFIG.physics.gravityY, scale: GAME_CONFIG.physics.engineScale },
      });
      this.world = this.engine.world;
      this.tileMap.clear();
      this.refillSpawned = false;
      this.refillBatchIndex = 0;
      this.createBounds();
      this.createTiles();
      this.createFunnel();
      Events.on(this.engine, "collisionStart", (event) => this.handleCollisionStart(event));
    }

    reset(onTileExit) {
      if (this.engine) {
        Composite.clear(this.engine.world, false);
        Engine.clear(this.engine);
      }
      this.setup(onTileExit);
    }

    createBounds() {
      const bodies = [
        Bodies.rectangle(VIEWPORT.width / 2, VIEWPORT.height + 40, VIEWPORT.width + 100, 80, { isStatic: true }),
        Bodies.rectangle(-35, VIEWPORT.height / 2, 70, VIEWPORT.height, { isStatic: true }),
        Bodies.rectangle(VIEWPORT.width + 35, VIEWPORT.height / 2, 70, VIEWPORT.height, { isStatic: true }),
      ];
      World.add(this.world, bodies);
    }

    createTiles() {
      this.addTileBatch(INITIAL_TILES);
    }

    addTileBatch(tiles, options = {}) {
      tiles.forEach((tile) => {
        const startY = options.spawning ? tile.y - GAME_CONFIG.refillDropDistance - tile.rowIndex * 18 : tile.y;
        const body = Bodies.rectangle(tile.x, startY, tile.width, tile.height, {
          isStatic: true,
          restitution: GAME_CONFIG.physics.restitution,
          friction: GAME_CONFIG.physics.friction,
          frictionAir: GAME_CONFIG.physics.airFriction,
          chamfer: { radius: 8 },
        });
        body.label = "topTile";
        body.plugin = { tileId: tile.id };
        this.tileMap.set(tile.id, {
          ...tile,
          state: options.spawning ? "spawning" : "idle",
          targetX: tile.x,
          targetY: tile.y,
          body,
        });
        World.add(this.world, body);
      });
    }

    startSqueezeShift(idleTiles, rowsToSpawn) {
      const rowOrder = Array.from(new Set(idleTiles.map((tile) => tile.rowIndex))).sort((a, b) => a - b);
      const rowGroups = new Map();
      TOP_POSITIONS.forEach((position) => {
        if (!rowGroups.has(position.rowIndex)) rowGroups.set(position.rowIndex, []);
        rowGroups.get(position.rowIndex).push(position);
      });
      rowGroups.forEach((positions) => positions.sort((a, b) => a.x - b.x));
      const maxRowIndex = TOP_POSITIONS.reduce((maxRow, position) => Math.max(maxRow, position.rowIndex), 0);
      const targetStartRow = maxRowIndex - rowOrder.length + 1;

      rowOrder.forEach((sourceRowIndex, orderIndex) => {
        const targetRowIndex = targetStartRow + orderIndex;
        const targetPositions = (rowGroups.get(targetRowIndex) || []).slice();
        idleTiles
          .filter((tile) => tile.rowIndex === sourceRowIndex)
          .sort((a, b) => a.body.position.x - b.body.position.x)
          .forEach((tile, tileIndex) => {
            const targetPosition = targetPositions[tileIndex] || targetPositions[targetPositions.length - 1];
            tile.state = "shifting";
            tile.rowIndex = targetRowIndex;
            tile.colIndex = tileIndex;
            tile.targetX = targetPosition ? targetPosition.x : tile.body.position.x;
            tile.targetY = targetPosition ? targetPosition.y : tile.body.position.y;
          });
      });

      const refillPositions = TOP_POSITIONS.filter((position) => position.rowIndex < rowsToSpawn);
      if (refillPositions.length === 0) return;
      this.refillBatchIndex += 1;
      this.addTileBatch(buildTileBatch(refillPositions, `refill_${this.refillBatchIndex}`, { refill: true }), { spawning: true });
    }

    maybeSpawnRefillBatch() {
      if (this.refillSpawned) return;
      const idleTiles = Array.from(this.tileMap.values()).filter((tile) => tile.state === "idle");
      const remainingRows = new Set(idleTiles.map((tile) => tile.rowIndex));
      if (remainingRows.size === 0 || remainingRows.size > GAME_CONFIG.refillTriggerRows) return;
      const rowsToSpawn = TOP_POSITIONS.reduce((maxRow, position) => Math.max(maxRow, position.rowIndex), 0) + 1 - remainingRows.size;
      if (rowsToSpawn <= 0) return;

      this.startSqueezeShift(idleTiles, rowsToSpawn);
      this.refillSpawned = true;
    }

    createFunnel() {
      const centerX = VIEWPORT.width / 2;
      const leftCfg = LAYOUT.funnelWalls.left;
      const rightCfg = LAYOUT.funnelWalls.right;
      const leftWall = Bodies.rectangle(centerX + leftCfg.x, LAYOUT.funnelTopY + leftCfg.y, leftCfg.length, leftCfg.thickness, {
        isStatic: true,
        angle: leftCfg.angle,
        chamfer: { radius: 10 },
      });
      const rightWall = Bodies.rectangle(centerX + rightCfg.x, LAYOUT.funnelTopY + rightCfg.y, rightCfg.length, rightCfg.thickness, {
        isStatic: true,
        angle: rightCfg.angle,
        chamfer: { radius: 10 },
      });
      const sensor = Bodies.rectangle(centerX, LAYOUT.funnelBottomY + 36, LAYOUT.funnelExitWidth, 28, {
        isStatic: true,
        isSensor: true,
        label: "funnelSensor",
      });
      this.funnelSensor = sensor;
      this.funnelSegments = [
        { x: leftWall.position.x, y: leftWall.position.y, angle: leftWall.angle, width: leftCfg.length, height: leftCfg.thickness },
        { x: rightWall.position.x, y: rightWall.position.y, angle: rightWall.angle, width: rightCfg.length, height: rightCfg.thickness },
      ];
      World.add(this.world, [leftWall, rightWall, sensor]);
    }

    handleCollisionStart(event) {
      event.pairs.forEach((pair) => {
        const tileBody = pair.bodyA.label === "topTile" ? pair.bodyA : pair.bodyB.label === "topTile" ? pair.bodyB : null;
        const sensorBody = pair.bodyA.label === "funnelSensor" ? pair.bodyA : pair.bodyB.label === "funnelSensor" ? pair.bodyB : null;
        if (!tileBody || !sensorBody) return;
        const tile = this.tileMap.get(tileBody.plugin.tileId);
        if (!tile || (tile.state !== "falling" && tile.state !== "funnel")) return;
        World.remove(this.world, tile.body);
        this.tileMap.delete(tile.id);
        this.onTileExit?.({
          id: tile.id,
          suit: tile.suit,
          rank: tile.rank,
          width: tile.width,
          height: tile.height,
          x: tile.body.position.x,
          y: tile.body.position.y,
        });
      });
    }

    activateTileAt(point) {
      const idleTiles = Array.from(this.tileMap.values()).filter((tile) => tile.state === "idle").reverse();
      const target = idleTiles.find((tile) => pointInRect(point.x, point.y, tile.body.position.x, tile.body.position.y, tile.width, tile.height));
      if (!target) return null;
      target.state = "falling";
      const oldBody = target.body;
      const body = Bodies.rectangle(oldBody.position.x, oldBody.position.y, target.width, target.height, {
        restitution: GAME_CONFIG.physics.restitution,
        friction: GAME_CONFIG.physics.friction,
        frictionAir: GAME_CONFIG.physics.airFriction,
        chamfer: { radius: 8 },
      });
      body.label = "topTile";
      body.plugin = { tileId: target.id };
      World.remove(this.world, oldBody);
      World.add(this.world, body);
      target.body = body;
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.12, y: 0.08 });
      return target;
    }

    update(deltaMs) {
      if (!this.engine) return;
      Engine.update(this.engine, deltaMs);
      this.tileMap.forEach((tile) => {
        if (tile.state === "spawning" || tile.state === "shifting") {
          const nextX = tile.body.position.x + (tile.targetX - tile.body.position.x) * Math.min(1, deltaMs * 0.014);
          const nextY = Math.min(tile.targetY, tile.body.position.y + deltaMs * GAME_CONFIG.refillDropSpeed);
          Body.setPosition(tile.body, { x: nextX, y: nextY });
          if (Math.abs(nextX - tile.targetX) < 0.8 && nextY >= tile.targetY - 1) {
            Body.setPosition(tile.body, { x: tile.targetX, y: tile.targetY });
            tile.state = "idle";
          }
          return;
        }
        if (tile.state === "falling" && tile.body.position.y > LAYOUT.funnelTopY) tile.state = "funnel";
      });
      this.maybeSpawnRefillBatch();
    }

    getRenderableTiles() {
      return Array.from(this.tileMap.values()).map((tile) => ({
        id: tile.id,
        suit: tile.suit,
        rank: tile.rank,
        width: tile.width,
        height: tile.height,
        x: tile.body.position.x,
        y: tile.body.position.y,
        angle: tile.body.angle,
      }));
    }
  }

  MahjongDrop.PhysicsSystem = PhysicsSystem;
})();
