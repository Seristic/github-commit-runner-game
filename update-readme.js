import fs from 'fs';
import path from 'path';
import { graphql } from '@octokit/graphql';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

config({ path: './.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.PAT_TOKEN) {
  throw new Error('PAT_TOKEN environment variable is required!');
}

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.PAT_TOKEN}`,
  },
});

const username = 'Seristic';
const readmePath = path.join(__dirname, 'README.md');

// Milestones and timeline formatting (unchanged)
const milestones = [
  { year: 2020, label: "Was in College studying in Computing Science", date: new Date("2020-01-01") },
  { year: 2022, label: "Came out as trans and started integrating my identity into my work and community.", date: new Date("2022-01-01") },
  { year: 2025, label: "Endured the impact of a devastating ruling undermining trans rights — a stark reminder of the ongoing fight for dignity and existence.", date: new Date("2025-05-01") },
];

const toMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const humanAgo = (days) => {
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days <= 7) return `${days} days ago`;
  if (days <= 30) return `${Math.floor(days / 7)} week(s) ago`;
  return null;
};

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

// Helper to paginate repositories in GraphQL
async function fetchAllRepos(login) {
  let repos = [];
  let hasNextPage = true;
  let after = null;

  while (hasNextPage) {
    const res = await graphqlWithAuth(
      `
      query ($login: String!, $after: String) {
        user(login: $login) {
          repositories(first: 50, after: $after, ownerAffiliations: OWNER, isFork: false) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              name
              stargazerCount
              defaultBranchRef {
                name
              }
            }
          }
        }
      }
      `,
      { login, after }
    );

    repos = repos.concat(res.user.repositories.nodes);
    hasNextPage = res.user.repositories.pageInfo.hasNextPage;
    after = res.user.repositories.pageInfo.endCursor;
  }

  return repos;
}

// Helper to fetch commits count on default branch per repo
async function fetchCommitsCount(owner, repoName, authorId) {
  // If no default branch, return 0 commits
  if (!repoName) return 0;

  const query = `
  query($owner: String!, $repoName: String!, $authorId: ID!) {
    repository(owner: $owner, name: $repoName) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(author: {id: $authorId}) {
              totalCount
            }
          }
        }
      }
    }
  }`;

  try {
    const res = await graphqlWithAuth(query, { owner, repoName, authorId });
    const history = res.repository?.defaultBranchRef?.target?.history;
    return history ? history.totalCount : 0;
  } catch {
    return 0;
  }
}

// Helper to fetch PRs and issues created by user per repo
async function fetchPRsAndIssues(owner, repoName, login) {
  const query = `
  query($owner: String!, $repoName: String!, $login: String!) {
    repository(owner: $owner, name: $repoName) {
      pullRequests(first: 100, states: [OPEN, MERGED, CLOSED], orderBy: {field: CREATED_AT, direction: DESC}, filterBy: {createdBy: $login}) {
        nodes {
          merged
        }
        totalCount
      }
      issues(first: 100, states: [OPEN, CLOSED], filterBy: {createdBy: $login}) {
        totalCount
      }
    }
  }`;

  try {
    const res = await graphqlWithAuth(query, { owner, repoName, login });
    const prs = res.repository.pullRequests;
    const issues = res.repository.issues;
    const mergedPRsCount = prs.nodes.filter(pr => pr.merged).length;
    return {
      prsCount: prs.totalCount,
      mergedPRsCount,
      issuesCount: issues.totalCount,
    };
  } catch {
    return {
      prsCount: 0,
      mergedPRsCount: 0,
      issuesCount: 0,
    };
  }
}

// Fetch Pull Request Review Comments count via events pagination
async function fetchPRReviewComments(login) {
  // Events only return last 300 events max, so this is approximate
  let totalComments = 0;
  let page = 1;
  let keepGoing = true;

  while (keepGoing && page <= 10) { // limit pages to avoid rate limiting
    try {
      const res = await graphqlWithAuth(
        `
        query($login: String!, $after: String) {
          user(login: $login) {
            contributionsCollection {
              pullRequestReviewContributions(first: 100, after: $after) {
                totalCount
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  pullRequestReview {
                    id
                  }
                }
              }
            }
          }
        }
        `,
        { login, after: null }
      );
      // This query does not actually support pagination of PR reviews well,
      // GitHub GraphQL is limited here, so we use totalCount if available
      if (res.user.contributionsCollection.pullRequestReviewContributions) {
        totalComments = res.user.contributionsCollection.pullRequestReviewContributions.totalCount;
      }
      keepGoing = false; // exit after first fetch (approximate)
    } catch {
      keepGoing = false;
    }
  }

  return totalComments;
}

// Main stats fetching logic
async function getUserStats() {
  // Get user ID and followers count
  const userRes = await graphqlWithAuth(
    `query($login: String!) {
      user(login: $login) {
        id
        followers {
          totalCount
        }
      }
    }`,
    { login: username }
  );

  const userId = userRes.user.id;
  const followers = userRes.user.followers.totalCount;

  // Fetch all repositories owned by user
  const repos = await fetchAllRepos(username);

  // Initialize counters
  let totalCommits = 0;
  let totalIssues = 0;
  let totalPRs = 0;
  let totalMergedPRs = 0;
  let stars = 0;

  for (const repo of repos) {
    stars += repo.stargazerCount;

    const commitsCount = await fetchCommitsCount(username, repo.name, userId);
    totalCommits += commitsCount;

    const { prsCount, mergedPRsCount, issuesCount } = await fetchPRsAndIssues(username, repo.name, username);
    totalPRs += prsCount;
    totalMergedPRs += mergedPRsCount;
    totalIssues += issuesCount;
  }

  const totalComments = await fetchPRReviewComments(username);

  return {
    commits: totalCommits,
    repos: repos.length,
    stars,
    followers,
    issues: totalIssues,
    prs: totalPRs,
    mergedPrs: totalMergedPRs,
    comments: totalComments,
  };
}

const main = async () => {
  const stats = await getUserStats();

  const totalXP = stats.issues * 5 + stats.prs * 10 + stats.mergedPrs * 20 + stats.comments * 2;
  const level = calculateLevel(totalXP);
  const xp = totalXP % 100;
  const xpBar = generateXPBar(xp);
  const timeline = formatTimeline();

  let readme = fs.readFileSync(readmePath, 'utf-8');

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

main().catch((e) => {
  console.error('Error updating README:', e);
  process.exit(1);
});
