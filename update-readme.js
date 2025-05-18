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

// Function to get today's date in British time (Europe/London) as YYYY-MM-DD
function getBritishDateISO() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(now);

  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;

  return `${year}-${month}-${day}`;
}

// Function to decide whether to keep "Recent" label based on date string and max age in days
function shouldShowRecentLabel(dateString, maxDays = 30) {
  // dateString format: "YYYY-MM-DD"
  const today = getBritishDateISO();

  const date = new Date(dateString);
  const now = new Date(today);

  // Difference in ms
  const diffMs = now - date;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= maxDays;
}

async function main() {
  try {
    const username = "Seristic"; // Change to your GitHub username
    console.log(`Fetching GitHub stats for ${username}...`);
    const stats = await getStatsGraphQL(username);
    console.log("GitHub stats:", stats);

    // Example usage: recent date of your event
    const recentEventDate = "2025-05-01"; // Example event date
    const maxRecentDays = 30; // Show "Recent" label only if event is within last 30 days

    if (shouldShowRecentLabel(recentEventDate, maxRecentDays)) {
      console.log(`| 2025 | **Recent:** Important event happened on ${recentEventDate}. |`);
    } else {
      console.log(`| 2025 | Important event happened on ${recentEventDate}. |`);
    }

    // Your further processing and README update logic here...

  } catch (error) {
    console.error("Error fetching GitHub stats:", error);
  }
}

main();
