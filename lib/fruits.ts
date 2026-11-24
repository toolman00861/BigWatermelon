export type FruitKind = {
  name: string;
  radius: number;
  score: number;
  flesh: string;
  shade: string;
  leaf: string;
};

export const FRUITS: FruitKind[] = [
  { name: "樱桃", radius: 16, score: 1, flesh: "#e23d55", shade: "#9d1630", leaf: "#2f9e55" },
  { name: "草莓", radius: 22, score: 3, flesh: "#ef3d5a", shade: "#b41438", leaf: "#2f9a46" },
  { name: "葡萄", radius: 29, score: 6, flesh: "#7a45d6", shade: "#43208a", leaf: "#3aaa62" },
  { name: "橙子", radius: 37, score: 10, flesh: "#f5a524", shade: "#d06a10", leaf: "#3aaa62" },
  { name: "柿子", radius: 46, score: 15, flesh: "#ef6a2f", shade: "#c43b12", leaf: "#4e8a3a" },
  { name: "苹果", radius: 55, score: 21, flesh: "#e04343", shade: "#a51d28", leaf: "#3c9a4e" },
  { name: "梨", radius: 64, score: 28, flesh: "#e4d15a", shade: "#c49a22", leaf: "#6aaa3a" },
  { name: "桃子", radius: 74, score: 36, flesh: "#ffb4c4", shade: "#e36b88", leaf: "#3c9a4e" },
  { name: "菠萝", radius: 84, score: 45, flesh: "#f0c14a", shade: "#d08920", leaf: "#2f8a3c" },
  { name: "蜜瓜", radius: 96, score: 55, flesh: "#d5e38a", shade: "#8fb84a", leaf: "#d8c27a" },
  { name: "西瓜", radius: 108, score: 66, flesh: "#2f9a58", shade: "#176b3a", leaf: "#145c32" },
];

export const WORLD = {
  width: 430,
  height: 680,
  wall: 24,
  spawnY: 62,
  lineY: 126,
};

export function mergeRate(resultKind: number) {
  const kind = Math.min(FRUITS.length - 1, Math.max(1, resultKind));
  return 1 - (0.3 * (kind - 1)) / (FRUITS.length - 2);
}

export function randomDropKind() {
  return Math.floor(Math.random() * 5);
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function leaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.7, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFruit(
  ctx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  radius: number,
  image?: CanvasImageSource | null,
  pop = 1,
) {
  const fruit = FRUITS[kind] ?? FRUITS[0];
  const r = radius * pop;
  ctx.save();
  ctx.shadowColor = "rgba(80, 40, 10, 0.22)";
  ctx.shadowBlur = r * 0.25;
  ctx.shadowOffsetY = r * 0.12;
  circle(ctx, x, y + r * 0.04, r * 0.92);
  ctx.fillStyle = "rgba(80, 40, 10, 0.01)";
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  if (image) {
    const size = r * 2;
    ctx.drawImage(image, x - r, y - r, size, size);
  } else {
    const gradient = ctx.createRadialGradient(
      x - r * 0.35,
      y - r * 0.4,
      r * 0.15,
      x,
      y,
      r,
    );
    gradient.addColorStop(0, "#fff6ea");
    gradient.addColorStop(0.28, fruit.flesh);
    gradient.addColorStop(1, fruit.shade);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    paintDetails(ctx, kind, x, y, r, fruit);
  }

  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#fff8ee";
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(x, y, r - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function paintDetails(
  ctx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  r: number,
  fruit: FruitKind,
) {
  if (kind === 0) {
    leaf(ctx, x + r * 0.15, y - r * 0.72, r * 0.45, fruit.leaf);
    ctx.strokeStyle = "#2f6a34";
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.2);
    ctx.quadraticCurveTo(x + r * 0.1, y - r * 0.7, x + r * 0.28, y - r * 0.9);
    ctx.stroke();
  } else if (kind === 1) {
    ctx.fillStyle = fruit.leaf;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y - r * 0.55);
    ctx.lineTo(x, y - r * 0.95);
    ctx.lineTo(x + r * 0.45, y - r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe7a8";
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(angle) * r * 0.42,
        y + Math.sin(angle) * r * 0.38,
        r * 0.06,
        r * 0.1,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (kind === 2) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        ctx.beginPath();
        ctx.arc(
          x + (col - 1) * r * 0.42,
          y + (row - 1) * r * 0.38,
          r * 0.22,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    leaf(ctx, x + r * 0.2, y - r * 0.78, r * 0.4, fruit.leaf);
  } else if (kind === 8) {
    ctx.strokeStyle = "rgba(138, 78, 12, 0.35)";
    ctx.lineWidth = r * 0.045;
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - r, y + i * r * 0.22);
      ctx.lineTo(x + r, y + i * r * 0.22 + r * 0.18);
      ctx.stroke();
    }
    ctx.fillStyle = fruit.leaf;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y - r * 0.35);
    ctx.lineTo(x, y - r);
    ctx.lineTo(x + r * 0.45, y - r * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 10) {
    ctx.fillStyle = "#f4f7ea";
    ctx.fillRect(x - r, y - r * 0.08, r * 2, r * 0.16);
    ctx.fillStyle = "#ef5b6a";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.28, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#173822";
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        x - r * 0.28 + i * r * 0.14,
        y + r * 0.28,
        r * 0.035,
        r * 0.06,
        0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else {
    leaf(ctx, x + r * 0.28, y - r * 0.72, r * 0.38, fruit.leaf);
    ctx.strokeStyle = "rgba(90, 40, 20, 0.35)";
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.15);
    ctx.lineTo(x, y - r * 0.78);
    ctx.stroke();
    if (kind === 7) {
      ctx.strokeStyle = "rgba(180, 60, 90, 0.45)";
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.1);
      ctx.quadraticCurveTo(x + r * 0.15, y + r * 0.2, x, y + r * 0.55);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.36, r * 0.22, r * 0.14, -0.7, 0, Math.PI * 2);
  ctx.fill();
}
