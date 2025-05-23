// XP multipliers per contribution type
const XP_VALUES = {
    commit: 1,
    pr: 3,
    issue: 2,
    star: 0.5,
};

// Exponential XP needed for next level: base * (multiplier ^ level)
const BASE_XP = 100;
const XP_MULTIPLIER = 1.5;

export function calculateXP(commits, prs, issues, stars) {
    return (
        commits * XP_VALUES.commit +
        prs * XP_VALUES.pr +
        issues * XP_VALUES.issue +
        stars * XP_VALUES.star
    );
}

export function xpForLevel(level) {
    return Math.floor(BASE_XP * Math.pow(XP_MULTIPLIER, level));
}

// Calculate current level from total XP
export function calculateLevel(xp) {
    let level = 0;
    while (xp >= xpForLevel(level)) {
        level++;
    }
    return level - 1;
}
