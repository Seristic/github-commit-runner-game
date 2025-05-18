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

// Get user ID (needed for commit author filtering)
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

async function getStatsGraphQL(username) {
  let afterCursor = null;

  let totalCommits = 0;
  let totalPRs = 0;
  let totalMergedPRs = 0;
  let totalIssues = 0;
  let totalStars = 0;
  let totalFollowers = 0;
  let totalComments = 0;

  const userId = await getUserId(username);

  do {
    const query = `
      query($username: String!, $afterCursor: String, $userId: ID!) {
        user(login: $username) {
          followers {
            totalCount
          }
          repositories(ownerAffiliations: OWNER, first: 50, after: $afterCursor) {
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
              pullRequestsAll: pullRequests(states: [OPEN, CLOSED, MERGED]) {
                totalCount
              }
              mergedPullRequests: pullRequests(states: MERGED) {
                totalCount
              }
              issues {
                totalCount
              }
              pullRequestComments: pullRequests {
                comments {
                  totalCount
                }
              }
            }
          }
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

    for (const repo of user.repositories.nodes) {
      totalStars += repo.stargazerCount || 0;

      if (repo.defaultBranchRef && repo.defaultBranchRef.target && repo.defaultBranchRef.target.history) {
        totalCommits += repo.defaultBranchRef.target.history.totalCount || 0;
      }

      totalPRs += repo.pullRequestsAll.totalCount || 0;
      totalMergedPRs += repo.mergedPullRequests.totalCount || 0;
      totalIssues += repo.issues.totalCount || 0;

      // Sum all comments on pull requests
      if (repo.pullRequestComments && repo.pullRequestComments.comments) {
        totalComments += repo.pullRequestComments.comments.totalCount || 0;
      }
    }

    afterCursor = user.repositories.pageInfo.hasNextPage ? user.repositories.pageInfo.endCursor : null;

  } while (afterCursor);

  return {
    totalCommits,
    totalPRs,
    totalMergedPRs,
    totalIssues,
    totalStars,
    totalFollowers,
    totalComments,
  };
}

// This is your main function where you can also update your README or calculate levels
async function main() {
  try {
    const username = "Seristic"; // Change to your GitHub username
    console.log(`Fetching GitHub stats for ${username}...`);
    const stats = await getStatsGraphQL(username);
    console.log("GitHub stats:", stats);

    // Example: you can replace placeholders here or update README file

  } catch (error) {
    console.error("Error fetching GitHub stats or updating README:", error);
  }
}

main();
