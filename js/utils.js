(function () {
  const MahjongDrop = (window.MahjongDrop = window.MahjongDrop || {});
  function pointInRect(px, py, cx, cy, width, height) {
    return px >= cx - width / 2 && px <= cx + width / 2 && py >= cy - height / 2 && py <= cy + height / 2;
  }
  function rgba(hex, alpha) {
    const clean = hex.replace("#", "");
    const value = Number.parseInt(clean, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function tileKey(tile) {
    return `${tile.suit}_${tile.rank}`;
  }
  MahjongDrop.pointInRect = pointInRect;
  MahjongDrop.rgba = rgba;
  MahjongDrop.tileKey = tileKey;
})();
