import axios from 'axios';
import fs from 'fs';

const username = process.env.USERNAME;
if (!username) {
  console.error('ERROR: USERNAME environment variable not set.');
  process.exit(1);
}

// GitHub GraphQL API endpoint
const GITHUB_API = 'https://api.github.com/graphql';

// You can optionally add a personal token with more API limits in secrets if needed
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Query the GitHub GraphQL API to get contribution calendar data
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

function buildSVG(weeks) {
  // We'll build a 7x52 grid (7 days, ~52 weeks)
  // Each square 24x24 with 6px padding between
  // Runner moves horizontally week by week (left to right)
  // Colors based on contribution count (trans colors theme)

  const width = 700;
  const height = 140;

  // Flatten weeks array to get all contributionDays (7 per week)
  const days = weeks.flatMap(w => w.contributionDays);

  // Map day index for animation timing
  // The runner will move through 52 columns (weeks)

  // Trans colors used for contribution intensity:
  // 0 commits - #1c1c1c (dark)
  // low commit - #55CDFC (light blue)
  // mid commit - #F7A8B8 (pink)
  // high commit - #FFFFFF (white)

  // We’ll determine contribution levels by count thresholds
  function getColor(count) {
    if (count === 0) return '#1c1c1c';
    if (count <= 2) return '#55CDFC';
    if (count <= 5) return '#F7A8B8';
    return '#FFFFFF';
  }

  // Generate SVG string
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#121212;border-radius:8px;">\n`;

  // Background faint trans stripes
  svg += `<defs>
  <linearGradient id="transGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#55CDFC"/>
    <stop offset="33%" stop-color="#F7A8B8"/>
    <stop offset="66%" stop-color="#FFFFFF"/>
    <stop offset="100%" stop-color="#F7A8B8"/>
  </linearGradient>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%" >
    <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#F7A8B8"/>
  </filter>
  <linearGradient id="runnerGradient" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#55CDFC"/>
    <stop offset="50%" stop-color="#FFFFFF"/>
    <stop offset="100%" stop-color="#F7A8B8"/>
  </linearGradient>
  </defs>\n`;

  svg += `<rect width="${width}" height="${height}" fill="url(#transGradient)" opacity="0.05"/>\n`;

  // Draw squares
  // Each week column x: 10 + 26 * week index (24 size + 2 padding)
  // Each day row y: 10 + 20 * day index

  const squareSize = 24;
  const padding = 2;
  const xStart = 10;
  const yStart = 10;

  // Max weeks = 52, days = 7
  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < 7; d++) {
      const day = weeks[w].contributionDays[d];
      if (!day) continue;
      const count = day.contributionCount;
      const color = getColor(count);
      const x = xStart + w * (squareSize + padding);
      const y = yStart + d * (squareSize + padding);

      svg += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${color}" />\n`;
    }
  }

  // Runner sprite (rounded rectangle)
  // Animate runner across the weeks horizontally, row by row, looping
  // Runner size slightly smaller than squares (20x20)
  const runnerWidth = 20;
  const runnerHeight = 20;
  const runnerRadius = 5;

  // Animate runner on each row with delays, total duration 56s (1s per square)

  // We will create 7 <rect> runners (one per row), each animating horizontally
  // They move left to right (week 0 to week 51), repeat indefinitely

  for (let d = 0; d < 7; d++) {
    const y = yStart + d * (squareSize + padding) + 2; // offset for runner inside square
    svg += `<rect
      x="${xStart + 2}"
      y="${y}"
      width="${runnerWidth}"
      height="${runnerHeight}"
      rx="${runnerRadius}"
      ry="${runnerRadius}"
      fill="url(#runnerGradient)"
      id="runner-row-${d}"
    >
      <animate
        attributeName="x"
        values="${xStart + 2};${xStart + (squareSize + padding) * 51 + 2}"
        dur="56s"
        begin="${d * 8}s"
        repeatCount="indefinite"
        keyTimes="0;1"
      />
    </rect>\n`;
  }

  // Glow pulses on commit squares when runner passes
  // We'll place one <circle> per commit square with fade animation timed with runner

  // For timing: runner takes 1s per square, so pulse at t = week index + delay per row

  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < 7; d++) {
      const day = weeks[w].contributionDays[d];
      if (!day) continue;
      if (day.contributionCount === 0) continue; // skip no commit days

      const x = xStart + w * (squareSize + padding) + squareSize / 2;
      const y = yStart + d * (squareSize + padding) + squareSize / 2;

      // begin time = w seconds + d * 8 seconds (runner delay per row)
      const beginTime = w + d * 8;

      // Pulse circle
      svg += `<circle cx="${x}" cy="${y}" r="${squareSize / 2}" fill="#F7A8B8" opacity="0">
        <animate attributeName="opacity" values="0;0.6;0" dur="1s" repeatCount="indefinite" begin="${beginTime}s"/>
      </circle>\n`;
    }
  }

  svg += '</svg>';
  return svg;
}

(async () => {
  const weeks = await fetchContributionData();

  const svg = buildSVG(weeks);

  fs.writeFileSync('runner-game.svg', svg, 'utf-8');
  console.log('SVG file generated: runner-game.svg');
})();
