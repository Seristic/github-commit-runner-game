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
  const width = 700;
  const height = 140;
  const days = weeks.flatMap(w => w.contributionDays);

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#121212;border-radius:8px;">\n`;

  svg += `
  <defs>
    <linearGradient id="transGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#55CDFC"/>
      <stop offset="33%" stop-color="#F7A8B8"/>
      <stop offset="66%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F7A8B8"/>
    </linearGradient>
    <linearGradient id="runnerGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#55CDFC"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F7A8B8"/>
    </linearGradient>
  </defs>\n`;

  svg += `<rect width="${width}" height="${height}" fill="url(#transGradient)" opacity="0.05"/>\n`;

  const squareSize = 24;
  const padding = 2;
  const xStart = 10;
  const yStart = 10;

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

  for (let d = 0; d < 7; d++) {
    const y = yStart + d * (squareSize + padding) + 2;
    svg += `
    <rect
      x="${xStart + 2}"
      y="${y}"
      width="20"
      height="20"
      rx="5"
      ry="5"
      fill="url(#runnerGradient)"
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

  svg += '</svg>';
  return svg;
}

(async () => {
  const weeks = await fetchContributionData();
  const svg = buildSVG(weeks);
  fs.writeFileSync('runner-game.svg', svg, 'utf-8');
})();
