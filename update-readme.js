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

// Milestones timeline data
const milestones = [
  { year: 2020, label: "Was in College studying in Computing Science", date: new Date("2020-01-01") },
  { year: 2022, label: "Came out as trans and started integrating my identity into my work and community.", date: new Date("2022-01-01") },
  { year: 2025, label: "Endured the impact of a devastating ruling undermining trans rights — a stark reminder of the ongoing fight for dignity and existence.", date: new Date("2025-05-01") },
];

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

const generateXPBar = (xp) => {
  const totalBars = 20;
  const filledBars = Math.floor((xp / 100) * totalBars);
  return '▰'.repeat(filledBars) + '▱'.repeat(totalBars - filledBars);
};

const calculateLevel = (totalXP) => Math.floor(totalXP / 100);

const getUserStats = async () => {
  // Fetch user info
  const user = await octokit.rest.users.getByUsername({ username });

  // Fetch repos owned by user (max 100)
  const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
    username,
    per_page: 100,
  });

  // Initialize counters
  let totalCommits = 0;
  let totalIssues = 0;
  let totalPRs = 0;
  let totalMergedPRs = 0;
  let totalComments = 0;
  let stars = 0;
  let totalReleases = 0;

  // Calculate commits, issues, PRs, merged PRs, stars, releases, forks
  for (const repo of repos) {
    // Contributors stats for commits
    const stats = await octokit.rest.repos.getContributorsStats({
      owner: username,
      repo: repo.name,
    }).catch(() => null);

    // Issues (all state)
    const issues = await octokit.rest.issues.listForRepo({
      owner: username,
      repo: repo.name,
      state: 'all',
      per_page: 100,
    }).catch(() => null);

    // Pull requests (all state)
    const pulls = await octokit.rest.pulls.list({
      owner: username,
      repo: repo.name,
      state: 'all',
      per_page: 100,
    }).catch(() => null);

    // Releases
    const releases = await octokit.rest.repos.listReleases({
      owner: username,
      repo: repo.name,
      per_page: 100,
    }).catch(() => null);

    // Commits
    if (stats && Array.isArray(stats.data)) {
      const userStats = stats.data.find(s => s.author?.login === username);
      if (userStats) totalCommits += userStats.total;
    }

    // Issues count by user (exclude PRs)
    if (issues) {
      totalIssues += issues.data.filter(i => i.user?.login === username && !i.pull_request).length;
    }

    // PRs and merged PRs by user
    if (pulls) {
      totalPRs += pulls.data.filter(p => p.user?.login === username).length;
      totalMergedPRs += pulls.data.filter(p => p.user?.login === username && p.merged_at).length;
    }

    // Stars (stargazers count)
    stars += repo.stargazers_count;

    // Releases count
    if (releases) {
      totalReleases += releases.data.length;
    }
  }

  // Forks created by user (repo.fork === true)
  const forksCreated = repos.filter(r => r.fork).length;

  // Starred repos (stars given)
  const starredRepos = await octokit.paginate(octokit.rest.activity.listReposStarredByUser, {
    username,
    per_page: 100,
  });
  const totalStarsGiven = starredRepos.length;

  // Gists created
  const gists = await octokit.paginate(octokit.rest.gists.listForUser, {
    username,
    per_page: 100,
  });
  const totalGists = gists.length;

  // Get code review comments from authenticated user events (review comments only)
  const events = await octokit.paginate(octokit.rest.activity.listEventsForUser, {
    username,
    per_page: 100,
  });

  totalComments = events.filter(e => e.type === 'PullRequestReviewCommentEvent').length;

  return {
    commits: totalCommits,
    repos: repos.length,
    stars,
    followers: user.data.followers,
    issues: totalIssues,
    prs: totalPRs,
    mergedPrs: totalMergedPRs,
    comments: totalComments,
    forks: forksCreated,
    starsGiven: totalStarsGiven,
    gists: totalGists,
    releases: totalReleases,
  };
};

const main = async () => {
  const stats = await getUserStats();

  // XP calculation
  let totalXP = 0;
  totalXP += stats.issues * 5;
  totalXP += stats.prs * 10;
  totalXP += stats.mergedPrs * 20;
  totalXP += stats.comments * 2;

  // New XP sources:
  totalXP += stats.repos * 15;          // Repos created
  totalXP += stats.forks * 10;          // Forks created
  totalXP += stats.starsGiven * 1;      // Stars given
  totalXP += stats.gists * 10;           // Gists created
  totalXP += stats.releases * 20;       // Releases published

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
    .replace(/{{FORKS}}/g, stats.forks)
    .replace(/{{STARS_GIVEN}}/g, stats.starsGiven)
    .replace(/{{GISTS}}/g, stats.gists)
    .replace(/{{RELEASES}}/g, stats.releases)
    .replace(/{{TIMELINE}}/g, timeline);

  fs.writeFileSync(readmePath, readme);
  console.log('README.md updated successfully.');
};

main().catch(console.error);
