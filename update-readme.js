import fs from 'fs';
import path from 'path';
import { graphql } from '@octokit/graphql';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { Octokit } from "@octokit/rest";

config({ path: './.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.PAT_TOKEN) {
  throw new Error('PAT_TOKEN environment variable is required!');
}

const octokit = new Octokit({ auth: process.env.PAT_TOKEN });

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.PAT_TOKEN}`,
  },
});

const username = 'Seristic';
const readmePath = path.join(__dirname, 'README.md');

// --- Helper functions omitted for brevity (formatTimeline, generateXPBar, calculateLevel) ---

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
              fork
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

async function fetchCommitsCount(owner, repoName, authorId) {
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
    return res.repository?.defaultBranchRef?.target?.history?.totalCount || 0;
  } catch {
    return 0;
  }
}

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

async function fetchPRReviewComments(login) {
  try {
    const res = await graphqlWithAuth(
      `
      query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            pullRequestReviewContributions {
              totalCount
            }
          }
        }
      }
      `,
      { login }
    );
    return res.user.contributionsCollection.pullRequestReviewContributions.totalCount || 0;
  } catch {
    return 0;
  }
}

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

  // Fetch all repos owned by user
  const repos = await fetchAllRepos(username);

  // Initialize counters
  let totalCommits = 0;
  let totalIssues = 0;
  let totalPRs = 0;
  let totalMergedPRs = 0;
  let totalComments = 0;
  let stars = 0;
  let totalReleases = 0;

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

    // Commits count
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
    stars += repo.stargazerCount || 0;

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

  // Get code review comments count (approximate)
  totalComments = await fetchPRReviewComments(username);

  return {
    commits: totalCommits,
    repos: repos.length,
    stars,
    followers,
    issues: totalIssues,
    prs: totalPRs,
    mergedPrs: totalMergedPRs,
    comments: totalComments,
    forks: forksCreated,
    starsGiven: totalStarsGiven,
    gists: totalGists,
    releases: totalReleases,
  };
}

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
  const bar = generateXPBar(xp);

  const readme = fs.readFileSync(readmePath, 'utf-8');

  const updatedReadme = readme
    .replace(/XP: \d+ \| Level: \d+/g, `XP: ${totalXP} | Level: ${level}`)
    .replace(/XP: \d+% \| \[.+\]/g, `XP: ${xp}% | ${bar}`);

  fs.writeFileSync(readmePath, updatedReadme);

  console.log('README.md updated successfully!');
};

main().catch(console.error);
