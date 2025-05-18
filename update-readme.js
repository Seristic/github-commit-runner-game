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
  const colors = ['#55CDFC', '#F7A8B8', '#FFFFFF', '#F7A8B8', '#55CDFC'];
  const totalBlocks = 10;
  const fullBlocks = Math.floor(xp / 10);
  let bar = '';

  for (let i = 0; i < fullBlocks; i++) {
    // Cycle colors for each block
    const color = colors[i % colors.length];
    bar += `<span style="color:${color}">█</span>`;
  }
  for (let i = fullBlocks; i < totalBlocks; i++) {
    bar += '░';
  }
  return bar;
}

async function getStats() {
  // Fetch all public repos for the user (max 100)
  const repos = await octokit.paginate(octokit.repos.listForUser, {
    username: USERNAME,
    per_page: 100,
  });

  // Approximate commits as repos * 100 (GitHub doesn't expose total commits directly easily)
  const totalCommits = repos.length * 100;

  // Fetch all issues created by the user
  const issues = await octokit.paginate(octokit.issues.listForUser, {
    username: USERNAME,
    filter: 'created',
    state: 'all',
    per_page: 100,
  });

  // Fetch total PRs created by the user using search API
  const prsResult = await octokit.search.issuesAndPullRequests({
    q: `is:pr author:${USERNAME}`,
    per_page: 1,
  });
  const totalPRs = prsResult.data.total_count;

  // Fetch merged PRs count (bonus XP)
  const mergedPRsResult = await octokit.search.issuesAndPullRequests({
    q: `is:pr author:${USERNAME} is:merged`,
    per_page: 1,
  });
  const mergedPRs = mergedPRsResult.data.total_count;

  // Fetch user details to get followers count
  const userData = await octokit.users.getByUsername({ username: USERNAME });
  const followers = userData.data.followers;

  // Calculate total stars across all repos
  let totalStars = 0;
  for (const repo of repos) {
    totalStars += repo.stargazers_count;
  }

  // Count comments made by the user on issues and PR reviews in their own repos
  let totalComments = 0;
  for (const repo of repos) {
    // Issue comments
    const issueComments = await octokit.paginate(octokit.issues.listCommentsForRepo, {
      owner: USERNAME,
      repo: repo.name,
      per_page: 100,
    });
    totalComments += issueComments.filter(c => c.user.login === USERNAME).length;

    // PR review comments
    const prReviewComments = await octokit.paginate(octokit.pulls.listReviewCommentsForRepo, {
      owner: USERNAME,
      repo: repo.name,
      per_page: 100,
    });
    totalComments += prReviewComments.filter(c => c.user.login === USERNAME).length;
  }

  return {
    commits: totalCommits,
    issues: issues.length,
    prs: totalPRs,
    mergedPRs,
    repos: repos.length,
    followers,
    stars: totalStars,
    comments: totalComments,
  };
}

function calculateLevel(xp) {
  return Math.floor(xp / 100);
}

function calculateXP(xp) {
  return xp % 100;
}

// Calculate total XP with weights for different activities
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

async function main() {
  try {
    console.log('Fetching GitHub stats for', USERNAME);
    const stats = await getStats();

    const totalXP = calculateTotalXP(stats);
    const level = calculateLevel(totalXP);
    const xp = calculateXP(totalXP);
    const bar = xpBar(xp);

    console.log(`Level: ${level}, XP: ${xp}, Total XP: ${totalXP}`);

    let template = readFileSync('README.template.md', 'utf-8');

    // Replace placeholders in the README template
    template = template
      .replace(/{{USERNAME}}/g, USERNAME)
      .replace(/{{LEVEL}}/g, level)
      .replace(/{{XP_BAR}}/g, bar)
      .replace(/{{COMMITS}}/g, stats.commits)
      .replace(/{{ISSUES}}/g, stats.issues)
      .replace(/{{PRS}}/g, stats.prs)
      .replace(/{{MERGEDPRS}}/g, stats.mergedPRs)
      .replace(/{{COMMENTS}}/g, stats.comments)
      .replace(/{{STARS}}/g, stats.stars)
      .replace(/{{FOLLOWERS}}/g, stats.followers)
      .replace(/{{REPOS}}/g, stats.repos);

    writeFileSync('README.md', template);

    console.log('README.md updated!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
