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

// Check if "Recent" label should appear within maxSeconds after eventTimestamp
function shouldShowRecentLabel(eventTimestamp, maxSeconds) {
  const now = Date.now();
  const diffSeconds = (now - eventTimestamp) / 1000;

  console.log(`Current time (ms): ${now}`);
  console.log(`Event time (ms): ${eventTimestamp}`);
  console.log(`Time difference (seconds): ${diffSeconds}`);

  return diffSeconds >= 0 && diffSeconds <= maxSeconds;
}

async function main() {
  try {
    const username = "Seristic"; // Your GitHub username
    console.log(`Fetching GitHub stats for ${username}...`);
    const stats = await getStatsGraphQL(username);
    console.log("GitHub stats:", stats);

    // Replace with the actual event timestamp (ISO 8601 string)
    // Make sure this timestamp is in the past or right now (UTC)
    const eventDateStr = new Date().toISOString(); // For testing, use current time
    const eventTimestamp = new Date(eventDateStr).getTime();

    const maxSeconds = 20; // Show "Recent" if within 20 seconds

    const recentLabel = shouldShowRecentLabel(eventTimestamp, maxSeconds)
      ? "**Recent:**"
      : "";

    // Read README template
    const readmeTemplatePath = path.join(process.cwd(), "README.template.md");
    const readmeOutputPath = path.join(process.cwd(), "README.md");
    let readmeContent = fs.readFileSync(readmeTemplatePath, "utf-8");

    // Replace placeholders
    readmeContent = readmeContent
      .replace(/{{RECENT_LABEL}}/g, recentLabel)
      .replace(/{{TOTAL_COMMITS}}/g, stats.totalCommits)
      .replace(/{{TOTAL_PRS}}/g, stats.totalPRs)
      .replace(/{{TOTAL_ISSUES}}/g, stats.totalIssues)
      .replace(/{{TOTAL_STARS}}/g, stats.totalStars)
      .replace(/{{TOTAL_FOLLOWERS}}/g, stats.totalFollowers);

    fs.writeFileSync(readmeOutputPath, readmeContent, "utf-8");

    console.log("README.md updated successfully!");

  } catch (error) {
    console.error("Error:", error);
  }
}

main();
