import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import fs from "fs";
import path from "path";

const SOURCE_TOKEN = process.env.SOURCE_TOKEN;
const DEST_TOKEN = process.env.DEST_TOKEN;
const SOURCE_USER = "your-main-username";
const DEST_USER = "your-backup-username";
const BACKUP_DIR = "./repos";

const octoSource = new Octokit({ auth: SOURCE_TOKEN });
const octoDest = new Octokit({ auth: DEST_TOKEN });
const git = simpleGit();

(async () => {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

  // 1. Get all repos from source
  const { data: repos } = await octoSource.repos.listForUser({ username: SOURCE_USER, per_page: 100 });
  console.log(`Found ${repos.length} repos.`);

  for (const repo of repos) {
    const name = repo.name;
    const localPath = path.join(BACKUP_DIR, name);

    console.log(`\nBacking up: ${name}`);

    // 2. Clone (mirror)
    if (!fs.existsSync(localPath)) {
      await git.clone(repo.clone_url.replace("https://", `https://${SOURCE_TOKEN}@`), localPath);
    }

    // 3. Check if repo exists on destination
    try {
      await octoDest.repos.get({ owner: DEST_USER, repo: name });
      console.log(`✅ Repo already exists on ${DEST_USER}`);
    } catch {
      // 4. Create repo on destination if missing
      await octoDest.repos.createForAuthenticatedUser({ name });
      console.log(`🚀 Created ${name} on ${DEST_USER}`);
    }

    // 5. Push to destination
    const destURL = `https://${DEST_TOKEN}@github.com/${DEST_USER}/${name}.git`;
    await git.cwd(localPath).removeRemote("backup").addRemote("backup", destURL);
    await git.cwd(localPath).push(["--mirror", "backup"]);

    console.log(`🧩 Pushed ${name} to backup account.`);
  }
})();
