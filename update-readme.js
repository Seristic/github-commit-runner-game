import { writeFileSync, readFileSync } from 'fs';
import { Octokit } from '@octokit/rest';

const PAT = process.env.PAT_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME;

if (!PAT || !USERNAME) {
  console.error('Missing PAT_TOKEN or GITHUB_USERNAME environment variables');
  process.exit(1);
}

const octokit = new Octokit({ auth: PAT });

function xpBar(xp) {
  const fullBlocks = Math.floor(xp / 10);
  const emptyBlocks = 10 - fullBlocks;
  return '█'.repeat(fullBlocks) + '░'.repeat(emptyBlocks);
}

async function getStats() {
  // List all public repos of the user
  const repos = await octokit.paginate(octokit.repos.listForUser, {
    username: USERNAME,
    per_page: 100,
  });

  // Approximate commits: repos * 100 (GitHub API limits full count for commits)
  const totalCommits = repos.length * 100;

  // Get issues opened by the user (all states)
  const issues = await octokit.paginate(octokit.issues.listForUser, {
    username: USERNAME,
    filter: 'created',
    state: 'all',
    per_page: 100,
  });

  // Get total PRs created by user using Search API
const issuesResult = await octokit.search.issuesAndPullRequests({
  q: `is:issue author:${USERNAME}`,
  per_page: 1,
});
const totalIssues = issuesResult.data.total_count;

  return {
    commits: totalCommits,
    issues: issues.length,
    prs: prsResult.data.total_count,
    repos: repos.length,
  };
}

function calculateLevel(xp) {
  return Math.floor(xp / 100);
}

function calculateXP(xp) {
  return xp % 100;
}

async function main() {
  console.log('Fetching GitHub stats for', USERNAME);
  const stats = await getStats();

  const level = calculateLevel(stats.commits);
  const xp = calculateXP(stats.commits);
  const bar = xpBar(xp);

  console.log(`Level: ${level}, XP: ${xp}, Commits: ${stats.commits}`);

  let template = readFileSync('README.template.md', 'utf-8');

  // Replace placeholders
  template = template
    .replace(/{{USERNAME}}/g, USERNAME)
    .replace(/{{LEVEL}}/g, level)
    .replace(/{{XP_BAR}}/g, bar)
    .replace(/{{COMMITS}}/g, stats.commits)
    .replace(/{{ISSUES}}/g, stats.issues)
    .replace(/{{PRS}}/g, stats.prs)
    .replace(/{{REPOS}}/g, stats.repos);

  writeFileSync('README.md', template);

  console.log('README.md updated!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
