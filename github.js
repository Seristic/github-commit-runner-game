import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
    auth: process.env.PAT_TOKEN,
});

export async function getCommitCount(owner, repo, author) {
    let page = 1, commits = 0;
    while (true) {
        const response = await octokit.rest.repos.listCommits({
            owner, repo, author, per_page: 100, page,
        });
        commits += response.data.length;
        if (response.data.length < 100) break;
        page++;
    }
    return commits;
}

export async function getPRCount(owner, repo, author) {
    let page = 1, prs = 0;
    while (true) {
        const response = await octokit.rest.pulls.list({
            owner, repo, per_page: 100, page, state: 'all',
        });
        const userPRs = response.data.filter(pr => pr.user.login.toLowerCase() === author.toLowerCase());
        prs += userPRs.length;
        if (response.data.length < 100) break;
        page++;
    }
    return prs;
}

export async function getIssueCount(owner, repo, author) {
    let page = 1, issues = 0;
    while (true) {
        const response = await octokit.rest.issues.listForRepo({
            owner, repo, per_page: 100, page, state: 'all',
        });
        // Filter only issues opened by author, exclude PRs (they have pull_request field)
        const userIssues = response.data.filter(issue => issue.user.login.toLowerCase() === author.toLowerCase() && !issue.pull_request);
        issues += userIssues.length;
        if (response.data.length < 100) break;
        page++;
    }
    return issues;
}

export async function getStarCount(username) {
    let page = 1, stars = 0;
    while (true) {
        const response = await octokit.rest.activity.listReposStarredByUser({
            username,
            per_page: 100,
            page,
        });
        stars += response.data.length;
        if (response.data.length < 100) break;
        page++;
    }
    return stars;
}

export async function getRecentRepos(username, limit = 5) {
    const response = await octokit.rest.repos.listForUser({
        username,
        per_page: limit,
        sort: 'updated',
        direction: 'desc',
    });
    return response.data.map(repo => ({
        name: repo.name,
        description: repo.description || 'No description',
        stars: repo.stargazers_count,
        language: repo.language || 'Unknown',
        url: repo.html_url,
    }));
}
