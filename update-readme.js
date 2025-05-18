import { graphql } from "@octokit/graphql";
import fs from 'fs/promises';
import path from 'path';

const token = process.env.PAT_TOKEN;
if (!token) {
  throw new Error("PAT_TOKEN env variable is required");
}

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${token}`,
  },
});

const README_PATH = path.resolve('./README.md');
const RECENT_LIFETIME_DAYS = 7; // Days to keep **Recent:** label before removing

async function loadReadme() {
  return fs.readFile(README_PATH, 'utf-8');
}

async function saveReadme(content) {
  return fs.writeFile(README_PATH, content, 'utf-8');
}

function removeOldRecents(readme, days = RECENT_LIFETIME_DAYS) {
  const lines = readme.split('\n');
  const now = new Date();

  const updatedLines = lines.map(line => {
    const timestampMatch = line.match(/<!-- timestamp:(\d{4}-\d{2}-\d{2}) -->/);
    if (!timestampMatch) return line;

    const timestamp = new Date(timestampMatch[1]);
    const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24);

    if (ageInDays >= days && line.includes('**Recent:**')) {
      // Remove "**Recent:** " from line but keep the rest intact
      return line.replace('**Recent:** ', '');
    }

    return line;
  });

  return updatedLines.join('\n');
}

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

    for (const repo of user.repositories.nodes) {
      totalStars += repo.stargazerCount || 0;

      if (repo.defaultBranchRef && repo.defaultBranchRef.target && repo.defaultBranchRef.target.history) {
        totalCommits += repo.defaultBranchRef.target.history.totalCount || 0;
      }

      totalPRs += repo.pullRequests.totalCount || 0;
      totalIssues += repo.issues.totalCount || 0;
    }

    afterCursor = user.repositories.pageInfo.hasNextPage ? user.repositories.pageInfo.endCursor : null;

  } while (afterCursor);

  return {
    totalCommits,
    totalPRs,
    totalIssues,
    totalStars,
    totalFollowers,
  };
}

async function main() {
  try {
    const username = "Seristic"; // Change to your GitHub username
    console.log(`Fetching GitHub stats for ${username}...`);
    const stats = await getStatsGraphQL(username);
    console.log("GitHub stats:", stats);

    // Load README content
    let readmeContent = await loadReadme();

    // Prepare today's date for timestamp
    const today = new Date().toISOString().slice(0, 10);

    // Example: New Recent line (customize as needed)
    const newRecentLine = `| 2025 | **Recent:** Updated GitHub stats for ${username} <!-- timestamp:${today} --> |`;

    // Check if newRecentLine already exists (prevent duplicates)
    if (!readmeContent.includes(newRecentLine)) {
      readmeContent += `\n${newRecentLine}`;
    }

    // Remove old Recent labels older than RECENT_LIFETIME_DAYS
    readmeContent = removeOldRecents(readmeContent, RECENT_LIFETIME_DAYS);

    // Save updated README
    await saveReadme(readmeContent);

    console.log("README.md updated with cleaned Recent labels!");

  } catch (error) {
    console.error("Error fetching GitHub stats:", error);
  }
}

main();
