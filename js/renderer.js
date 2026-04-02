(function () {
  const MahjongDrop = (window.MahjongDrop = window.MahjongDrop || {});
  const { GAME_CONFIG, LAYOUT, SUITS, VIEWPORT, rgba } = MahjongDrop;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.debug = { sensor: false };
    }

    resize() {
      this.canvas.width = VIEWPORT.width;
      this.canvas.height = VIEWPORT.height;
    }

    setDebug(options) {
      this.debug = { ...this.debug, ...options };
    }

    render(state) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, VIEWPORT.width, VIEWPORT.height);
      this.drawBackground(ctx);
      this.drawTopZone(ctx);
      this.drawFunnel(ctx, state.physics);
      this.drawHoldingArea(ctx, state.melds);
      this.drawMeldArea(ctx, state.melds);
      this.drawTiles(ctx, state.tiles);
      this.drawEffects(ctx, state.effects);
    }

    drawBackground(ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, VIEWPORT.height);
      gradient.addColorStop(0, "#f9fcff");
      gradient.addColorStop(0.48, "#edf5fc");
      gradient.addColorStop(1, "#d9e9f6");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);

      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(140, 180, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(620, 250, 150, 0, Math.PI * 2);
      ctx.fill();
    }

    drawTopZone(ctx) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.56)";
      ctx.strokeStyle = "rgba(78,125,168,0.18)";
      ctx.lineWidth = 4;
      this.roundRect(ctx, 42, 56, 666, 500, 36);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    drawFunnel(ctx, physics) {
      const centerX = VIEWPORT.width / 2;
      const mouthHalf = LAYOUT.funnelMouthWidth / 2;
      const exitHalf = LAYOUT.funnelExitWidth / 2;
      ctx.save();
      ctx.fillStyle = "rgba(204, 228, 244, 0.9)";
      ctx.beginPath();
      ctx.moveTo(centerX - mouthHalf, LAYOUT.funnelTopY);
      ctx.lineTo(centerX - exitHalf, LAYOUT.funnelBottomY);
      ctx.lineTo(centerX + exitHalf, LAYOUT.funnelBottomY);
      ctx.lineTo(centerX + mouthHalf, LAYOUT.funnelTopY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(165, 206, 230, 0.95)";
      ctx.fillRect(centerX - exitHalf, LAYOUT.funnelBottomY - 6, LAYOUT.funnelExitWidth, 86);

      if (this.debug.sensor && physics.sensorBounds) {
        const min = physics.sensorBounds.min;
        const max = physics.sensorBounds.max;
        ctx.strokeStyle = "#ff4d4f";
        ctx.lineWidth = 3;
        ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
      }
      ctx.restore();
    }

    drawHoldingArea(ctx, melds) {
      const rect = melds.getHoldingRect();
      ctx.save();
      this.roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 20);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.fill();
      ctx.strokeStyle = "rgba(96,132,162,0.16)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "rgba(48,76,101,0.7)";
      ctx.font = "700 17px sans-serif";
      ctx.fillText("暂留区", rect.x + 16, rect.y + 30);

      for (let index = 0; index < 4; index += 1) {
        const slotRect = melds.getHoldingSlotRect(index);
        this.drawSlotCard(ctx, slotRect);
      }

      melds.holding.forEach((tile) => {
        this.drawTileFace(ctx, tile.x, tile.y, tile.width, tile.height, tile.suit, tile.rank, 0, 1);
      });
      ctx.restore();
    }

    drawMeldArea(ctx, melds) {
      melds.zones.forEach((zone, zoneIndex) => {
        const zoneRect = melds.getZoneRect(zoneIndex);
        ctx.save();
        this.roundRect(ctx, zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height, 22);
        ctx.fillStyle = "rgba(255,255,255,0.68)";
        ctx.fill();
        ctx.strokeStyle = "rgba(96,132,162,0.18)";
        ctx.lineWidth = 3;
        ctx.stroke();

        const zoneGlow = ctx.createLinearGradient(zoneRect.x, zoneRect.y, zoneRect.x, zoneRect.y + zoneRect.height);
        zoneGlow.addColorStop(0, "rgba(255,255,255,0.34)");
        zoneGlow.addColorStop(1, "rgba(205,226,240,0)");
        ctx.fillStyle = zoneGlow;
        this.roundRect(ctx, zoneRect.x + 4, zoneRect.y + 4, zoneRect.width - 8, zoneRect.height - 8, 18);
        ctx.fill();

        ctx.fillStyle = "rgba(48,76,101,0.7)";
        ctx.font = "700 17px sans-serif";
        ctx.fillText(`凑牌区 ${zoneIndex + 1}`, zoneRect.x + 16, zoneRect.y + 30);

        zone.slots.forEach((tile, slotIndex) => {
          const slotRect = melds.getSlotRect(zoneIndex, slotIndex);
          this.drawSlotCard(ctx, slotRect);
          if (tile) {
            this.drawTileFace(ctx, slotRect.x + slotRect.width / 2, slotRect.y + slotRect.height / 2, tile.width, tile.height, tile.suit, tile.rank, 0, 1);
          }
        });
        ctx.restore();
      });
    }

    drawSlotCard(ctx, rect) {
      ctx.save();
      this.roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
      ctx.fillStyle = "rgba(196, 219, 237, 0.78)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    drawTiles(ctx, tiles) {
      tiles.forEach((tile) => {
        this.drawTileFace(ctx, tile.x, tile.y, tile.width, tile.height, tile.suit, tile.rank, tile.angle || 0, 1);
      });
    }

    drawTileFace(ctx, x, y, width, height, suitKey, rank, angle, alpha) {
      const suit = SUITS[suitKey];
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.shadowColor = "rgba(56,84,110,0.16)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      this.roundRect(ctx, -width / 2, -height / 2, width, height, GAME_CONFIG.tileRadius);
      ctx.fillStyle = "#fffdfa";
      ctx.fill();
      ctx.shadowColor = "transparent";

      ctx.strokeStyle = "rgba(78,106,132,0.26)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = rgba(suit.color, 0.12);
      this.roundRect(ctx, -width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 8);
      ctx.fill();

      ctx.fillStyle = suit.color;
      ctx.font = "800 26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(rank), 0, -12);
      ctx.font = "800 24px sans-serif";
      ctx.fillText(suit.label, 0, 15);
      ctx.restore();
    }

    drawEffects(ctx, effects) {
      effects.placeEffects.forEach((effect) => {
        const t = effect.elapsed / effect.duration;
        const ease = 1 - Math.pow(1 - t, 3);
        const x = effect.from.x + (effect.to.x - effect.from.x) * ease;
        const y = effect.from.y + (effect.to.y - effect.from.y) * ease;
        const scale = 1 - t * 0.06;
        this.drawTileFace(
          ctx,
          x,
          y,
          effect.tile.width * scale,
          effect.tile.height * scale,
          effect.tile.suit,
          effect.tile.rank,
          0,
          1 - t * 0.08
        );
      });

      effects.clearEffects.forEach((effect) => {
        const t = effect.elapsed / effect.duration;
        effect.tiles.forEach((tile, index) => {
          const pulse = 1 + Math.sin(t * Math.PI * 4 + index) * 0.06;
          this.drawTileFace(
            ctx,
            tile.x || 0,
            tile.y || 0,
            GAME_CONFIG.tileWidth * pulse,
            GAME_CONFIG.tileHeight * pulse,
            tile.suit,
            tile.rank,
            0,
            1 - t
          );
        });
      });
    }

    roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    }
  }

  MahjongDrop.Renderer = Renderer;
})();
