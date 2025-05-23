import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Only needed for ES modules to simulate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readmePath = path.resolve(__dirname, 'README.md');
const svgPath = path.resolve(__dirname, 'progress.svg');

const content = fs.readFileSync(readmePath, 'utf-8');

GITHUB_USERNAME = Seristic


export function generateProgressMarkdown({
  username = GITHUB_USERNAME,
  level = 0,
  currentXP = 0,
  nextLevelXP = 100,
  commitXP = 0,
  prXP = 0,
  issuesXP = 0,
  starredXP = 0,
  reviewsXP = 0,
  mergedPRXP = 0,
  forksXP = 0,
  wikiEditsXP = 0,
  discussionsStartedXP = 0,
  discussionsParticipatedXP = 0,
  projectCardsXP = 0,
  releasesXP = 0,
  recentRepos = [],
  totalRepos = 0,
  totalGists = 0,
  followers = 0,
  starsGiven = 0
}) {
  const progressPercent = Math.min(100, Math.floor((currentXP / nextLevelXP) * 100));
  const xpToNext = nextLevelXP - currentXP;

  const requiredXP = 150;
  const percentage = Math.round((currentXP / requiredXP) * 100);

  const filledWidth = percentage;
  const emptyWidth = 100 - filledWidth;

  const svg = `
<svg width="700" height="40" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="700" height="40" fill="#333" rx="20" />
  <rect x="0" y="0" width="${(700 * filledWidth) / 100}" height="40" fill="#FF49C6" rx="20" />
  <text x="350" y="26" fill="#fff" font-weight="bold" font-size="16" text-anchor="middle" font-family="Verdana">
    Level ${level} — XP ${currentXP} / ${requiredXP}
  </text>
</svg>
`;

  fs.writeFileSync('./progress.svg', svg.trim());
  console.log('✅ Progress bar SVG generated: progress.svg');

  const recentReposList = recentRepos
    .map(repo =>
      `<li><a href="${repo.html_url}" style="color:#FF79C6;">${repo.name}</a>: ${repo.description || 'No description'} ★${repo.stargazers_count} - ${repo.language || 'Unknown'}</li>`
    ).join('\n');

  function generateXPAsciiTable(data) {
    const rows = [
      ['Commits', data.commitXP],
      ['Pull Requests', data.prXP],
      ['Issues Opened', data.issuesXP],
      ['Repositories Starred', data.starredXP],
      ['Code Reviews', data.reviewsXP],
      ['Merged Pull Requests', data.mergedPRXP],
      ['Repository Forks', data.forksXP],
      ['Wiki Edits', data.wikiEditsXP],
      ['Discussions Started', data.discussionsStartedXP],
      ['Discussions Participated', data.discussionsParticipatedXP],
      ['Project Cards Created', data.projectCardsXP],
      ['Releases Published', data.releasesXP],
    ];

    const col1Width = Math.max(...rows.map(r => r[0].length), 'Source'.length);
    const col2Width = Math.max(...rows.map(r => String(r[1]).length), 'XP'.length);

    const line = `+${'-'.repeat(col1Width + 2)}+${'-'.repeat(col2Width + 2)}+`;
    const header = `| ${'Source'.padEnd(col1Width)} | ${'XP'.padEnd(col2Width)} |`;

    const tableRows = rows.map(
      ([name, xp]) => `| ${name.padEnd(col1Width)} | ${String(xp).padEnd(col2Width)} |`
    );

    return [line, header, line, ...tableRows, line].join('\n');
  }

  const xpTable = generateXPAsciiTable({
    commitXP, prXP, issuesXP, starredXP, reviewsXP,
    mergedPRXP, forksXP, wikiEditsXP,
    discussionsStartedXP, discussionsParticipatedXP,
    projectCardsXP, releasesXP,
  });

  return `
<!-- PROGRESS -->
<div style="background:#1e1e1e; border-radius:12px; padding:20px; max-width:700px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#eee; line-height:1.5;">

  <h2 style="color:#FF79C6;">🏳️‍⚧️ My Journey & Recent Milestones</h2>
  <p>Hello! I’m <strong>${username}</strong>, a passionate developer and proud member of the trans community.</p>
  <p>This profile is not just a showcase of code but a celebration of identity, resilience, and growth.</p>

  <h3 style="color:#FF79C6;">📅 Timeline of My Journey</h3>
  <p style="color:#ccc;"><em>(coming soon — automated timeline of major commits, repos, and achievements)</em></p>

  <blockquote style="border-left: 3px solid #FF79C6; padding-left: 10px; color:#ccc; margin: 1em 0;">
    “Coding my story, one commit at a time — proud, visible, unstoppable.”
  </blockquote>

  <h3 style="color:#FF79C6;">🎮 GitHub RPG Profile</h3>
  <p>Level ${level} — XP ${currentXP} / ${nextLevelXP} (${xpToNext} XP to next level)</p>
  <svg width="100%" height="30" xmlns="http://www.w3.org/2000/svg" style="border-radius:15px; overflow:hidden; background:#333;">
    <rect width="${progressPercent}%" height="30" fill="#FF49C6" />
    <rect x="${progressPercent}%" width="${100 - progressPercent}%" height="30" fill="#555" />
    <text x="50%" y="20" fill="#fff" font-weight="bold" font-size="16" text-anchor="middle" alignment-baseline="middle" font-family="Verdana">
      Level Progress
    </text>
  </svg>

  <h3 style="color:#FF79C6; margin-top:20px;">🧠 Character Stats</h3>
  <ul style="list-style:none; padding-left:0; color:#ccc;">
    <li>💻 Commits: ${commitXP}</li>
    <li>🛠 Repositories: ${totalRepos}</li>
    <li>🍴 Forks Created: ${forksXP}</li>
    <li>⭐ Stars Received: ${starredXP}</li>
    <li>🌟 Stars Given: ${starsGiven}</li>
    <li>📜 Gists Created: ${totalGists}</li>
    <li>🚀 Releases Published: ${releasesXP}</li>
    <li>👥 Followers: ${followers}</li>
  </ul>

  <h3 style="color:#FF79C6;">⚔️ Combat Log</h3>
  <pre style="background:#222; padding:10px; border-radius:8px; overflow-x:auto; font-family: monospace; color:#FF79C6;">
Action                  Count    XP Value
🔧 Issues Opened         ${issuesXP}        🪙 +5 XP each
🛡 Pull Requests         ${prXP}        🪙 +10 XP each
⚔ Merged PRs            ${mergedPRXP}        🪙 +20 XP each
💬 Code Reviews          ${reviewsXP}        🪙 +2 XP each
  </pre>

  <h3 style="color:#FF79C6;">📈 XP Breakdown</h3>
  <pre style="background:#222; padding:10px; border-radius:8px; overflow-x:auto; font-family: monospace; color:#FF79C6;">
${xpTable}
  </pre>

  <p style="color:#ccc;"><em>Total XP is hidden but used for level calculation. XP needed increases exponentially — leveling up takes dedication!</em></p>

  <h3 style="color:#FF79C6;">Recent Repositories</h3>
  <ul style="padding-left: 20px; color:#ddd;">
    ${recentReposList}
  </ul>

  <p style="margin-top:20px; color:#aaa;">Portfolio coming soon — check out my recent projects and languages used.</p>

</div>
<!-- END_PROGRESS -->
`.trim();
}

export function updateReadme(content) {
  try {
    let readme = fs.readFileSync('README.md', 'utf-8');
    const regex = /<!-- PROGRESS -->[\s\S]*?<!-- END_PROGRESS -->/;

    if (regex.test(readme)) {
      readme = readme.replace(regex, content);
    } else {
      readme = `${content}\n\n${readme}`;
    }

    fs.writeFileSync('README.md', readme);
    console.log('✅ README.md successfully updated.');
  } catch (err) {
    console.error('❌ Failed to update README.md:', err);
  }
}
