#!/usr/bin/env node
/**
 * FDR Drama DL Pro - Admin License Key Generator
 * Usage:
 *   node keygen.js <DeviceID> [lifetime|1year]
 *   Or run interactively: node keygen.js
 */

const readline = require('readline');
const LicenseManager = require('./src/license');
const licenseMgr = new LicenseManager();

const args = process.argv.slice(2);

function printKey(deviceId, plan, key) {
  console.log('\n======================================================');
  console.log('       FDR DRAMA DL PRO - LICENSE KEY GENERATED       ');
  console.log('======================================================');
  console.log(` Client Device ID : ${deviceId}`);
  console.log(` Plan             : ${plan.toUpperCase()}`);
  console.log(` Activation Key   : ${key}`);
  console.log('======================================================');
  console.log(' 👉 Copy and send this Activation Key to your client!\n');
}

function normalizePlan(arg) {
  const a = String(arg || '').trim().toLowerCase();
  if (a === '1' || a === '1month' || a === 'month' || a === '1m') return '1MONTH';
  if (a === '2' || a === '3months' || a === '3m') return '3MONTHS';
  if (a === '3' || a === '1year' || a === 'year' || a === '1y') return '1YEAR';
  return 'LIFETIME';
}

if (args.length >= 1) {
  const deviceId = args[0].trim().toUpperCase();
  const planType = normalizePlan(args[1] || 'lifetime');
  const key = licenseMgr.generateKey(deviceId, planType);
  printKey(deviceId, planType, key);
  process.exit(0);
}

// Interactive Mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n======================================================');
console.log('       FDR DRAMA DL PRO - ADMIN KEY GENERATOR         ');
console.log('======================================================');

rl.question('👉 បញ្ចូល Device ID របស់ភ្ញៀវ (ឧ. FDR-XXXX-XXXX-XXXX): ', (devId) => {
  const cleanId = devId.trim().toUpperCase();
  if (!cleanId || !cleanId.startsWith('FDR-')) {
    console.error('❌ Error: Device ID ត្រូវតែចាប់ផ្តើមដោយ FDR-XXXX-XXXX-XXXX');
    rl.close();
    return;
  }

  console.log('\nជ្រើសរើសប្រភេទ Plan សម្រាប់អតិថិជន:');
  console.log('  [1] 1 ខែ (1 Month)   - $2.99');
  console.log('  [2] 3 ខែ (3 Months)  - $4.99');
  console.log('  [3] 1 ឆ្នាំ (1 Year)   - $9.99');
  console.log('  [4] ពេញមួយជីវិត (Lifetime VIP) - $25.00 [Default]');
  
  rl.question('\n👉 ជ្រើសរើសលេខ [1, 2, 3, 4] (Default: 4): ', (choice) => {
    const plan = normalizePlan(choice);
    const key = licenseMgr.generateKey(cleanId, plan);
    printKey(cleanId, plan, key);
    rl.close();
  });
});
