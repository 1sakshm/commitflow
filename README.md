# CommitFlow

**A minimalist GitHub activity tracker and local Git manager, built with the MERN stack.**

CommitFlow is a personal developer dashboard that runs on your own computer. It shows your GitHub repositories and recent commits, monitors the Git repositories stored on your machine, and lets you stage, commit, push, pull, fetch and switch branches from a clean web interface instead of the terminal.

**Demo video:** [docs/demo.mp4](docs/demo.mp4) (1 minute 17 seconds, subtitles, no audio)

---

## 1. Features

### GitHub (read-only, through the official REST API)
- Profile, connection status and avatar.
- All repositories the token can access (up to 500), with search, language filter, public/private filter, sorting and "show more" pagination.
- Repository cards with description, language, stars, forks, visibility, last update and a link to GitHub.
- Recent commits **you authored** on the default branch of your 15 most recently pushed repositories, for the last 7, 30 or 90 days.
- A 30-day commit bar chart (Recharts) on the Overview page.
- Clear messages for a missing token, an invalid token, missing permissions, the rate limit and network failures.

### Local Git (through the Git CLI installed on your computer)
- Discovers Git repositories inside folders you explicitly allow (the folder itself, or its immediate subfolders).
- Per project: current branch, upstream, ahead/behind counts, modified/untracked/conflicted counts, last commit time and remote link.
- Status badges: Clean, Modified, Untracked files, Conflicts, Ahead, Behind, Diverged, No upstream, Detached HEAD.
- Changes view with separate **Staged** and **Changes** lists, a line-numbered diff viewer, and binary/large-file handling.
- Stage or unstage single files, or stage/unstage everything.
- Commit form that is disabled until files are staged and a message is written. Ctrl + Enter commits.
- Push to the configured upstream. If the branch has no upstream, you get the exact command to set one.
- Fetch, and Pull with a confirmation dialog when you have uncommitted changes.
- A Branches dialog to list branches, switch branches (blocked while you have uncommitted changes) and create a new branch.
- History tab with the latest 20 commits and the files changed in each one.

### Application
- Overview dashboard with four summary cards, the commit chart, local project status and recent activity.
- Dark theme by default, plus an optional light theme saved in MongoDB.
- Responsive layout with a collapsible sidebar on small screens.
- Toast notifications, skeleton loaders, empty states, error states and confirmation dialogs.
- Press `/` anywhere to focus the search box.

---

## 2. Technology stack

| Layer | Technology |
| --- | --- |
| Database | MongoDB with Mongoose |
| Backend | Node.js, Express 5, Axios, dotenv |
| Frontend | React 19, Vite, React Router, Tailwind CSS 4, Recharts, Lucide icons, Axios |
| Git | The official `git` executable, run with `child_process.execFile` |
| GitHub | GitHub REST API (`api.github.com`) |

---

## 3. Architecture (in simple words)

```
 Browser (React app, http://localhost:5173)
        │  /api/...   (Vite forwards these requests to the backend)
        ▼
 Express server (http://127.0.0.1:5000)
   ├── routes/github.js        ──►  GitHub REST API   (uses GITHUB_TOKEN from .env)
   ├── routes/repositories.js  ──►  services/git.js ──► git executable on your PC
   ├── routes/git.js           ──►  services/git.js ──► git executable on your PC
   └── models/Preference.js    ──►  MongoDB          (project folders + theme)
```

1. **React** draws the interface. It never talks to GitHub or Git directly. It only calls the Express API under `/api`.
2. **Express** has three route files:
   - `github.js` calls the GitHub API with the secret token. It caches results in memory for 5 minutes, and every **Refresh** button bypasses that cache.
   - `repositories.js` lists the allowed folders, finds the Git repositories inside them, and returns status, branches and history.
   - `git.js` performs actions such as stage, unstage, diff, commit, push, fetch, pull, create branch and switch branch.
3. **services/git.js** is the only place that runs Git. It uses `execFile('git', [...args])`, so arguments are passed directly to Git and never pass through a shell. It also turns Git's error output into short, friendly messages.
4. **MongoDB** stores a single `Preference` document holding the folders you added in Settings and your theme. GitHub data and Git status are **not** stored. They are always read live, so they are never out of date.

