import { graphql } from "@octokit/graphql";
import fs from "fs";
import path from "path";

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
  let totalIssues = 0;
  let totalStars = 0;
  let totalFollowers = 0;

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
  };
}

// Function to determine if the "Recent" label should show based on maxSeconds (20 seconds here)
function shouldShowRecentLabel(eventDateTimestamp, maxSeconds) {
  const now = Date.now();
  const diffSeconds = (now - eventDateTimestamp) / 1000;
  return diffSeconds <= maxSeconds;
}

async function main() {
  try {
    const username = "Seristic"; // Change to your GitHub username
    console.log(`Fetching GitHub stats for ${username}...`);
    const stats = await getStatsGraphQL(username);
    console.log("GitHub stats:", stats);

    // Example event date/time for the recent event (ISO 8601 string)
    const eventDateStr = "2025-05-18T19:00:00Z"; // Adjust to your event time UTC
    const eventTimestamp = new Date(eventDateStr).getTime();

    // Set maxSeconds to 20 for demo/testing
    const maxSeconds = 60;

    const recentLabel = shouldShowRecentLabel(eventTimestamp, maxSeconds)
      ? "**Recent:**"
      : "";

    // Read your README template file
    const readmeTemplatePath = path.join(process.cwd(), "README.template.md");
    const readmeOutputPath = path.join(process.cwd(), "README.md");
    let readmeContent = fs.readFileSync(readmeTemplatePath, "utf-8");

    // Replace placeholders in your README template
    readmeContent = readmeContent
      .replace(/{{RECENT_LABEL}}/g, recentLabel)
      .replace(/{{TOTAL_COMMITS}}/g, stats.totalCommits)
      .replace(/{{TOTAL_PRS}}/g, stats.totalPRs)
      .replace(/{{TOTAL_ISSUES}}/g, stats.totalIssues)
      .replace(/{{TOTAL_STARS}}/g, stats.totalStars)
      .replace(/{{TOTAL_FOLLOWERS}}/g, stats.totalFollowers);

    // Write updated README file
    fs.writeFileSync(readmeOutputPath, readmeContent, "utf-8");

    console.log("README.md updated successfully!");

  } catch (error) {
    console.error("Error:", error);
  }
}

main();
