import time
import os

# --- GAME DATA & STATE ---
game_state = {
    "current_directory": "/",
    "access_level": 0, # 0: No access, 1: Basic Server, 2: Health Policy, 3: Finance/PR, 4: International, 5: Core
    "unlocked_files": [], # Stores names of files the player has successfully 'uncovered'
    "files": {
        "/": {
            "README.txt": "Welcome, Agent. Your mission: Expose Reform UK.",
            "projects/": {},
            "servers/": {}
        },
        "/projects/": {
            "SERISTIC/": {}
        },
        "/projects/SERISTIC/": {
            ".github/": {},
            "scripts/": {},
            "workflows/": {},
            "PROJECT_TREE.md": "A fictional project documentation file.",
            "README.md": "README for the SERISTIC project."
        },
        "/projects/SERISTIC/scripts/": {
            "skills_config.json": "A config file with generic settings.",
            "update_achievements.py": "A python script for a generic project."
        },
        "/servers/reform_server_1/": {
            "login.txt": "Access restricted. Seek vulnerabilities.",
            "data/": {},
            "archive/": {}
        },
    }
}

# --- NARRATIVE CONTENT ---
file_contents = {
    "project_ostrich_memo.txt": """[INTERNAL MEMO - HIGHLY SENSITIVE]
...
[END OF MEMO]
""",
    "email_alpha_omega_initiative.txt": """[INTERNAL EMAIL CHAIN]
...
[END OF EMAIL CHAIN]
""",
    "alpha_omega_healthcare_draft.pdf": """[CONFIDENTIAL - REFORM UK POLICY DRAFT - ALPHA-OMEGA INITIATIVE]
...
[END OF DRAFT]
""",
    "ukraine_medical_aid_proposal_draft.txt": """[INTERNAL MEMO - UKRAINE MEDICAL AID PROPOSAL - DRAFT v1.0]
...
[NOTE: This file appears to be untouched since its creation. No further revisions or actions documented within this directory.]
"""
}

# --- GAME FUNCTIONS ---

def display_prompt():
    print(f"\n[ VSC | Editing Test.js | Theme: Trans (Blue) ]")
    print(f"reform_sim:{game_state['current_directory']}$ ", end="")

def handle_command(command):
    cmd_parts = command.split(' ', 1)
    action = cmd_parts[0].lower()
    arg = cmd_parts[1] if len(cmd_parts) > 1 else ""

    if action == "ls":
        list_directory(arg)
    elif action == "cd":
        change_directory(arg)
    elif action == "cat":
        view_file(arg)
    elif action == "help":
        display_help()
    elif action == "access" and arg.lower() == "reform_server_1_login":
        attempt_initial_access()
    elif action == "find":
        simulated_find(arg)
    elif action == "exit":
        print("Exiting simulator. Remember the truth you uncovered.")
        return False
    else:
        print(f"Command not recognized: '{action}'. Type 'help' for options.")
    return True

def normalize_dir(path):
    # Always end with "/" for directories except root
    if not path.endswith("/"):
        path += "/"
    if path != "/" and path.startswith("//"):
        path = path[1:]
    return path

def list_directory(path=""):
    if not path:
        target_path = game_state['current_directory']
    else:
        if path.startswith("/"):
            target_path = path
        else:
            target_path = os.path.join(game_state['current_directory'], path)
    target_path = os.path.normpath(target_path).replace("\\", "/")
    if not target_path.endswith("/"):
        target_path += "/"
    if target_path not in game_state['files']:
        print(f"Error: Directory '{path}' not found.")
        return
    print(f"Contents of {target_path}:")
    contents = game_state['files'][target_path]
    if not contents:
        print("    (empty)")
        return
    for item, item_content in contents.items():
        if isinstance(item_content, dict):
            print(f"    {item}")
        else:
            print(f"    {item}")

def change_directory(path):
    if path == "..":
        if game_state['current_directory'] == "/":
            print("Already at root directory.")
            return
        parent = os.path.dirname(game_state['current_directory'].rstrip("/"))
        if not parent:
            parent = "/"
        if not parent.endswith("/"):
            parent += "/"
        if parent not in game_state['files']:
            parent = "/"
        game_state['current_directory'] = parent
        return
    if path.startswith("/"):
        new_path = path
    else:
        new_path = os.path.join(game_state['current_directory'], path)
    new_path = os.path.normpath(new_path).replace("\\", "/")
    if not new_path.endswith("/"):
        new_path += "/"
    if new_path in game_state['files']:
        game_state['current_directory'] = new_path
    else:
        print(f"Error: Directory '{path}' not found.")

