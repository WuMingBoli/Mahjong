(function () {
  const { VIEWPORT, Game, Renderer } = window.MahjongDrop;
  const canvas = document.getElementById("gameCanvas");
  const restartButton = document.getElementById("restartButton");
  const overlayRestartButton = document.getElementById("overlayRestartButton");
  const overlayFailRestartButton = document.getElementById("overlayFailRestartButton");
  const levelLabel = document.getElementById("levelLabel");
  const zonesLabel = document.getElementById("zonesLabel");
  const winOverlay = document.getElementById("winOverlay");
  const failOverlay = document.getElementById("failOverlay");
  const toggleSensor = document.getElementById("toggleSensor");

  const ui = {
    setLevelName(text) { levelLabel.textContent = text; },
    setRemainingZones(count) { zonesLabel.textContent = String(count); },
    toggleWin(show) { winOverlay.classList.toggle("hidden", !show); },
    toggleFail(show) { failOverlay.classList.toggle("hidden", !show); },
  };

  const game = new Game({ canvas, ui });
  const renderer = new Renderer(canvas);
  game.attachRenderer(renderer);
  game.start();

  function toPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEWPORT.width,
      y: ((event.clientY - rect.top) / rect.height) * VIEWPORT.height,
    };
  }

  canvas.addEventListener("pointerdown", (event) => game.handlePointerDown(toPoint(event)));
  restartButton.addEventListener("click", () => game.reset());
  overlayRestartButton.addEventListener("click", () => game.reset());
  overlayFailRestartButton.addEventListener("click", () => game.reset());
  toggleSensor.addEventListener("change", () => game.setDebug({ sensor: toggleSensor.checked }));
  window.addEventListener("resize", () => renderer.resize());
})();
