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
  const squareSize = 22;
  const padding = 4;
  const xStart = 20;
  const yStart = 20;

  // Flatten all days
  const days = weeks.flatMap(w => w.contributionDays);

  // Utility to generate jagged polygon points around a square base
  function jaggedSquare(x, y, size) {
    const jitter = size * 0.3;
    // 4 corners with small random offsets
    const points = [
      [x + Math.random() * jitter, y + Math.random() * jitter],
      [x + size - Math.random() * jitter, y + Math.random() * jitter],
      [x + size - Math.random() * jitter, y + size - Math.random() * jitter],
      [x + Math.random() * jitter, y + size - Math.random() * jitter],
    ];
    return points.map(p => p.join(',')).join(' ');
  }

  // Colors for pulse animation cycling in trans flag colors
  const pulseColors = ['#55CDFC', '#F7A8B8', '#FFFFFF', '#F7A8B8'];

  // Generate particle circles for bursts
  function particle(cx, cy, delay) {
    const r = 2 + Math.random() * 2;
    const dx = (Math.random() - 0.5) * 20;
    const dy = (Math.random() - 0.5) * 20;
    const dur = 1 + Math.random();

    return `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#F7A8B8" opacity="0">
        <animate attributeName="opacity" values="0;1;0" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
        <animate attributeName="cx" values="${cx};${cx + dx}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="${cy};${cy + dy}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
        <animate attributeName="r" values="${r};0" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
      </circle>
    `;
  }

  // Start SVG
  let svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" 
    xmlns="http://www.w3.org/2000/svg" style="background:#111;border-radius:12px;">

    <defs>
      <!-- Pulse animation for fill -->
      <linearGradient id="transPulse" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#55CDFC"/>
        <stop offset="33%" stop-color="#F7A8B8"/>
        <stop offset="66%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#F7A8B8"/>
      </linearGradient>

      <!-- Glitch filter -->
      <filter id="glitch" x="0" y="0" width="100%" height="100%">
        <feColorMatrix in="SourceGraphic" type="matrix" values="
          1 0 0 0 0
          0 1 0 0 0
          0 0 1 0 0
          0 0 0 20 -10" result="glow"/>
        <feTurbulence id="turbulence" baseFrequency="0.02" numOctaves="2" result="turb" seed="2">
          <animate attributeName="baseFrequency" values="0.02;0.06;0.02" dur="2s" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="glow" in2="turb" scale="6" xChannelSelector="R" yChannelSelector="G"/>
      </filter>

      <!-- Pixelate Union Jack pattern -->
      <pattern id="unionJack" patternUnits="userSpaceOnUse" width="60" height="40" patternTransform="scale(2)">
        <rect width="60" height="40" fill="#00247d" />
        <path d="M0 0 L60 40 M60 0 L0 40" stroke="#cf142b" stroke-width="8"/>
        <rect x="27" width="6" height="40" fill="#cf142b"/>
        <rect y="17" width="60" height="6" fill="#cf142b"/>
        <rect x="28" y="0" width="4" height="40" fill="white"/>
        <rect y="18" width="60" height="4" fill="white"/>
      </pattern>

      <filter id="pixelate" x="0" y="0" width="100%" height="100%" primitiveUnits="userSpaceOnUse">
        <feFlood x="0" y="0" height="5" width="5" flood-color="black" result="flood"/>
        <feMorphology operator="dilate" radius="1" in="SourceAlpha" result="dilated"/>
        <feComposite in="flood" in2="dilated" operator="in" result="pixel"/>
        <feTile in="pixel" result="tiled" />
        <feComposite in="SourceGraphic" in2="tiled" operator="in" result="composite"/>
      </filter>
    </defs>

    <!-- Background Union Jack with pixelate filter & opacity fade -->
    <rect width="${width}" height="${height}" fill="url(#unionJack)" opacity="0.05" filter="url(#pixelate)">
      <animate attributeName="opacity" values="0.05;0;0.05" dur="10s" repeatCount="indefinite"/>
    </rect>

    <!-- Commit Blocks as jagged polygons pulsing -->
  `;

  // Draw commit blocks
  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < 7; d++) {
      const day = weeks[w].contributionDays[d];
      if (!day) continue;

      const x = xStart + w * (squareSize + padding);
      const y = yStart + d * (squareSize + padding);

      // Get color index for pulse cycle depending on contributionCount
      const pulseIdx = Math.min(Math.floor(day.contributionCount / 2), pulseColors.length - 1);

      const points = jaggedSquare(x, y, squareSize);

      // Polygon with pulse animation on fill color
      svg += `
        <polygon points="${points}" fill="${pulseColors[pulseIdx]}" fill-opacity="0.9">
          <animate 
            attributeName="fill" 
            values="${pulseColors.join(';')}" 
            dur="4s" 
            repeatCount="indefinite" 
            begin="${(w + d) * 0.3}s"
          />
        </polygon>
      `;

      // If commit count high, add particle bursts
      if (day.contributionCount >= 7) {
        for (let i = 0; i < 4; i++) {
          svg += particle(x + squareSize / 2, y + squareSize / 2, i * 0.3);
        }
      }
    }
  }

  // Glitchy Text overlays
  svg += `
    <text x="${width/2}" y="30" text-anchor="middle" fill="#F7A8B8" font-size="18" font-weight="bold" font-family="monospace" filter="url(#glitch)" opacity="0.7">
      TRANS RIGHTS = HUMAN RIGHTS
    </text>
    <text x="${width/2 + 2}" y="32" text-anchor="middle" fill="#55CDFC" font-size="18" font-weight="bold" font-family="monospace" opacity="0.6" style="mix-blend-mode: screen;">
      TRANS RIGHTS = HUMAN RIGHTS
    </text>

    <text x="${width/2}" y="${height - 20}" text-anchor="middle" fill="#cf142b" font-size="14" font-weight="bold" font-family="monospace" filter="url(#glitch)" opacity="0.4">
      NO REFORM UK
    </text>
    <text x="${width/2 + 2}" y="${height - 18}" text-anchor="middle" fill="#cf142b" font-size="14" font-weight="bold" font-family="monospace" opacity="0.3" style="mix-blend-mode: screen;">
      NO REFORM UK
    </text>
  `;

  svg += '</svg>';

  return svg;
}

(async () => {
  const weeks = await fetchContributionData();
  const svg = buildSVG(weeks);
  fs.writeFileSync('runner-game.svg', svg, 'utf-8');
})();
