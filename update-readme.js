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

async function getStats() {
  const repos = await octokit.paginate(octokit.repos.listForUser, {
    username: USERNAME,
    per_page: 100,
  });

  // Approximate commits as repos * 100 (API limits)
  const totalCommits = repos.length * 100;

  const issues = await octokit.paginate(octokit.issues.listForUser, {
    username: USERNAME,
    filter: 'created',
    state: 'all',
    per_page: 100,
  });

  const prsResult = await octokit.search.issuesAndPullRequests({
    q: `is:pr author:${USERNAME}`,
    per_page: 1,
  });
  const totalPRs = prsResult.data.total_count;

  const mergedPRsResult = await octokit.search.issuesAndPullRequests({
    q: `is:pr author:${USERNAME} is:merged`,
    per_page: 1,
  });
  const mergedPRs = mergedPRsResult.data.total_count;

  const userData = await octokit.users.getByUsername({ username: USERNAME });
  const followers = userData.data.followers;

  let totalStars = 0;
  for (const repo of repos) {
    totalStars += repo.stargazers_count;
  }

  let totalComments = 0;
  for (const repo of repos) {
    const issueComments = await octokit.paginate(octokit.issues.listCommentsForRepo, {
      owner: USERNAME,
      repo: repo.name,
      per_page: 100,
    });
    totalComments += issueComments.filter(c => c.user.login === USERNAME).length;

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
    const nextXP = 100 - xp;

    console.log(`Level: ${level}, XP: ${xp}, Total XP: ${totalXP}`);

    let template = readFileSync('README.template.md', 'utf-8');

    // Trans pride flag HTML snippet
    const transFlag = `
<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Transgender_Pride_flag.svg/320px-Transgender_Pride_flag.svg.png" alt="Trans Pride Flag" width="200" />
</p>
`;

    // Replace placeholders in the README template
    template = template
      .replace(/{{USERNAME}}/g, USERNAME)
      .replace(/{{LEVEL}}/g, level)
      .replace(/{{XP_BAR}}/g, bar)
      .replace(/{{XP}}/g, xp)
      .replace(/{{NEXT_XP}}/g, nextXP)
      .replace(/{{COMMITS}}/g, stats.commits)
      .replace(/{{ISSUES}}/g, stats.issues)
      .replace(/{{PRS}}/g, stats.prs)
      .replace(/{{MERGEDPRS}}/g, stats.mergedPRs)
      .replace(/{{COMMENTS}}/g, stats.comments)
      .replace(/{{STARS}}/g, stats.stars)
      .replace(/{{FOLLOWERS}}/g, stats.followers)
      .replace(/{{REPOS}}/g, stats.repos)
      // Insert trans flag HTML at placeholder {{TRANS_FLAG}}
      .replace(/{{TRANS_FLAG}}/g, transFlag);

    writeFileSync('README.md', template);

    console.log('README.md updated!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
