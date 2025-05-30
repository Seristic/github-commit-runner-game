# .github/scripts/update_achievements.py
# This script fetches GitHub stats and updates the README with achievements and dynamic skill tree colors.

import os
import requests
import re
import json

# --- Configuration ---
GITHUB_USERNAME = os.getenv('GITHUB_USERNAME')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

# Base URL for achievement images (YOU MUST CREATE THESE IMAGES AND UPLOAD THEM TO A REPO)
# Example: https://github.com/YOUR_USERNAME/your-images-repo/raw/main/
ACHIEVEMENT_IMAGE_BASE_URL = f"https://github.com/{GITHUB_USERNAME}/your-profile-images-repo/raw/main/"

# Define your achievement criteria and messages with image IDs
ACHIEVEMENTS = [
    {"id": "new_adventurer", "min_repos": 1, "min_commits": 1, "message": "✨ **New Adventurer:** Profile README created!", "img_locked": "achievement_new_adventurer_locked.png", "img_unlocked": "achievement_new_adventurer_unlocked.png"},
    {"id": "first_commit", "min_commits": 1, "message": "🚀 **First Commit:** Made my mark on the codebase!", "img_locked": "achievement_first_commit_locked.png", "img_unlocked": "achievement_first_commit_unlocked.png"},
    {"id": "rising_star", "min_commits": 100, "message": "🌟 **Rising Star:** Achieved 100+ total commits!", "img_locked": "achievement_rising_star_locked.png", "img_unlocked": "achievement_rising_star_unlocked.png"},
    {"id": "project_initiator", "min_repos": 5, "message": "💡 **Project Initiator:** Created 5+ repositories!", "img_locked": "achievement_project_initiator_locked.png", "img_unlocked": "achievement_project_initiator_unlocked.png"},
    {"id": "eco_warrior_initiate", "min_environmental_repos": 1, "message": "🌳 **Eco-Warrior Initiate:** Started my first environmental project!", "img_locked": "achievement_eco_warrior_initiate_locked.png", "img_unlocked": "achievement_eco_warrior_initiate_unlocked.png"},
    {"id": "knowledge_seeker", "min_languages": 3, "message": "📚 **Knowledge Seeker:** Explored 3+ programming languages!", "img_locked": "achievement_knowledge_seeker_locked.png", "img_unlocked": "achievement_knowledge_seeker_unlocked.png"},
    {"id": "open_source_contributor", "min_contributed_repos": 1, "message": "🤝 **Open Source Contributor:** Contributed to an external open-source project!", "img_locked": "achievement_open_source_contributor_locked.png", "img_unlocked": "achievement_open_source_contributor_unlocked.png"},
    {"id": "thousand_commits_explorer", "min_commits": 1000, "message": "🎉 **Thousand Commits Explorer:** Surpassed 1,000 commits!", "img_locked": "achievement_thousand_commits_explorer_locked.png", "img_unlocked": "achievement_thousand_commits_explorer_unlocked.png"},
]

# --- GitHub API Helpers ---
def github_api_request(url, token, headers=None):
    """Helper for making GitHub API requests."""
    default_headers = {}
    if token:
        default_headers['Authorization'] = f'token {token}'
    if headers:
        default_headers.update(headers)
    
    response = requests.get(url, headers=default_headers)
    response.raise_for_status()
    return response.json()

def get_user_stats(username, token):
    """Fetches user's total commits and public repository count."""
    
    # Get total public repositories
    user_data = github_api_request(f"https://api.github.com/users/{username}", token)
    total_repos = user_data.get('public_repos', 0)

    # Get total commits (approximated for public repos owned by user)
    total_commits = 0
    page = 1
    while True:
        repos = github_api_request(f"https://api.github.com/users/{username}/repos?per_page=100&page={page}", token)
        if not repos:
            break
        
        for repo in repos:
            if not repo['fork']: # Only count commits to original repos, not forks
                try:
                    # Note: This endpoint is rate-limited and can be slow for many repos.
                    # It also might not include all commits if user contributions are not explicitly listed.
                    contributors = github_api_request(f"https://api.github.com/repos/{username}/{repo['name']}/contributors?per_page=1", token)
                    for contributor in contributors:
                        if contributor['login'] == username:
                            total_commits += contributor['contributions']
                            break
                except requests.exceptions.RequestException as e:
                    print(f"Warning: Could not fetch contributors for {repo['name']}: {e}")
        page += 1
    
    return total_commits, total_repos

