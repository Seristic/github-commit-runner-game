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
  // Increase width so animation won't cut off
  const width = 1300;
  const height = 170;
  const squareSize = 24;
  const padding = 2;
  const xStart = 10;
  const yStart = 10;

  // Flatten days for easy access if needed
  const days = weeks.flatMap(w => w.contributionDays);

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#121212;border-radius:8px;">\n`;

  svg += `
  <defs>
    <!-- Trans-themed gradient -->
    <linearGradient id="transGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#55CDFC"/>
      <stop offset="33%" stop-color="#F7A8B8"/>
      <stop offset="66%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F7A8B8"/>
    </linearGradient>

    <!-- Runner gradient for snakes -->
    <linearGradient id="runnerGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#55CDFC"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F7A8B8"/>
    </linearGradient>

    <!-- Glow filter for snakes -->
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#F7A8B8" flood-opacity="0.6"/>
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#55CDFC" flood-opacity="0.4"/>
    </filter>

    <!-- Mask for particle fade effect -->
    <mask id="fadeMask" x="0" y="0" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="white" />
      <!-- Gradient fade at right edge -->
      <linearGradient id="fadeGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="80%" stop-color="black" stop-opacity="0" />
        <stop offset="100%" stop-color="black" stop-opacity="1" />
      </linearGradient>
      <rect x="${width * 0.8}" y="0" width="${width * 0.2}" height="${height}" fill="url(#fadeGradient)" />
    </mask>
  </defs>\n`;

  // Background with slight trans gradient overlay
  svg += `<rect width="${width}" height="${height}" fill="url(#transGradient)" opacity="0.05"/>\n`;

  // Draw static contribution squares
  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < 7; d++) {
      const day = weeks[w].contributionDays[d];
      if (!day) continue;
      const color = getColor(day.contributionCount);
      const x = xStart + w * (squareSize + padding);
      const y = yStart + d * (squareSize + padding);
      svg += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${color}" />\n`;
    }
  }

  // Add multi-snake trails - multiple rectangles moving independently with glow filter and gradient fill
  const snakeCount = 6;
  const snakeDuration = 56; // seconds
  for (let s = 0; s < snakeCount; s++) {
    // Calculate row based on s, spread out vertically but loop around 7 days
    const row = s % 7;
    const y = yStart + row * (squareSize + padding) + 2;
    // Stagger start time so snakes are spaced out
    const begin = (s * snakeDuration) / snakeCount;

    // Snake length in squares
    const snakeLength = 5;
    for (let segment = 0; segment < snakeLength; segment++) {
      const delay = begin + (segment * 0.8);
      svg += `
      <rect
        x="${xStart + 2 - segment * (squareSize + padding)}"
        y="${y}"
        width="20"
        height="20"
        rx="5"
        ry="5"
        fill="url(#runnerGradient)"
        filter="url(#glow)"
        opacity="${1 - segment * 0.15}"
      >
        <animate
          attributeName="x"
          values="${xStart + 2 - segment * (squareSize + padding)};${xStart + (squareSize + padding) * 51 + 2 - segment * (squareSize + padding)}"
          dur="${snakeDuration}s"
          begin="${delay}s"
          repeatCount="indefinite"
          keyTimes="0;1"
        />
      </rect>\n`;
    }
  }

  // Add particle-like dots that fade and follow snakes (using circles with opacity animation)
  const particleCount = 30;
  for (let p = 0; p < particleCount; p++) {
    const row = p % 7;
    const y = yStart + row * (squareSize + padding) + 12;
    const startX = xStart + Math.random() * (squareSize + padding) * 51;
    const duration = 15 + Math.random() * 10;
    const delay = Math.random() * snakeDuration;

    svg += `
    <circle
      cx="${startX}"
      cy="${y}"
      r="3"
      fill="#FFFFFF"
      fill-opacity="0.8"
      mask="url(#fadeMask)"
    >
      <animate
        attributeName="cx"
        values="${startX};${width + 10}"
        dur="${duration}s"
        begin="${delay}s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="fill-opacity"
        values="0.8;0;0.8"
        dur="${duration}s"
        begin="${delay}s"
        repeatCount="indefinite"
      />
    </circle>\n`;
  }

  svg += '</svg>';
  return svg;
}

(async () => {
  const weeks = await fetchContributionData();
  const svg = buildSVG(weeks);
  fs.writeFileSync('runner-game.svg', svg, 'utf-8');
})();
