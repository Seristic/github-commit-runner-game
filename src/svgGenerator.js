export function generateSVG(level, xp) {
    const width = 300;
    const height = 50;
    const baseXP = 100;
    const nextLevelXP = Math.pow(level + 1, 2) * baseXP;
    const progress = Math.min(xp / nextLevelXP, 1);
    const progressWidth = progress * width;

    return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#1e1e2f" rx="10" ry="10"/>
    <rect width="${progressWidth}" height="${height}" fill="#FF49C6" rx="10" ry="10"/>
    <text x="${width / 2}" y="30" font-size="24" font-family="Verdana" fill="#fff" text-anchor="middle" font-weight="bold">
      Level ${level} — XP: ${xp} / ${Math.floor(nextLevelXP)}
    </text>
  </svg>`;
}
