import axios from 'axios';
import fs from 'fs';

const username = process.env.USERNAME || "Seristic";
const GITHUB_API = 'https://api.github.com/graphql';
const GITHUB_TOKEN = process.env.PAT_TOKEN || '';

const query = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
            color
          }
        }
      }
    }
  }
}
`;

async function fetchContributionData() {
  try {
    const response = await axios.post(
      GITHUB_API,
      { query, variables: { login: username } },
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } }
    );

    return response.data.data.user.contributionsCollection.contributionCalendar.weeks;
  } catch (error) {
    console.error('Failed to fetch contribution data:', error.message);
    process.exit(1);
  }
}

function getColor(count) {
  if (count === 0) return '#1c1c1c';
  if (count <= 2) return '#55CDFC';
  if (count <= 5) return '#F7A8B8';
  return '#FFFFFF';
}

function buildSVG(weeks) {
  const width = 760;
  const height = 180;
  const squareSize = 24;
  const padding = 2;
  const xStart = 10;
  const yStart = 10;

  // Helper: create jagged polygon points for a square with jitter
  function jaggedRectPoints(x, y, size) {
    const jitter = size * 0.15;
    const points = [
      [x + Math.random() * jitter, y + Math.random() * jitter],
      [x + size - Math.random() * jitter, y + Math.random() * jitter],
      [x + size - Math.random() * jitter, y + size - Math.random() * jitter],
      [x + Math.random() * jitter, y + size - Math.random() * jitter],
    ];
    return points.map(p => p.join(',')).join(' ');
  }

  // Color function with subtle darkened outline
  function getColor(count) {
    if (count === 0) return '#1c1c1c';
    if (count <= 2) return '#55CDFC';
    if (count <= 5) return '#F7A8B8';
    return '#FFFFFF';
  }

  // Build SVG string
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#121212; border-radius: 8px; font-family: monospace;">\n`;

  // Define gradients and glitch filter
  svg += `
  <defs>
    <!-- Trans Flag Gradient -->
    <linearGradient id="transGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#55CDFC"/>
      <stop offset="33%" stop-color="#F7A8B8"/>
      <stop offset="66%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F7A8B8"/>
    </linearGradient>

    <!-- Blood Red Gradient for outlines -->
    <linearGradient id="bloodGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8B0000"/>
      <stop offset="100%" stop-color="#450000"/>
    </linearGradient>

    <!-- UK Flag Pattern -->
    <pattern id="ukFlag" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#00247d"/>
      <path d="M0 0 L40 40 M40 0 L0 40" stroke="#fff" stroke-width="5"/>
      <path d="M0 18 L40 18 M20 0 L20 40" stroke="#cf142b" stroke-width="10"/>
      <path d="M0 15 L40 25 M15 0 L25 40" stroke="#fff" stroke-width="6"/>
      <path d="M0 16 L40 24 M16 0 L24 40" stroke="#cf142b" stroke-width="4"/>
    </pattern>

    <!-- Fracture mask for UK flag cracks -->
    <mask id="fractureMask">
      <rect width="100%" height="100%" fill="white"/>
      <!-- Cracks flickering -->
      <path d="M50 0 L60 180" stroke="black" stroke-width="4" opacity="0.3">
        <animate attributeName="opacity" values="0.3;0;0.3" dur="6s" repeatCount="indefinite"/>
      </path>
      <path d="M120 0 L130 180" stroke="black" stroke-width="3" opacity="0.2">
        <animate attributeName="opacity" values="0.2;0;0.2" dur="8s" repeatCount="indefinite" begin="2s"/>
      </path>
      <path d="M200 0 L210 180" stroke="black" stroke-width="5" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0;0.25" dur="5s" repeatCount="indefinite" begin="4s"/>
      </path>
      <path d="M280 0 L290 180" stroke="black" stroke-width="3" opacity="0.15">
        <animate attributeName="opacity" values="0.15;0;0.15" dur="7s" repeatCount="indefinite" begin="1s"/>
      </path>
    </mask>

    <!-- Glitch text filter -->
    <filter id="glitchFilter" x="-10%" y="-10%" width="120%" height="120%">
      <feColorMatrix in="SourceGraphic" type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 20 -10"/>
      <feOffset dx="2" dy="0" result="off1"/>
      <feOffset dx="-2" dy="0" result="off2"/>
      <feMerge>
        <feMergeNode in="off1"/>
        <feMergeNode in="off2"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>\n`;

  // Dark textured background
  svg += `<rect width="${width}" height="${height}" fill="#121212"/>\n`;

  // Draw commit blocks as jagged polygons
  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < 7; d++) {
      const day = weeks[w].contributionDays[d];
      if (!day) continue;
      const color = getColor(day.contributionCount);
      const x = xStart + w * (squareSize + padding);
      const y = yStart + d * (squareSize + padding);

      const points = jaggedRectPoints(x, y, squareSize);
      svg += `<polygon points="${points}" fill="${color}" stroke="url(#bloodGradient)" stroke-width="1.5"/>\n`;
    }
  }

  // Overlay fractured UK flag with mask, covering the whole graph area
  svg += `<rect x="${xStart}" y="${yStart}" width="${(squareSize + padding) * weeks.length - padding}" height="${(squareSize + padding) * 7 - padding}" fill="url(#ukFlag)" mask="url(#fractureMask)" opacity="0.3"/>\n`;

  // Animated blood-red cracks/shards crossing the graph horizontally and vertically
  const crackPaths = [
    "M10 20 L750 30",
    "M100 0 L90 180",
    "M300 10 L310 170",
    "M400 20 L410 160",
    "M600 0 L590 180"
  ];

  crackPaths.forEach((d, i) => {
    svg += `<path d="${d}" stroke="#8B0000" stroke-width="3" opacity="0.25">
      <animate attributeName="opacity" values="0.25;0.6;0.25" dur="${5 + i}s" repeatCount="indefinite" begin="${i}s"/>
    </path>\n`;
  });

  // Intense slogans at the bottom, glitch filtered
  const slogans = [
    "TEAR DOWN THE EMPIRE",
    "REVOLT AGAINST REFORM UK",
    "TRANS LIBERATION NOW"
  ];

  slogans.forEach((text, i) => {
    svg += `<text x="10" y="${height - 50 + i * 18}" fill="#8B0000" font-weight="bold" font-size="18" filter="url(#glitchFilter)" opacity="0.85">${text}</text>\n`;
  });

  svg += `</svg>`;
  return svg;
}

(async () => {
  const weeks = await fetchContributionData();
  const svg = buildSVG(weeks);
  fs.writeFileSync('runner-game.svg', svg, 'utf-8');
})();
