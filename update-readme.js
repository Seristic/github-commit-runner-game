import { graphql } from "@octokit/graphql";
import fs from "fs";

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
  let totalRepos = 0;
  let totalComments = 0;

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
                nodes {
                  state
                  comments {
                    totalCount
                  }
                }
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
    totalRepos = user.repositories.totalCount;

    for (const repo of user.repositories.nodes) {
      totalStars += repo.stargazerCount || 0;

      if (repo.defaultBranchRef && repo.defaultBranchRef.target && repo.defaultBranchRef.target.history) {
        totalCommits += repo.defaultBranchRef.target.history.totalCount || 0;
      }

      totalPRs += repo.pullRequests.totalCount || 0;
      totalIssues += repo.issues.totalCount || 0;

      // Count merged PRs and sum comments on PRs
      for (const pr of repo.pullRequests.nodes) {
        if (pr.state === "MERGED") totalMergedPRs++;
        totalComments += pr.comments.totalCount || 0;
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
    totalRepos,
    totalComments,
  };
}

async function main() {
  try {
    const username = "Seristic"; // Change to your GitHub username
    console.log(`Fetching GitHub stats for ${username}...`);
    const stats = await getStatsGraphQL(username);
    console.log("GitHub stats:", stats);

    const template = `
Attribute    Value
💻 Commits   {{COMMITS}}
🛠 Repositories  {{REPOS}}
⭐ Stars     {{STARS}}
👥 Followers {{FOLLOWERS}}
⚔️ Combat Log
Action    Count    XP Value
🔧 Issues Opened    {{ISSUES}}    🪙 +5 XP each
🛡 Pull Requests    {{PRS}}    🪙 +10 XP each
⚔ Merged Pull Requests    {{MERGEDPRS}}    🪙 +20 XP each
💬 Code Comments    {{COMMENTS}}    🪙 +2 XP each
`;

    const filledTemplate = template
      .replace(/{{COMMITS}}/g, stats.totalCommits)
      .replace(/{{REPOS}}/g, stats.totalRepos)
      .replace(/{{STARS}}/g, stats.totalStars)
      .replace(/{{FOLLOWERS}}/g, stats.totalFollowers)
      .replace(/{{ISSUES}}/g, stats.totalIssues)
      .replace(/{{PRS}}/g, stats.totalPRs)
      .replace(/{{MERGEDPRS}}/g, stats.totalMergedPRs)
      .replace(/{{COMMENTS}}/g, stats.totalComments);

    console.log("\n===== README OUTPUT =====\n");
    console.log(filledTemplate);

    // Optionally write to README.md file:
    // fs.writeFileSync('README.md', filledTemplate, 'utf8');

  } catch (error) {
    console.error("Error fetching GitHub stats:", error);
  }
}

main();
