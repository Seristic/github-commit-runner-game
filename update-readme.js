// update-readme.js

import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

config({ path: './.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Using token:', process.env.PAT_TOKEN ? 'Yes' : 'No');

const octokit = new Octokit({ auth: process.env.PAT_TOKEN });
const username = 'Seristic';
const repo = 'Seristic';

// Fetch user stats with safe handling of contributors stats data
const getUserStats = async () => {
  const user = await octokit.rest.users.getByUsername({ username });
  const repos = await octokit.rest.repos.listForUser({ username, per_page: 100 });

  let totalCommits = 0;
  let totalIssues = 0;
  let totalPRs = 0;
  let totalMergedPRs = 0;
  let totalComments = 0;
  let stars = 0;

  for (const repo of repos.data) {
    const stats = await octokit.rest.repos.getContributorsStats({
      owner: username,
      repo: repo.name
    }).catch(() => null);

    const issues = await octokit.rest.issues.listForRepo({
      owner: username,
      repo: repo.name,
      state: 'all'
    }).catch(() => null);

    const pulls = await octokit.rest.pulls.list({
      owner: username,
      repo: repo.name,
      state: 'all'
    }).catch(() => null);

    if (stats && Array.isArray(stats.data)) {
      const userStats = stats.data.find(s => s.author?.login === username);
      if (userStats) {
        totalCommits += userStats.total;
      }
    }

    if (issues) {
      totalIssues += issues.data.filter(i => i.user?.login === username && !i.pull_request).length;
    }

    if (pulls) {
      totalPRs += pulls.data.filter(p => p.user?.login === username).length;
      totalMergedPRs += pulls.data.filter(p => p.user?.login === username && p.merged_at).length;
    }

    stars += repo.stargazers_count;
  }

  // Get code review comments (PullRequestReviewCommentEvent) from user's events
  const events = await octokit.paginate(octokit.rest.activity.listEventsForAuthenticatedUser, {
    username,
    per_page: 100
  });

  totalComments = events.filter(e => e.type === 'PullRequestReviewCommentEvent').length;

  return {
    commits: totalCommits,
    repos: repos.data.length,
    stars,
    followers: user.data.followers,
    issues: totalIssues,
    prs: totalPRs,
    mergedPrs: totalMergedPRs,
    comments: totalComments
  };
};

const generateXPBar = (xp) => {
  const totalBars = 20;
  const filledBars = Math.floor((xp / 100) * totalBars);
  return '▰'.repeat(filledBars) + '▱'.repeat(totalBars - filledBars);
};

const calculateLevel = (totalXP) => Math.floor(totalXP / 100);

// Timeline milestones with date keys
const milestones = [
  { year: 2020, label: "Was in College studying in Computing Science", date: new Date("2020-01-01") },
  { year: 2022, label: "Came out as trans and started integrating my identity into my work and community.", date: new Date("2022-01-01") },
  { year: 2025, label: "Endured the impact of a devastating ruling undermining trans rights — a stark reminder of the ongoing fight for dignity and existence.", date: new Date("2025-05-01") },
];

// Normalize to midnight to avoid timezone/day rounding errors
const toMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Optional: Human-readable "ago" labels
const humanAgo = (days) => {
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days <= 7) return `${days} days ago`;
  if (days <= 30) return `${Math.floor(days / 7)} week(s) ago`;
  return null;
};

// Returns timeline markdown with "Recent" or normal label depending on milestone date vs today
const formatTimeline = () => {
  const today = new Date();
  const recentThresholdDays = 30;

  let tableRows = milestones.map(({ year, label, date }) => {
    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    const isRecent = diffDays >= 0 && diffDays <= recentThresholdDays;
    const recentLabel = isRecent ? "**Recent:** " : "";
    const agoLabel = isRecent ? ` (_${diffDays} days ago_)` : "";
    return `| ${year} | ${recentLabel}${label}${agoLabel} |`;
  });

  return `
| Year | Milestone |
|------|-----------|
${tableRows.join('\n')}
  `.trim();
};

const main = async () => {
  const stats = await getUserStats();

  const totalXP = stats.issues * 5 + stats.prs * 10 + stats.mergedPrs * 20 + stats.comments * 2;
  const level = calculateLevel(totalXP);
  const xp = totalXP % 100;
  const xpBar = generateXPBar(xp);

  // Read and update README.md placeholders
  const readmePath = path.join(__dirname, 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf-8');

  const timeline = formatTimeline();

  readme = readme.replace(/{{USERNAME}}/g, username)
    .replace(/{{LEVEL}}/g, level)
    .replace(/{{XP}}/g, xp)
    .replace(/{{XP_BAR}}/g, xpBar)
    .replace(/{{NEXT_XP}}/g, 100 - xp)
    .replace(/{{COMMITS}}/g, stats.commits)
    .replace(/{{REPOS}}/g, stats.repos)
    .replace(/{{STARS}}/g, stats.stars)
    .replace(/{{FOLLOWERS}}/g, stats.followers)
    .replace(/{{ISSUES}}/g, stats.issues)
    .replace(/{{PRS}}/g, stats.prs)
    .replace(/{{MERGEDPRS}}/g, stats.mergedPrs)
    .replace(/{{COMMENTS}}/g, stats.comments)
    .replace(/{{TIMELINE}}/g, timeline);

  fs.writeFileSync(readmePath, readme);
  console.log('README.md updated successfully.');
};

main().catch(console.error);