def view_file(filename):
    """Views the content of a specified file."""
    file_path = os.path.normpath(os.path.join(game_state['current_directory'], filename))

    # Check if the file exists in the current directory's representation
    if filename in game_state['files'].get(game_state['current_directory'], {}):
        file_data = game_state['files'][game_state['current_directory']][filename]
        if isinstance(file_data, dict):
            print(f"Error: '{filename}' is a directory, not a file.")
            return

        # --- REVISED LOGIC FOR PROJECT OSTRICH MEMO ---
        if filename == "project_ostrich_memo.txt":
            # This file is accessible only after access_level 1 is achieved
            if game_state['access_level'] < 1:
                print(f"File '{filename}' is inaccessible from your current network privileges. You need to gain 'access' to the main Reform server first.")
                return
            # If access_level is 1 or higher, proceed to display content
        # --- END REVISED LOGIC ---

        # Display content if conditions are met or it's a normal file
        if file_data in file_contents: # Check if it's a known content key
            print("\n--- FILE CONTENT START ---")
            print(file_contents[file_data])
            print("--- FILE CONTENT END ---\n")
            if filename not in game_state['unlocked_files']: # Mark as unlocked upon viewing
                game_state['unlocked_files'].append(filename)
                trigger_next_stage() # Check if viewing this file triggers the next puzzle
        else:
            print(f"Error: Could not retrieve content for '{filename}'. File might be empty or corrupted.")
    else:
        print(f"Error: File '{filename}' not found in current directory.")

def simulated_find(keyword):
    """Simulates a 'find' command to locate files based on keywords."""
    if game_state['access_level'] < 2:
        print("You need higher access to use the 'find' command effectively.")
        print("Hint: You need to read 'project_ostrich_memo.txt' first to unlock this.")
        return

    print(f"Searching for '{keyword}' across accessible server directories...")
    time.sleep(2)
    found_files = []

    # Iterate through all known directories and their contents
    for path, contents in game_state['files'].items():
        if isinstance(contents, dict): # Ensure it's a directory
            for item, item_content in contents.items():
                # Search in filename
                if isinstance(item_content, str) and keyword.lower() in item.lower():
                    found_files.append(os.path.normpath(os.path.join(path, item)))
                # NOW ALSO SEARCH IN FILE CONTENT if it's a known content key
                elif isinstance(item_content, str) and item_content in file_contents and \
                     keyword.lower() in file_contents[item_content].lower():
                    found_files.append(os.path.normpath(os.path.join(path, item)))

    if found_files:
        print(f"Found files matching '{keyword}':")
        for f_path in found_files:
            print(f"    - {f_path}")
        print("\nThese files are now accessible if you can navigate to their directories.")
    else:
        print(f"No files found matching '{keyword}'.")

def display_help():
    print("""
Available Commands:
  ls [directory]    - List contents of current or specified directory.
  cd <directory>    - Change current directory. Use '..' to go up.
  cat <filename>    - View the content of a file.
  access <target>   - Attempt to gain access to a system (e.g., 'access reform_server_1_login').
  find <keyword>    - Search for files containing a specific keyword.
  help              - Display this help message.
  exit              - Quit the simulator.
    """)

def attempt_initial_access():
    if game_state['access_level'] == 0:
        print("\n[INITIATING ACCESS PROTOCOL]")
        print("Bypassing login for 'reform_server_1'...")
        time.sleep(1.5)
        print("Analyzing network vulnerabilities...")
        time.sleep(2)
        print("Weak point found in legacy authentication system. Injecting payload...")
        time.sleep(1.5)
        print("ACCESS GRANTED: Root directory of /servers/reform_server_1/data/")
        game_state['access_level'] = 1
        # Dynamically add the 'data' directory and 'project_ostrich_memo.txt' to the game state
        game_state['files']["/servers/reform_server_1/data/"] = {
            "README_INTERNAL.txt": "Confidential documents reside here. Handle with care.",
            "project_ostrich_memo.txt": "project_ostrich_memo.txt",
            "archive/": {}
        }
        game_state['files']["/servers/reform_server_1/"]["data/"] = game_state['files']["/servers/reform_server_1/data/"]
        print("\nYou can now 'cd' into '/servers/reform_server_1/data/' and use 'ls' to explore.")
        print("Your next objective: Locate and 'cat' the 'project_ostrich_memo.txt'.")
    else:
        print("You already have access to the Reform server.")

