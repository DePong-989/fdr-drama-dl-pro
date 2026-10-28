const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const finalDir = path.join(rootDir, 'FINAL_BUILD');
const clientDir = path.join(finalDir, '1_FOR_CLIENT');
const adminDir = path.join(finalDir, '2_FOR_ADMIN_ONLY');
const releaseNoTerminalDir = path.join(rootDir, 'release_no_terminal', 'FDR Download Drama Pro');

// Ensure directories
fs.mkdirSync(clientDir, { recursive: true });
fs.mkdirSync(adminDir, { recursive: true });

const pkg = require('./package.json');
const currentVer = pkg.version || '2.0.1';

// Copy client executables
const setupSrc = path.join(rootDir, 'dist_release', `FDR Download Drama Pro Setup ${currentVer}.exe`);
const portableSrc = path.join(rootDir, 'dist_release', `FDR Download Drama Pro ${currentVer}.exe`);
const keygenSrc = path.join(rootDir, 'dist', 'FDR Pro Key Generator.exe');
const unpackedSrc = path.join(rootDir, 'dist_release', 'win-unpacked');

if (fs.existsSync(setupSrc)) {
  fs.copyFileSync(setupSrc, path.join(clientDir, 'FDR Download Drama Pro Setup.exe'));
  console.log('✓ Copied Installer to 1_FOR_CLIENT');

  // Also update installer/ directory in root
  const rootInstallerDir = path.join(rootDir, 'installer');
  fs.mkdirSync(rootInstallerDir, { recursive: true });
  fs.copyFileSync(setupSrc, path.join(rootInstallerDir, 'FDR Download Drama Pro Setup.exe'));
  console.log('✓ Updated installer/FDR Download Drama Pro Setup.exe');
}

if (fs.existsSync(portableSrc)) {
  fs.copyFileSync(portableSrc, path.join(clientDir, 'FDR Download Drama Pro Portable.exe'));
  console.log('✓ Copied Portable to 1_FOR_CLIENT');
}

// Helper function to recursively copy directory
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy Unpacked "No Terminal" folder to 1_FOR_CLIENT and release_no_terminal
if (fs.existsSync(unpackedSrc)) {
  const clientNoTerminal = path.join(clientDir, 'FDR Download Drama Pro (No Terminal)');
  console.log('Copying fresh No Terminal folder to 1_FOR_CLIENT...');
  if (fs.existsSync(clientNoTerminal)) {
    fs.rmSync(clientNoTerminal, { recursive: true, force: true });
  }
  copyDirSync(unpackedSrc, clientNoTerminal);
  console.log('✓ Copied No Terminal folder to 1_FOR_CLIENT');

  // Also update release_no_terminal
  console.log('Updating release_no_terminal folder...');
  if (fs.existsSync(releaseNoTerminalDir)) {
    fs.rmSync(releaseNoTerminalDir, { recursive: true, force: true });
  }
  copyDirSync(unpackedSrc, releaseNoTerminalDir);
  console.log('✓ Updated release_no_terminal folder');

  // Create Zip archive for easy client distribution
  try {
    const zipPath = path.join(clientDir, 'FDR Download Drama Pro (No Terminal).zip');
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    console.log('Creating ZIP archive for client distribution...');
    execSync(`powershell -Command "Compress-Archive -Path '${clientNoTerminal}\\*' -DestinationPath '${zipPath}' -Force"`, {
      windowsHide: true,
      stdio: 'ignore'
    });
    console.log('✓ Created FDR Download Drama Pro (No Terminal).zip');
  } catch (err) {
    console.warn('Zip creation skipped:', err.message);
  }
}

// Copy Admin Key Generator
if (fs.existsSync(keygenSrc)) {
  fs.copyFileSync(keygenSrc, path.join(adminDir, 'FDR Pro Key Generator.exe'));
  console.log('✓ Copied Key Generator to 2_FOR_ADMIN_ONLY');
}

// Copy source keygen script & batch helper as backup for admin
const pywSrc = path.join(rootDir, 'FDR Pro Key Generator.pyw');
if (fs.existsSync(pywSrc)) {
  fs.copyFileSync(pywSrc, path.join(adminDir, 'FDR Pro Key Generator.pyw'));
}

// Write Admin Guide
const guideText = `===================================================================
                FDR PRO DRAMA DOWNLOADER - ADMIN MANUAL
===================================================================

[+] ថត "1_FOR_CLIENT" (សម្រាប់ផ្ញើជូនភ្ញៀវ)៖
    1. FDR Download Drama Pro (No Terminal)       (Folder កម្មវិធីដើរផ្ទាល់ គ្មាន Terminal មិនបាច់ Install)
    2. FDR Download Drama Pro (No Terminal).zip   (File Zip សម្រាប់ផ្ញើតាម Telegram ឱ្យភ្ញៀវពន្លាប្រើភ្លាមៗ)
    3. FDR Download Drama Pro Setup.exe           (File Installer សម្រាប់អតិថិជនចង់ដំឡើងចូលម៉ាស៊ីន)
    4. FDR Download Drama Pro Portable.exe        (File Portable តែ 1 file ចុចបើកភ្លាមៗ)
    * ចំណាំ៖ ផ្ញើជម្រើសណាមួយក្នុងចំណោម 4 ខាងលើជូនភ្ញៀវតាមតម្រូវការ។

[+] ថត "2_FOR_ADMIN_ONLY" (សម្រាប់តែ Admin - ហាមផ្ញើឱ្យភ្ញៀវ)៖
    - FDR Pro Key Generator.exe (កម្មវិធីសម្រាប់ចុចបង្កើត License Key ជូនភ្ញៀវ)
    - FDR Pro Key Generator.pyw (Source code backup)
    
[+] របៀបបង្កើត និង Activate Key ជូនភ្ញៀវ៖
    1. សួររក "Machine ID" ពីភ្ញៀវ (ឧទាហរណ៍: FDR-7CB3-8D1F-9A02)
    2. បើក "FDR Pro Key Generator.exe"
    3. បិទភ្ជាប់ (Paste) Machine ID របស់ភ្ញៀវចូលក្នុងប្រអប់
    4. ជ្រើសរើសរយៈពេល (1 ខែ, 3 ខែ, 6 ខែ, 1 ឆ្នាំ ឬ Lifetime)
    5. ចុច "បង្កើត License Key" រួច Copy Key (ទម្រង់: PRO-XXXX-XXXX-XXXX-XXXX) ផ្ញើជូនភ្ញៀវ
    6. ភ្ញៀវយក Key នោះទៅវាយក្នុងកម្មវិធីរបស់គាត់ដើម្បីបើកប្រើ Pro។

* រាល់ Key ទាំងអស់ដំណើរការតែលើកុំព្យូទ័រភ្ញៀវម្នាក់នោះប៉ុណ្ណោះ មិនអាចយកទៅប្រើលើកុំព្យូទ័រផ្សេងបានឡើយ!
`;

fs.writeFileSync(path.join(adminDir, 'ADMIN_GUIDE_របៀបប្រើ.txt'), guideText, 'utf8');
console.log('✓ Created ADMIN_GUIDE_របៀបប្រើ.txt in 2_FOR_ADMIN_ONLY');

// Clean temporary build folders
['build', 'dist', 'FDR Pro Key Generator.spec'].forEach(item => {
  const p = path.join(rootDir, item);
  try {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  } catch (e) {}
});

console.log('\n--- FINAL BUILD PACKAGES READY ---');
console.log('Client folder:', clientDir);
console.log('Admin folder:', adminDir);
console.log('Release No Terminal:', releaseNoTerminalDir);
