import { graphql } from "@octokit/graphql";
import fs from "fs/promises";

const token = process.env.PAT_TOKEN;
if (!token) {
  throw new Error("PAT_TOKEN env variable is required");
}

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${token}`,
  },
});

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
  let totalRepos = 0;

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
              pullRequests(states: [OPEN, MERGED, CLOSED]) {
                totalCount
                totalMerged: totalCount(states: MERGED)
              }
              issues {
                totalCount
              }
              pullRequestsComments: pullRequests {
                totalCount
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
    totalRepos = user.repositories.totalCount;

    for (const repo of user.repositories.nodes) {
      totalStars += repo.stargazerCount || 0;

      if (repo.defaultBranchRef && repo.defaultBranchRef.target && repo.defaultBranchRef.target.history) {
        totalCommits += repo.defaultBranchRef.target.history.totalCount || 0;
      }

      totalPRs += repo.pullRequests.totalCount || 0;
      totalMergedPRs += repo.pullRequests.totalMerged || 0;
      totalIssues += repo.issues.totalCount || 0;

      // Note: GitHub API doesn't directly give comments on PRs/issues here
      // So just example placeholder, you might want to query comments separately if needed
      totalComments += repo.pullRequestsComments?.totalCount || 0;
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
    totalRepos,
  };
}

async function main() {
  try {
    const username = "Seristic"; // Change this to your GitHub username
    console.log(`Fetching GitHub stats for ${username}...`);
    const stats = await getStatsGraphQL(username);
    console.log("GitHub stats:", stats);

    // Read the template README file with placeholders
    const template = await fs.readFile("README-template.md", "utf8");

    // Replace placeholders with actual data
    const output = template
      .replace(/{{USERNAME}}/g, username)
      .replace(/{{COMMITS}}/g, stats.totalCommits)
      .replace(/{{PRS}}/g, stats.totalPRs)
      .replace(/{{MERGEDPRS}}/g, stats.totalMergedPRs)
      .replace(/{{ISSUES}}/g, stats.totalIssues)
      .replace(/{{STARS}}/g, stats.totalStars)
      .replace(/{{FOLLOWERS}}/g, stats.totalFollowers)
      .replace(/{{COMMENTS}}/g, stats.totalComments)
      .replace(/{{REPOS}}/g, stats.totalRepos)
      // Add more replacements here as needed
      ;

    // Write to README.md (this will be your public profile README)
    await fs.writeFile("README.md", output);

    console.log("README.md updated successfully!");
  } catch (error) {
    console.error("Error fetching GitHub stats or updating README:", error);
    process.exit(1);
  }
}

main();