### How repositories are identified safely
The browser never sends a folder path for Git operations. Each discovered repository gets an id: the first 12 characters of a SHA-1 hash of its path. For every request, the server rescans the allowed folders and looks up that id. Any file sent for staging, unstaging or diffing must appear in the repository's current `git status` output. All other requests are rejected.

### Folder structure

```
commitflow/
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── public/logo.svg
│   └── src/
│       ├── main.jsx            entry point
│       ├── App.jsx             routes and providers
│       ├── data.jsx            small data cache shared between pages (useResource)
│       ├── lib.js              axios instance and formatting helpers
│       ├── index.css           Tailwind and theme colours
│       ├── components/
│       │   ├── Layout.jsx      sidebar and top bar
│       │   ├── ui.jsx          buttons, cards, badges, modal, empty states
│       │   ├── Toast.jsx       notifications
│       │   ├── RepositoryCard.jsx
│       │   ├── ActivityItem.jsx
│       │   └── DiffViewer.jsx
│       └── pages/
│           ├── Overview.jsx
│           ├── Repositories.jsx
│           ├── LocalProjects.jsx
│           ├── ProjectDetail.jsx
│           ├── Activity.jsx
│           └── Settings.jsx
├── server/
│   ├── server.js               Express app, settings and health routes, MongoDB connection
│   ├── models/Preference.js
│   ├── routes/github.js
│   ├── routes/repositories.js
│   ├── routes/git.js
│   ├── services/git.js
│   ├── services/errors.js
│   └── .env.example
├── .gitignore
└── README.md
```

---

## 4. Prerequisites

