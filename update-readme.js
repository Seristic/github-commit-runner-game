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

function calculateLevel(xp) {
  return Math.floor(xp / 100);
}

function calculateXP(xp) {
  return xp % 100;
}

function calculateTotalXP(stats) {
  return (
    stats.commits * 1 +         // 1 XP per commit
    stats.issues * 5 +          // 5 XP per issue opened
    stats.prs * 10 +            // 10 XP per PR created
    stats.mergedPRs * 20 +      // 20 XP per merged PR
    stats.comments * 2 +        // 2 XP per comment made
    stats.stars * 3 +           // 3 XP per star received
    stats.followers * 10        // 10 XP per follower
  );
}

async function getStatsGraphQL() {
  const query = `
    query($username: String!, $afterCursor: String) {
      user(login: $username) {
        followers {
          totalCount
        }
        repositories(ownerAffiliations: OWNER, first: 100, after: $afterCursor) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            stargazerCount
            defaultBranchRef {
              target {
                ... on Commit {
                  history(author: {id: $userId}) {
                    totalCount
                  }
                }
              }
            }
            pullRequests(states: [OPEN, MERGED, CLOSED]) {
              totalCount
            }
            issues {
              totalCount
            }
          }
        }
      }
      viewer {
        id
      }
    }
  `;

  // We first need user id for author commit filter:
  const { data: userData } = await octokit.rest.users.getByUsername({ username: USERNAME });
  const userId = userData.id;

  let hasNextPage = true;
  let afterCursor = null;

  let totalStars = 0;
  let totalCommits = 0;
  let totalIssues = 0;
  let totalPRs = 0;

  while (hasNextPage) {
    const result = await octokit.graphql(query, {
      username: USERNAME,
      afterCursor,
      userId,
    });

    const user = result.user;
    if (!user) {
      throw new Error('User not found');
    }

    const repos = user.repositories.nodes;

    for (const repo of repos) {
      totalStars += repo.stargazerCount;

      // Commits might be null if defaultBranchRef is missing (empty repo)
      if (repo.defaultBranchRef && repo.defaultBranchRef.target.history) {
        totalCommits += repo.defaultBranchRef.target.history.totalCount;
      }

      totalIssues += repo.issues.totalCount;
      totalPRs += repo.pullRequests.totalCount;
    }

    hasNextPage = user.repositories.pageInfo.hasNextPage;
    afterCursor = user.repositories.pageInfo.endCursor;
  }

  // For merged PRs and comments, we need separate queries, or do some rough counts from REST API if you want.

  // Let's get merged PRs count via GraphQL
  const mergedPRsQuery = `
    query($username: String!, $afterCursor: String) {
      user(login: $username) {
        pullRequests(states: MERGED, first: 100, after: $afterCursor) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  let mergedPRs = 0;
  hasNextPage = true;
  afterCursor = null;
  while (hasNextPage) {
    const res = await octokit.graphql(mergedPRsQuery, {
      username: USERNAME,
      afterCursor,
    });

    const prs = res.user.pullRequests;
    mergedPRs = prs.totalCount;
    hasNextPage = prs.pageInfo.hasNextPage;
    afterCursor = prs.pageInfo.endCursor;
  }

  // For comments count (issue comments + PR review comments), no straightforward way in GraphQL to get total count easily.
  // So fallback to REST API (paginate).

  // Issue comments
  const issueComments = await octokit.paginate(octokit.issues.listCommentsForUser, {
    username: USERNAME,
    per_page: 100,
  }).catch(() => []);

  // PR review comments
  const prReviewComments = await octokit.paginate(octokit.pulls.listReviewCommentsForUser, {
    username: USERNAME,
    per_page: 100,
  }).catch(() => []);

  const totalComments = (issueComments.length || 0) + (prReviewComments.length || 0);

  // Followers count from GraphQL
  const followers = result.user.followers.totalCount;

  return {
    commits: totalCommits,
    issues: totalIssues,
    prs: totalPRs,
    mergedPRs,
    stars: totalStars,
    followers,
    comments: totalComments,
  };
}

async function main() {
  try {
    console.log('Fetching GitHub stats for', USERNAME);
    const stats = await getStatsGraphQL();

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
      .replace(/{{REPOS}}/g, 'N/A')  // We don’t use repos count here but can add if needed
      .replace(/{{TRANS_FLAG}}/g, transFlag);

    writeFileSync('README.md', template);
    console.log('README.md updated!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