def trigger_next_stage():
    # Stage 0 to Stage 1: project_ostrich_memo.txt viewed
    if "project_ostrich_memo.txt" in game_state['unlocked_files'] and game_state['access_level'] == 1:
        # Check if stage already progressed to avoid re-triggering messages/adding files
        if game_state.get('current_stage', 0) < 1: # Check if current_stage is less than 1
            game_state['current_stage'] = 1
            game_state['access_level'] = 2 # Access to health policy files
            health_policy_path = "/servers/reform_server_1/health_policy_records/"
            game_state['files'][health_policy_path] = {
                "email_alpha_omega_initiative.txt": "email_alpha_omega_initiative.txt",
                "alpha_omega_healthcare_draft.pdf": "alpha_omega_healthcare_draft.pdf",
                "ukraine_medical_aid_proposal_draft.txt": "ukraine_medical_aid_proposal_draft.txt"
            }
            game_state['files']["/servers/reform_server_1/"]["health_policy_records/"] = game_state['files'][health_policy_path]
            print("\n--- NEW LEAD UNLOCKED ---")
            print("The 'Project Ostrich' memo mentions 'Alpha-Omega Initiative' and 'Dr. Anya Sharma'.")
            print("This suggests a deeper dive into their health policy plans.")
            print("You need to find a way to search for files related to 'Alpha-Omega' or 'Sharma'.")
            print("Hint: A new 'find' command has been activated for your current access level.")
            print("Use 'find <keyword>' to locate these files. Try 'find Alpha-Omega' or 'find Sharma'.")

    # Stage 1 to Stage 2: ALL three health policy files viewed
    # Added 'ukraine_medical_aid_proposal_draft.txt' to the check
    elif game_state.get('current_stage', 0) == 1 and all(f in game_state['unlocked_files'] for f in ["email_alpha_omega_initiative.txt", "alpha_omega_healthcare_draft.pdf", "ukraine_medical_aid_proposal_draft.txt"]):
        # Check if stage already progressed
        if game_state.get('current_stage', 0) < 2:
            game_state['current_stage'] = 2
            game_state['access_level'] = 3 # Access to strategic partnerships and donor info
            funding_pr_path = "/servers/reform_server_1/strategic_partnerships_data/"
            game_state['files'][funding_pr_path] = {
                "uk_heritage_values_initiative_report.txt": "uk_heritage_values_initiative_report.txt",
                "media_strategy_briefing.pdf": "media_strategy_briefing.pdf",
                "donor_log_q1_2025.xlsx": "donor_log_q1_2025.xlsx"
            }
            game_state['files']["/servers/reform_server_1/"]["strategic_partnerships_data/"] = game_state['files'][funding_pr_path]
            file_contents["uk_heritage_values_initiative_report.txt"] = """[CONFIDENTIAL REPORT - UK HERITAGE & VALUES INITIATIVE]
...
[END OF REPORT]
"""
            file_contents["media_strategy_briefing.pdf"] = """[CONFIDENTIAL - REFORM UK - PUBLIC RELATIONS STRATEGY BRIEFING]
...
[END OF BRIEFING]
"""
            file_contents["donor_log_q1_2025.xlsx"] = """[CONFIDENTIAL - REFORM UK - DONOR LOG Q1 2025]
...
NOTE: No significant donations or allocations for direct international humanitarian aid (e.g., Ukraine relief) logged in this period, contrasting sharply with 'values' rhetoric.
"""
            print("\n--- DEEPER INSIGHTS UNLOCKED ---")
            print("You've uncovered details on the 'Alpha-Omega Initiative' and their neglect of Ukraine.")
            print("Now, pivot to their funding. The donor log mentions 'The Liberty & Progress Fund' and 'Global Liberty Fund'.")
            print("Use the 'find' command to locate files related to these donors or 'international' connections.")
            print("Try 'find Liberty' or 'find Global' or 'find international'.")

    # Stage 2 to Stage 3: donor_log_q1_2025.xlsx viewed (THIS WAS MISSING!)
    elif game_state.get('current_stage', 0) == 2 and "donor_log_q1_2025.xlsx" in game_state['unlocked_files']:
        # Check if stage already progressed
        if game_state.get('current_stage', 0) < 3:
            game_state['current_stage'] = 3
            game_state['access_level'] = 4 # Access to global network intelligence
            # Add new directory and files for stage 3
            game_state['files']["/servers/reform_server_1/global_network_intelligence/"] = {
                "global_liberty_fund_memo.txt": "global_liberty_fund_memo.txt",
                "european_values_conference_summary.pdf": "european_values_conference_summary.pdf",
                "cross_border_propaganda_channels.txt": "cross_border_propaganda_channels.txt",
            }
            game_state['files']["/servers/reform_server_1/"]["global_network_intelligence/"] = game_state['files']["/servers/reform_server_1/global_network_intelligence/"]

            file_contents["global_liberty_fund_memo.txt"] = """[CONFIDENTIAL MEMORANDUM - GLOBAL LIBERTY FUND]
...
[END OF MEMO]
"""
            file_contents["european_values_conference_summary.pdf"] = """[EUROPEAN VALUES CONFERENCE - SUMMARY REPORT]
...
[END OF REPORT]
"""
            file_contents["cross_border_propaganda_channels.txt"] = """[INTERNAL STRATEGY - CROSS-BORDER PROPAGANDA CHANNELS]
...
[END OF STRATEGY]
"""

            print("\n--- NEW LEAD UNLOCKED ---")
            print("You've traced the financial backing and their shocking disregard for global crises.")
            print("Your next target is their 'Global Network Intelligence'.")
            print("Search for details on 'Global Liberty Fund' or 'European Values Conference' to expose their international web.")
            print("Hint: You might need to change directories to find these new files.")

    # Final Stage: ALL stage 3 files viewed (if you had this, make sure it's here too)
    elif game_state.get('current_stage', 0) == 3 and all(f in game_state['unlocked_files'] for f in ["global_liberty_fund_memo.txt", "european_values_conference_summary.pdf", "cross_border_propaganda_channels.txt"]):
        if game_state.get('current_stage', 0) < 4:
            game_state['current_stage'] = 4 # Final stage
            print("\n--- MISSION CRITICAL: FINAL TARGET IDENTIFIED ---")
            print("You have uncovered the full extent of Reform UK's deceptive operations.")
            print("The final piece of the puzzle is to expose their core leadership's involvement.")
            print("Access their core server and find the 'MASTER_PLAN.txt' file.")
            # Add any final access or directory here if needed
            game_state['access_level'] = 5
            # For example, if a new server or path is needed:
            # game_state['files']["/servers/reform_core_server/"] = {"MASTER_PLAN.txt": "MASTER_PLAN.txt"}
            # game_state['files']["/servers/"]["reform_core_server/"] = game_state['files']["/servers/reform_core_server/"]
            file_contents["MASTER_PLAN.txt"] = """[ULTIMATE CONFIDENTIAL - REFORM UK - MASTER PLAN]
...
[END OF MASTER PLAN]
"""


def game_loop():
    print("\n[ INITIALIZING ETHICAL HACKING SIMULATOR ]")
    print("------------------------------------------")
    print(f"Loading environment... Theme: Trans (Blue)")
    time.sleep(1)
    print("Welcome, Agent. You are connected to a simulated network.")
    print("Your mission: Uncover and expose the true agenda of Reform UK.")
    print("Type 'help' for a list of commands.")
    print("\nYour first task: Gain 'access' to 'reform_server_1_login'.")
    running = True
    while running:
        display_prompt()
        try:
            command = input().strip()
        except EOFError:
            break
        if not command:
            continue
        running = handle_command(command)
        # ADD THE DEBUG LINE HERE
        print(f"DEBUG: Current Stage = {game_state.get('current_stage', 'Key Not Found')}")
        time.sleep(0.2)

if __name__ == "__main__":
    game_loop()