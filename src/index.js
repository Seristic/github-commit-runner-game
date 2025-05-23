import dotenv from 'dotenv';
import {
    getCommitCount,
    getPRCount,
    getIssueCount,
    getStarCount,
    getRecentRepos
} from './github.js';
import { calculateXP, calculateLevel, xpForLevel } from './xpCalculator.js';
import { generateProgressMarkdown, updateReadme } from './READMEUpdater.js';

dotenv.config();

async function main() {
    const repoUrl = process.env.GITHUB_REPO;
    const parts = repoUrl.includes('github.com')
        ? repoUrl.replace('https://github.com/', '').split('/')
        : repoUrl.split('/');

    const owner = parts[0];
    const repo = parts[1];
    const author = process.env.GITHUB_USERNAME;

    // Fetch counts
    const [commitCount, prCount, issueCount, starCount, recentRepos] = await Promise.all([
        getCommitCount(owner, repo, author),
        getPRCount(owner, repo, author),
        getIssueCount(owner, repo, author),
        getStarCount(author),
        getRecentRepos(author, 5),
    ]);

    // Calculate XP and levels
    const xp = Math.floor(calculateXP(commitCount, prCount, issueCount, starCount));
    const level = calculateLevel(xp);
    const xpForNextLevel = xpForLevel(level + 1);

    // Build markdown
    const progressMarkdown = generateProgressMarkdown({
        level,
        currentXP: xp,
        nextLevelXP: xpForNextLevel,
        commitXP: commitCount,
        prXP: prCount,
        issuesXP: issueCount,
        starredXP: starCount,
        recentRepos,
    });

    // Update README.md
    await updateReadme(progressMarkdown);

    console.log('README.md updated with progress!');
}

main().catch(console.error);
