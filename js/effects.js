(function () {
  const MahjongDrop = (window.MahjongDrop = window.MahjongDrop || {});

  class EffectsManager {
    constructor() {
      this.placeEffects = [];
      this.clearEffects = [];
    }
    reset() {
      this.placeEffects = [];
      this.clearEffects = [];
    }
    startPlace(tile, from, to) {
      this.placeEffects.push({ tile, from, to, elapsed: 0, duration: 260 });
    }
    startClear(tiles) {
      this.clearEffects.push({ tiles, elapsed: 0, duration: 340 });
    }
    update(deltaMs) {
      this.placeEffects = this.placeEffects.filter((effect) => (effect.elapsed += deltaMs) < effect.duration);
      this.clearEffects = this.clearEffects.filter((effect) => (effect.elapsed += deltaMs) < effect.duration);
    }
  }

  MahjongDrop.EffectsManager = EffectsManager;
})();
