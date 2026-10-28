const fs = require('fs');
const path = require('path');

const pkg = require('./package.json');
const version = pkg.version;

let token = process.env.GH_TOKEN;
let owner = 'DePong-989';
let repo = 'fdr-drama-dl-pro';

const cfgPath = path.join(__dirname, 'publish_config.json');
if (fs.existsSync(cfgPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    token = token || cfg.token;
    owner = cfg.owner || owner;
    repo = cfg.repo || repo;
  } catch (e) {}
}

if (!token) {
  console.error('❌ Error: GH_TOKEN not found! Please set $env:GH_TOKEN or add to publish_config.json');
  process.exit(1);
}

async function main() {
  console.log(`\n========================================`);
  console.log(`🚀 Publishing FDR Drama DL Pro v${version}`);
  console.log(`========================================\n`);

  // 1. Check if release already exists or create new one
  console.log(`🔍 Checking release for tag v${version}...`);
  let release = null;
  const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'Node-Uploader' }
  });
  const releases = await listRes.json();

  if (Array.isArray(releases)) {
    release = releases.find(r => r.tag_name === `v${version}`);
  }

  if (!release) {
    console.log(`Creating new release v${version}...`);
    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Node-Uploader'
      },
      body: JSON.stringify({
        tag_name: `v${version}`,
        name: `FDR Drama DL Pro v${version}`,
        body: `🎉 កំណែអាប់ដេតផ្លូវការ FDR Drama DL Pro v${version}!\n\n- មុខងារស្វែងរក និងទាញយករឿងលឿនជាងមុន\n- ប្រព័ន្ធ Auto-Updater ស្វ័យប្រវត្ត\n- ប្រព័ន្ធទូទាត់ Bakong KHQR`,
        draft: false
      })
    });
    release = await createRes.json();
    console.log(`Created release ID: ${release.id}`);
  } else {
    console.log(`Found existing release ID: ${release.id}`);
  }

  const distDir = path.join(__dirname, 'dist_release');
  const crypto = require('crypto');
  const setupExePath = path.join(distDir, `FDR Download Drama Pro Setup ${version}.exe`);
  const latestYmlPath = path.join(distDir, 'latest.yml');

  if (fs.existsSync(setupExePath)) {
    const stat = fs.statSync(setupExePath);
    const buf = fs.readFileSync(setupExePath);
    const hash = crypto.createHash('sha512').update(buf).digest('base64');
    const ymlContent = `version: ${version}\nfiles:\n  - url: FDR-Download-Drama-Pro-Setup-${version}.exe\n    sha512: ${hash}\n    size: ${stat.size}\npath: FDR-Download-Drama-Pro-Setup-${version}.exe\nsha512: ${hash}\nreleaseDate: '${new Date().toISOString()}'\n`;
    fs.writeFileSync(latestYmlPath, ymlContent, 'utf8');
    console.log(`✅ Auto-generated latest.yml for v${version} (SHA512 verified)`);
  }
  const filesToUpload = [
    { name: 'latest.yml', path: path.join(distDir, 'latest.yml'), type: 'application/x-yaml' },
    { name: `FDR-Download-Drama-Pro-Setup-${version}.exe`, path: path.join(distDir, `FDR Download Drama Pro Setup ${version}.exe`), type: 'application/octet-stream' },
    { name: `FDR-Download-Drama-Pro-Setup-${version}.exe.blockmap`, path: path.join(distDir, `FDR Download Drama Pro Setup ${version}.exe.blockmap`), type: 'application/octet-stream' },
    { name: `FDR-Download-Drama-Pro-${version}.exe`, path: path.join(distDir, `FDR Download Drama Pro ${version}.exe`), type: 'application/octet-stream' }
  ];

  const existingAssets = release.assets || [];

  for (const item of filesToUpload) {
    if (!fs.existsSync(item.path)) {
      console.warn(`⚠️ File does not exist (skipping): ${item.path}`);
      continue;
    }

    const existing = existingAssets.find(a => a.name === item.name);
    if (existing) {
      console.log(`🗑️ Deleting old asset ${item.name}...`);
      await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existing.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `token ${token}`, 'User-Agent': 'Node-Uploader' }
      });
    }

    const stat = fs.statSync(item.path);
    console.log(`⬆️ Uploading ${item.name} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

    const fileStream = fs.createReadStream(item.path);
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(item.name)}`;

    const upRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': item.type,
        'Content-Length': stat.size,
        'User-Agent': 'Node-Uploader'
      },
      duplex: 'half',
      body: fileStream
    });

    if (upRes.ok) {
      console.log(`✅ Uploaded ${item.name} successfully!`);
    } else {
      console.error(`❌ Failed ${item.name}: HTTP ${upRes.status}`);
    }
  }

  // Ensure release is published (draft: false)
  await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Node-Uploader'
    },
    body: JSON.stringify({ draft: false })
  });

  console.log(`\n🎉🎉 Release v${version} published successfully!`);
  console.log(`🔗 Link: https://github.com/${owner}/${repo}/releases/tag/v${version}\n`);
}

main().catch(err => console.error('Error:', err.message));
