(function () {
  const MahjongDrop = (window.MahjongDrop = window.MahjongDrop || {});
  const { GAME_CONFIG, EffectsManager, PhysicsSystem, MeldSystem } = MahjongDrop;

  class Game {
    constructor(options) {
      this.canvas = options.canvas;
      this.ui = options.ui;
      this.effects = new EffectsManager();
      this.physics = new PhysicsSystem();
      this.melds = new MeldSystem(this.effects);
      this.renderer = null;
      this.running = false;
      this.won = false;
      this.failed = false;
      this.lastFrameTime = 0;
      this.debug = { sensor: false };
    }

    attachRenderer(renderer) {
      this.renderer = renderer;
      this.renderer.resize();
    }

    start() {
      this.reset();
      this.running = true;
      this.lastFrameTime = performance.now();
      requestAnimationFrame((time) => this.loop(time));
    }

    reset() {
      this.won = false;
      this.failed = false;
      this.effects.reset();
      this.melds.reset();
      this.physics.reset((tile) => this.handleTileExit(tile));
      this.ui.setLevelName(GAME_CONFIG.levelName);
      this.ui.toggleWin(false);
      this.ui.toggleFail(false);
      this.syncHud();
    }

    loop(timestamp) {
      if (!this.running) return;
      const deltaMs = Math.min(timestamp - this.lastFrameTime, 32);
      this.lastFrameTime = timestamp;
      this.update(deltaMs);
      this.render();
      requestAnimationFrame((time) => this.loop(time));
    }

    update(deltaMs) {
      if (!this.failed && !this.won) {
        this.physics.update(1000 / 60);
      }
      this.effects.update(deltaMs);
      if (!this.failed && !this.won && this.physics.tileMap.size === 0 && !this.melds.isEmpty()) {
        this.melds.tryGlobalCleanup();
      }
      if (!this.failed && !this.won && this.melds.failed) {
        this.failed = true;
        this.ui.toggleFail(true);
      }
      if (!this.failed && !this.won && this.physics.tileMap.size === 0 && this.melds.isEmpty()) {
        this.won = true;
        this.ui.toggleWin(true);
      }
      this.syncHud();
    }

    handleTileExit(tile) {
      this.melds.routeTile(tile);
      const latestClear = this.effects.clearEffects[this.effects.clearEffects.length - 1];
      if (latestClear) {
        latestClear.tiles.forEach((clearTile) => {
          const rect = this.melds.getSlotRect(clearTile.zoneIndex, clearTile.slotIndex);
          clearTile.x = rect.x + rect.width / 2;
          clearTile.y = rect.y + rect.height / 2;
        });
      }
    }

    render() {
      const tiles = this.physics.getRenderableTiles();
      this.renderer.setDebug(this.debug);
      this.renderer.render({
        physics: { sensorBounds: this.physics.funnelSensor ? this.physics.funnelSensor.bounds : null },
        melds: this.melds,
        effects: this.effects,
        tiles,
      });
    }

    handlePointerDown(point) {
      if (this.won || this.failed) return;
      this.physics.activateTileAt(point);
    }

    setDebug(options) {
      this.debug = { ...this.debug, ...options };
    }

    syncHud() {
      this.ui.setRemainingZones(`${this.melds.holding.length}/4`);
    }
  }

  MahjongDrop.Game = Game;
})();