def get_repo_topics(owner, repo_name, token):
    """Fetches topics (tags) for a specific repository."""
    headers = {'Accept': 'application/vnd.github.mercy-preview+json'} # Required for topics API
    try:
        data = github_api_request(f"https://api.github.com/repos/{owner}/{repo_name}/topics", token, headers=headers)
        return data.get('names', [])
    except requests.exceptions.RequestException as e:
        print(f"Warning: Could not fetch topics for {owner}/{repo_name}: {e}")
        return []

def get_all_repo_data(username, token):
    """Fetches data for all user's public repositories."""
    repos_data = []
    page = 1
    while True:
        repos = github_api_request(f"https://api.github.com/users/{username}/repos?per_page=100&page={page}", token)
        if not repos:
            break
        repos_data.extend(repos)
        page += 1
    return repos_data

# --- Achievement Logic ---
def get_unlocked_achievements(user_stats, repos_data):
    """Checks which achievements are unlocked based on user stats and repo data."""
    unlocked_ids = set()
    
    total_commits = user_stats['total_commits']
    total_repos = user_stats['total_repos']

    # Environmental repos count
    environmental_keywords = ['eco', 'environment', 'climate', 'sustainability', 'green', 'conservation', 'reforestation']
    environmental_repos_count = 0
    
    # Languages count & contributed repos count
    unique_languages = set()
    contributed_repos_count = 0 # Repos where user is contributor but not owner
    
    for repo in repos_data:
        # Check for environmental repos owned by user
        if repo['owner']['login'] == GITHUB_USERNAME:
            repo_topics = get_repo_topics(GITHUB_USERNAME, repo['name'], GITHUB_TOKEN)
            if any(keyword in topic.lower() for keyword in environmental_keywords for topic in repo_topics):
                environmental_repos_count += 1
            
            # Collect languages for owned repos
            if repo['language']:
                unique_languages.add(repo['language'].lower()) # Convert to lower case for consistency

        # Check for contributions to other repos (not owned by user, not forks of user's repos)
        if repo['owner']['login'] != GITHUB_USERNAME and not repo['fork']:
            # This is a basic check. A more robust check would involve
            # checking the /repos/{owner}/{repo}/contributors endpoint
            # for user's login. For now, we assume any non-owned, non-fork implies contribution.
            contributed_repos_count += 1 

    num_unique_languages = len(unique_languages)

    print(f"Calculated: Env Repos: {environmental_repos_count}, Unique Languages: {num_unique_languages}, Contributed Repos: {contributed_repos_count}")

    for achievement in ACHIEVEMENTS:
        is_unlocked = True
        if "min_repos" in achievement and total_repos < achievement["min_repos"]:
            is_unlocked = False
        if "min_commits" in achievement and total_commits < achievement["min_commits"]:
            is_unlocked = False
        if "min_environmental_repos" in achievement and environmental_repos_count < achievement["min_environmental_repos"]:
            is_unlocked = False
        if "min_languages" in achievement and num_unique_languages < achievement["min_languages"]:
            is_unlocked = False
        if "min_contributed_repos" in achievement and contributed_repos_count < achievement["min_contributed_repos"]:
            is_unlocked = False

        if is_unlocked:
            unlocked_ids.add(achievement["id"])
            
    return unlocked_ids, unique_languages # Also return unique languages for skill tree