- **Node.js 20 or newer** (tested with Node 22). Check with `node -v`.
- **Git 2.23 or newer** on your PATH (tested with 2.49). Check with `git --version`.
- **MongoDB**, either:
  - local [MongoDB Community Server](https://www.mongodb.com/try/download/community) running on `mongodb://127.0.0.1:27017`, or
  - a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster. Copy its connection string into `MONGODB_URI`, for example `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/commitflow`.
- A GitHub account (optional: local Git features work without it).

---

## 5. Installation

```bash
cd commitflow/server
npm install

cd ../client
npm install
```

---

## 6. Environment configuration

Create `server/.env` by copying the example:

```bash
cd commitflow/server
copy .env.example .env        # Windows (cmd / PowerShell)
cp .env.example .env          # macOS / Linux / Git Bash
```

| Variable | Required | Example | Meaning |
| --- | --- | --- | --- |
| `PORT` | no | `5000` | Backend port. If you change it, also change the proxy target in `client/vite.config.js`. |
| `MONGODB_URI` | yes | `mongodb://127.0.0.1:27017/commitflow` | MongoDB connection string. |
| `GITHUB_TOKEN` | for GitHub pages | `github_pat_...` | Personal access token. Stays on the server only. |
| `ALLOWED_REPO_DIRS` | no | `C:/Users/You/Projects` | Folders to scan, separated by `,` or `;`. More can be added in Settings. |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | The browser origin allowed to call the API. |

`.env` is listed in `.gitignore`. Never commit it.

---

## 7. Start the backend

```bash
cd commitflow/server
npm run dev        # restarts automatically on changes (node --watch)
# or
npm start
```

You should see `CommitFlow API running at http://127.0.0.1:5000`. If MongoDB is not reachable, the server prints a clear message and stops.

Health check: open <http://127.0.0.1:5000/api/health>.

## 8. Start the frontend

In a second terminal:

```bash
cd commitflow/client
npm run dev
```

Open <http://localhost:5173>.

---

## 9. Configure GitHub access

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   (<https://github.com/settings/personal-access-tokens/new>).
2. Under **Repository access**, choose **All repositories** (or select specific ones).
3. Under **Repository permissions**, set **Contents: Read-only**. **Metadata: Read-only** is added automatically.
4. Copy the token into `server/.env` as `GITHUB_TOKEN=github_pat_...`.
5. Restart the backend, then click **Test connection** in Settings.

A classic token with the `repo` scope also works. The token is used only by the Express server. It is never sent to the browser and never stored in MongoDB.

> Note: a fine-grained token can only see repositories owned by you or by organizations that approved it. Collaborator repositories owned by other users may not appear unless you use a classic token.

## 10. Configure local repository folders

You can do either of the following:
- Set `ALLOWED_REPO_DIRS` in `server/.env` (these folders are marked `.env` in Settings and can only be changed there), or
- Open **Settings → Project folders**, or **Local Projects → Add folder**, and enter a full path such as `C:\Users\You\Projects`.

CommitFlow then checks the folder itself and each of its **immediate** subfolders for a `.git` directory. It does not scan deeper, does not follow symbolic links, and does not scan the rest of your disk. Removing a folder only stops CommitFlow from showing it; it never deletes files.

Push, pull and fetch use **your existing Git credentials** (Git Credential Manager on Windows, or SSH keys). CommitFlow never asks for or stores Git passwords.

---

## 11. Security measures

- The GitHub token is read from `.env` on the server and never returned to the browser.
- The server listens on `127.0.0.1` only, so other computers cannot reach it.
- Requests whose `Host` is not localhost, or whose `Origin` is not the CommitFlow frontend, are rejected with 403. This stops other websites from calling the API.
- Git runs through `execFile` with an argument array (no shell). Paths are always placed after `--`.
- There is no endpoint that runs arbitrary commands.
- Repositories are resolved by id from the allowed folders only. Files must belong to the repository's current status.
- Previews of untracked files resolve real paths and refuse anything outside the repository.
- Nothing destructive is run automatically: no `reset --hard`, `clean`, `checkout -- file`, force push or auto-stash.
- Error responses contain short messages only, never stack traces. Credentials embedded in remote URLs are masked.

---

## 12. Screenshots

A short walkthrough video is in [docs/demo.mp4](docs/demo.mp4).

### Overview
![Overview](docs/overview.png)

### Repositories
![Repositories](docs/repositories.png)

### Local Projects
![Local Projects](docs/local-projects.png)

### Project changes and diff
![Project changes](docs/project-changes.png)

### Activity
![Activity](docs/activity.png)

### Settings (light theme)
![Settings](docs/settings.png)

---

## 13. How to demo (suggested flow)

1. Open Overview: summary cards, the 30-day chart and recent commits.
2. Repositories: search for a repo using the top search box, filter to Private, sort by Name, and open one on GitHub.
3. Local Projects: add your projects folder, then filter by "Changes".
4. Open a project. Edit a file in your editor, click **Refresh**, select the file to see the diff, stage it, write a message and commit.
5. Click **Push**. On a branch without an upstream, show the helpful message instead.
6. Open the Branches dialog. Create a branch, then show that switching is blocked while there are uncommitted changes.
7. History tab: select a commit to see its changed files.
8. Settings: switch to the light theme, and show the folder list and GitHub connection.

---

## 14. Limitations

- Single user, local only. There is no login system; the security model is "only this computer can reach the API".
- The activity feed covers **your commits on the default branch** of your 15 most recently pushed repositories. It is not GitHub's full contribution graph and does not include issues, pull requests or reviews.
- At most 500 repositories and 100 commits per repository per request are read from GitHub.
- Repository discovery looks only one level deep inside each configured folder.
- Merge conflicts are detected and explained, but must be resolved in your editor (then staged and committed in CommitFlow).
- Branches without an upstream must be published once with `git push -u origin <branch>`. CommitFlow does not change remote configuration.
- Pull uses your repository's own Git settings (merge or rebase). If Git asks for a pull strategy, the message explains how to set one.
- If a Git credential prompt is required, it appears as the normal Git Credential Manager window. Terminal password prompts are disabled.
- Diffs larger than 400 KB are truncated, and binary files show a notice instead of a diff.

## 15. Future improvements

- GitHub OAuth sign-in instead of a manually created token.
- Partial (line-level) staging and discard-changes with confirmation.
- Stash support.
- Publishing a new branch (`push -u`) after explicit confirmation.
- A per-repository GitHub page with issues and pull requests.
- Automated tests for the Git service using temporary repositories.
