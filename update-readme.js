import { graphql } from "@octokit/graphql";

const token = process.env.PAT_TOKEN;
if (!token) {
  throw new Error("PAT_TOKEN env variable is required");
}

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${token}`,
  },
});

// Helper function to get user ID needed for commit queries
async function getUserId(username) {
  const query = `
    query($username: String!) {
      user(login: $username) {
        id
      }
    }
  `;
  const response = await graphqlWithAuth(query, { username });
  return response.user.id;
}

// Fetch stats via GitHub GraphQL API
async function getStatsGraphQL(username) {
  let afterCursor = null;
  let totalCommits = 0;
  let totalPRs = 0;
  let totalIssues = 0;
  let totalStars = 0;
  let totalFollowers = 0;
  let totalRepos = 0;

  const userId = await getUserId(username);

  do {
    const query = `
      query($username: String!, $afterCursor: String, $userId: ID!) {
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

    const variables = {
      username,
      afterCursor,
      userId,
    };

    const response = await graphqlWithAuth(query, variables);
    const user = response.user;

    if (!user) {
      throw new Error(`User ${username} not found.`);
    }

    totalFollowers = user.followers.totalCount;
    totalRepos = user.repositories.totalCount;

    for (const repo of user.repositories.nodes) {
      totalStars += repo.stargazerCount || 0;

      if (
        repo.defaultBranchRef &&
        repo.defaultBranchRef.target &&
        repo.defaultBranchRef.target.history
      ) {
        totalCommits += repo.defaultBranchRef.target.history.totalCount || 0;
      }

      totalPRs += repo.pullRequests.totalCount || 0;
      totalIssues += repo.issues.totalCount || 0;
    }

    afterCursor = user.repositories.pageInfo.hasNextPage
      ? user.repositories.pageInfo.endCursor
      : null;
  } while (afterCursor);

  return {
    totalCommits,
    totalPRs,
    totalIssues,
    totalStars,
    totalFollowers,
    totalRepos,
  };
}

// 30-day recent check
function shouldShowRecentLabel(eventTimestamp) {
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000; // milliseconds
  return now - eventTimestamp <= THIRTY_DAYS;
}

async function main() {
  try {
    const username = "Seristic"; // Change this to your GitHub username
    console.log(`Fetching GitHub stats for ${username}...`);

    const stats = await getStatsGraphQL(username);
    console.log("GitHub stats:", stats);

    // Example event date for your "Recent" label
    // Update this to your actual event date (UTC ISO string recommended)
    const eventTimestamp = new Date("2025-04-18T00:00:00Z").getTime();

    const recentLabel = shouldShowRecentLabel(eventTimestamp) ? "**Recent:**" : "";

    // Prepare your README content
    const readmeContent = `
| 2025 | ${recentLabel} Important update affecting trans rights — this is a significant moment. |

Attributes:
💻 Commits: ${stats.totalCommits}
🛠 Repositories: ${stats.totalRepos}
⭐ Stars: ${stats.totalStars}
👥 Followers: ${stats.totalFollowers}

⚔️ Combat Log
Action              Count      XP Value
🔧 Issues Opened     ${stats.totalIssues}        🪙 +5 XP each
🛡 Pull Requests     ${stats.totalPRs}         🪙 +10 XP each
⚔ Merged Pull Requests (estimate)   TODO        🪙 +20 XP each
💬 Code Comments     TODO       🪙 +2 XP each
`;

    console.log(readmeContent);

    // Here you would write readmeContent to your README.md file as needed.

  } catch (error) {
    console.error("Error fetching GitHub stats:", error);
  }
}

main();