# --- README Update Logic ---
def update_readme_achievements(readme_content, unlocked_achievement_ids):
    """Updates the achievements section with unlocked/locked images."""
    start_marker = ""
    end_marker = ""

    if start_marker not in readme_content or end_marker not in readme_content:
        print("Error: Achievement markers not found in README.md.")
        return readme_content

    achievements_section = []
    for achievement in ACHIEVEMENTS:
        img_src = achievement["img_unlocked"] if achievement["id"] in unlocked_achievement_ids else achievement["img_locked"]
        full_img_url = f"{ACHIEVEMENT_IMAGE_BASE_URL}{img_src}"
        achievements_section.append(
            f'* <img src="{full_img_url}" width="24" height="24" alt="{achievement["id"]}"> {achievement["message"]}'
        )
    
    new_achievements_content = "\n" + "\n".join(achievements_section) + "\n"
    
    # Replace the existing content between markers
    updated_content = re.sub(
        f"{re.escape(start_marker)}.*?{re.escape(end_marker)}",
        f"{start_marker}{new_achievements_content}{end_marker}",
        readme_content,
        flags=re.DOTALL
    )
    return updated_content

def update_readme_skill_tree(readme_content, active_languages, skills_config):
    """Updates the skill tree SVG colors based on active languages."""
    
    # Define default and active colors from config or fallback
    DEFAULT_INACTIVE_COLOR = "#cccccc" # Fallback if not specified in config
    
    # Create a mapping of skill ID to its active color and keywords
    skill_map = {skill['id']: skill for skill in skills_config['skills']}

    # Iterate through each skill in the config
    for skill_data in skills_config['skills']:
        skill_id = skill_data['id']
        keywords = [k.lower() for k in skill_data['keywords']] # Ensure keywords are lowercase
        active_color = skill_data.get('color_active', "#4CAF50") # Default green if not set
        inactive_color = skill_data.get('color_inactive', DEFAULT_INACTIVE_COLOR)
        
        # Check if any of the skill's keywords are present in the active languages
        is_skill_active = any(keyword in active_languages for keyword in keywords)
        
        target_color = active_color if is_skill_active else inactive_color
        
        # Find the circle element by ID and update its fill color
        # This regex is robust for various attributes before/after 'id' and 'fill'
        # It ensures we only modify the 'fill' attribute of the specific circle ID.
        pattern = re.compile(
            rf'(<circle[^>]*id="{re.escape(skill_id)}"[^>]*?)fill="[^"]*"([^>]*?>)'
        )
        
        readme_content = pattern.sub(rf'\g<1>fill="{target_color}"\g<2>', readme_content, 1)

    return readme_content

def main():
    readme_path = "README.md"
    skills_config_path = ".github/scripts/skills_config.json"

    try:
        with open(readme_path, "r", encoding="utf-8") as f:
            readme_content = f.read()
    except FileNotFoundError:
        print(f"Error: {readme_path} not found.")
        exit(1)

    try:
        with open(skills_config_path, "r", encoding="utf-8") as f:
            skills_config = json.load(f)
    except FileNotFoundError:
        print(f"Error: {skills_config_path} not found. Skill tree coloring will not be dynamic.")
        skills_config = {"skills": []} # Proceed without skill coloring
    except json.JSONDecodeError:
        print(f"Error: Could not parse {skills_config_path}. Check JSON syntax.")
        exit(1)

    if not GITHUB_USERNAME:
        print("Error: GITHUB_USERNAME environment variable not set.")
        exit(1)

    print(f"Fetching stats for {GITHUB_USERNAME}...")
    
    try:
        user_stats = {}
        total_commits, total_repos = get_user_stats(GITHUB_USERNAME, GITHUB_TOKEN)
        user_stats = {
            "total_commits": total_commits,
            "total_repos": total_repos
        }
        print(f"Total Commits: {total_commits}, Total Repos: {total_repos}")

        all_repos_data = get_all_repo_data(GITHUB_USERNAME, GITHUB_TOKEN)
        unlocked_achievement_ids, active_languages = get_unlocked_achievements(user_stats, all_repos_data)
        
        print("Unlocked Achievement IDs:", unlocked_achievement_ids)
        print("Active Languages Detected:", active_languages)
        
        # Update achievements
        readme_content = update_readme_achievements(readme_content, unlocked_achievement_ids)

        # Update skill tree colors
        readme_content = update_readme_skill_tree(readme_content, active_languages, skills_config)

        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(readme_content)
        print("README.md updated successfully with achievements and skill tree colors.")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching GitHub data: {e}")
        print("Ensure GITHUB_USERNAME is correct and GITHUB_TOKEN is set in secrets.")
        exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        exit(1)

if __name__ == "__main__":
    main()
