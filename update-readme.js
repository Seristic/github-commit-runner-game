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

// Fetch commit count for a single repo using the contributors stats API
async function getCommitCountForRepo(owner, repoName) {
  try {
    const stats = await octokit.repos.getContributorsStats({ owner, repo: repoName });
    if (!Array.isArray(stats.data)) return 0;

    const userStats = stats.data.find(contributor =>
      contributor.author?.login?.toLowerCase() === USERNAME.toLowerCase()
    );
    return userStats ? userStats.total : 0;
  } catch (e) {
    if (e.status === 202) {
      console.warn(`Stats for repo "${repoName}" are being generated, returning 0 commits for now.`);
      return 0;
    }
    console.error(`Error fetching commit stats for repo "${repoName}":`, e);
    return 0;
  }
}

// ✅ New GraphQL-based PR stats
async function getPRStatsWithGraphQL(username) {
  const result = await octokit.graphql(
    `
    query($username: String!) {
      user(login: $username) {
        pullRequests {
          totalCount
        }
        contributionsCollection {
          pullRequestContributions(first: 100) {
            nodes {
              pullRequest {
                merged
              }
            }
          }
        }
      }
    }`,
    { username }
  );

  const totalPRs = result.user.pullRequests.totalCount;
  const mergedPRs = result.user.contributionsCollection.pullRequestContributions.nodes
    .filter(pr => pr.pullRequest.merged).length;

  return { totalPRs, mergedPRs };
}

async function getStats() {
  const repos = await octokit.paginate(octokit.repos.listForUser, {
    username: USERNAME,
    per_page: 100,
  });

  let totalCommits = 0;
  for (const repo of repos) {
    const count = await getCommitCountForRepo(USERNAME, repo.name);
    totalCommits += count;
  }

  const issues = await octokit.paginate(octokit.issues.listForUser, {
    username: USERNAME,
    filter: 'created',
    state: 'all',
    per_page: 100,
  });

  const { totalPRs, mergedPRs } = await getPRStatsWithGraphQL(USERNAME);

  const userData = await octokit.users.getByUsername({ username: USERNAME });
  const followers = userData.data.followers;

  let totalStars = 0;
  let totalComments = 0;

  for (const repo of repos) {
    totalStars += repo.stargazers_count;

    const issueComments = await octokit.paginate(octokit.issues.listCommentsForRepo, {
      owner: USERNAME,
      repo: repo.name,
      per_page: 100,
    });
    totalComments += issueComments.filter(c => c.user.login === USERNAME).length;

    const prReviewComments = await octokit.paginate(octokit.pulls.listReviewCommentsForRepo, {
      owner: USERNAME,
      repo: repo.name,
      per_page: 100,
    });
    totalComments += prReviewComments.filter(c => c.user.login === USERNAME).length;
  }

  return {
    commits: totalCommits,
    issues: issues.length,
    prs: totalPRs,
    mergedPRs,
    repos: repos.length,
    followers,
    stars: totalStars,
    comments: totalComments,
  };
}

function calculateLevel(xp) {
  return Math.floor(xp / 100);
}

function calculateXP(xp) {
  return xp % 100;
}

function calculateTotalXP(stats) {
  return (
    stats.commits * 1 +
    stats.issues * 5 +
    stats.prs * 10 +
    stats.mergedPRs * 20 +
    stats.comments * 2 +
    stats.stars * 3 +
    stats.followers * 10
  );
}

async function main() {
  try {
    console.log('Fetching GitHub stats for', USERNAME);
    const stats = await getStats();

    const totalXP = calculateTotalXP(stats);
    const level = calculateLevel(totalXP);
    const xp = calculateXP(totalXP);
    const bar = xpBar(xp);
    const nextXP = 100 - xp;

    console.log(`Level: ${level}, XP: ${xp}, Total XP: ${totalXP}`);

    let template = readFileSync('README.template.md', 'utf-8');

    const transFlag = `
<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Transgender_Pride_flag.svg/320px-Transgender_Pride_flag.svg.png" alt="Trans Pride Flag" width="200" />
</p>
`;

    template = template
      .replace(/{{USERNAME}}/g, USERNAME)
      .replace(/{{LEVEL}}/g, level.toString())
      .replace(/{{XP_BAR}}/g, bar)
      .replace(/{{XP}}/g, xp.toString())
      .replace(/{{NEXT_XP}}/g, nextXP.toString())
      .replace(/{{COMMITS}}/g, stats.commits.toString())
      .replace(/{{ISSUES}}/g, stats.issues.toString())
      .replace(/{{PRS}}/g, stats.prs.toString())
      .replace(/{{MERGEDPRS}}/g, stats.mergedPRs.toString())
      .replace(/{{COMMENTS}}/g, stats.comments.toString())
      .replace(/{{STARS}}/g, stats.stars.toString())
      .replace(/{{FOLLOWERS}}/g, stats.followers.toString())
      .replace(/{{REPOS}}/g, stats.repos.toString())
      .replace(/{{TRANS_FLAG}}/g, transFlag);
