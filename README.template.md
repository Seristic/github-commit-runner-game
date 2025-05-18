<h1 align="center">🎮 GitHub RPG Profile: <span style="color:#ffb347">{{USERNAME}}</span></h1>

<p align="center">
  <b>Level {{LEVEL}}</b><br>
  <code>{{XP_BAR}}</code><br>
  <i>XP to next level: {{XP}}/100</i>
</p>

---

### 🧠 Character Stats

| Attribute       | Value          |
|----------------|----------------|
| 💻 Commits     | {{COMMITS}}    |
| 🛠 Repositories | {{REPOS}}       |
| ⭐ Stars        | {{STARS}}       |
| 👥 Followers    | {{FOLLOWERS}}   |

---

### ⚔️ Combat Log

| Action                | Count        | XP Value |
|-----------------------|--------------|----------|
| 🔧 Issues Opened      | {{ISSUES}}   | 🪙 +5 XP each |
| 🛡 Pull Requests       | {{PRS}}      | 🪙 +10 XP each |
| ⚔ Merged Pull Requests| {{MERGEDPRS}}| 🪙 +20 XP each |
| 💬 Code Comments      | {{COMMENTS}} | 🪙 +2 XP each |

---

### 📈 Progression Summary

- **Total XP:** *(hidden, used for level calc)*
- **Current Level:** `{{LEVEL}}`
- **Progress:** `{{XP_BAR}}` ({{XP}}/100 XP)
- **Next Level In:** {{100 - XP}} XP

---

_Updated daily via automated GitHub Actions._
