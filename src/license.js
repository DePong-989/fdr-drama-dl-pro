const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET_SALT = 'FDR_MASTER_SALT_PRO_2026_@#!dramadl';

class LicenseManager {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.licenseFile = path.join(this.dataDir, 'license.json');
    this.cachedDeviceId = null;
    this.ensureDir(this.dataDir);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getRawMachineGuid() {
    try {
      const cmd = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid';
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      const match = out.match(/MachineGuid\s+REG_SZ\s+([a-zA-Z0-9\-]+)/i);
      if (match) return match[1].trim();
    } catch (e) {}

    // Fallback: computer name + user
    try {
      return (process.env.COMPUTERNAME || 'PC') + '_' + (process.env.USERNAME || 'USER');
    } catch (e) {
      return 'DEFAULT_FDR_DEVICE';
    }
  }

  getDeviceId() {
    if (this.cachedDeviceId) return this.cachedDeviceId;
    const raw = this.getRawMachineGuid();
    const hash = crypto.createHash('sha256').update(raw + '_FDR_DRAMA_PRO_DEVICE').digest('hex').toUpperCase();
    this.cachedDeviceId = `FDR-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
    return this.cachedDeviceId;
  }

  generateKey(deviceId, type = 'LIFETIME') {
    const cleanId = String(deviceId).trim().toUpperCase();
    const payload = `${cleanId}:${type}:${SECRET_SALT}`;
    const sig = crypto.createHash('sha256').update(payload).digest('hex').toUpperCase();
    return `PRO-${sig.substring(0, 4)}-${sig.substring(4, 8)}-${sig.substring(8, 12)}-${sig.substring(12, 16)}`;
  }

  verifyKey(deviceId, key) {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'សូមបញ្ចូល License Key ជាមុនសិន' };
    }
    const cleanKey = key.trim().toUpperCase();
    const cleanId = String(deviceId).trim().toUpperCase();

    // Check Lifetime Pro Key
    const expectedLifetime = this.generateKey(cleanId, 'LIFETIME');
    if (cleanKey === expectedLifetime) {
      return {
        valid: true,
        plan: 'Lifetime VIP Pro',
        planType: 'LIFETIME',
        expiry: 'រហូត (Lifetime)',
        durationDays: 99999,
        isLifetime: true,
        key: cleanKey
      };
    }

    // Check 1-Year Pro Key
    const expectedYearly = this.generateKey(cleanId, '1YEAR');
    if (cleanKey === expectedYearly) {
      return {
        valid: true,
        plan: '1-Year VIP Pro',
        planType: '1YEAR',
        expiry: '1 ឆ្នាំ (1 Year)',
        durationDays: 365,
        isLifetime: false,
        key: cleanKey
      };
    }

    // Check 3-Months Pro Key
    const expected3Months = this.generateKey(cleanId, '3MONTHS');
    if (cleanKey === expected3Months) {
      return {
        valid: true,
        plan: '3-Month VIP Pro',
        planType: '3MONTHS',
        expiry: '3 ខែ (90 ថ្ងៃ)',
        durationDays: 90,
        isLifetime: false,
        key: cleanKey
      };
    }

    // Check 1-Month Pro Key
    const expected1Month = this.generateKey(cleanId, '1MONTH');
    if (cleanKey === expected1Month) {
      return {
        valid: true,
        plan: '1-Month VIP Pro',
        planType: '1MONTH',
        expiry: '1 ខែ (30 ថ្ងៃ)',
        durationDays: 30,
        isLifetime: false,
        key: cleanKey
      };
    }

    // Check Master Admin Key
    const masterKey = this.generateKey('MASTER_ADMIN', 'LIFETIME');
    if (cleanKey === masterKey) {
      return {
        valid: true,
        plan: 'Master Admin VIP',
        planType: 'LIFETIME',
        expiry: 'អចិន្ត្រៃយ៍ (Unlimited)',
        durationDays: 99999,
        isLifetime: true,
        key: cleanKey
      };
    }

    return { valid: false, error: 'Key មិនត្រឹមត្រូវ ឬមិនត្រូវជាមួយ Device ID របស់កុំព្យូទ័រនេះទេ!' };
  }

  getStatus() {
    const deviceId = this.getDeviceId();
    let savedKey = '';
    let savedAt = null;

    try {
      if (fs.existsSync(this.licenseFile)) {
        const data = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
        savedKey = data.key || '';
        savedAt = data.activatedAt || null;
      }
    } catch (e) {}

    if (savedKey) {
      const result = this.verifyKey(deviceId, savedKey);
      if (result.valid) {
        // Expiration check if not lifetime
        if (!result.isLifetime && savedAt && result.durationDays) {
          const expiresAt = savedAt + (result.durationDays * 24 * 60 * 60 * 1000);
          if (Date.now() > expiresAt) {
            return {
              isActivated: false,
              deviceId,
              plan: 'VIP Expired',
              expiry: 'អាជ្ញាប័ណ្ណបានផុតកំណត់ (Expired)',
              isLifetime: false,
              key: savedKey,
              isExpired: true
            };
          }
        }

        return {
          isActivated: true,
          deviceId,
          plan: result.plan,
          planType: result.planType,
          expiry: result.expiry,
          isLifetime: result.isLifetime,
          key: savedKey,
          activatedAt: savedAt
        };
      }
    }

    return {
      isActivated: false,
      deviceId,
      plan: 'Free Trial',
      expiry: 'Not Activated',
      isLifetime: false,
      key: ''
    };
  }

  activate(key) {
    const deviceId = this.getDeviceId();
    const result = this.verifyKey(deviceId, key);
    if (!result.valid) {
      return { success: false, error: result.error };
    }

    try {
      const payload = {
        key: result.key,
        deviceId,
        plan: result.plan,
        expiry: result.expiry,
        activatedAt: Date.now()
      };
      fs.writeFileSync(this.licenseFile, JSON.stringify(payload, null, 2), 'utf8');
      return { success: true, license: this.getStatus() };
    } catch (e) {
      return { success: false, error: `បរាជ័យក្នុងការរក្សាទុក Key: ${e.message}` };
    }
  }

  deactivate() {
    try {
      if (fs.existsSync(this.licenseFile)) {
        fs.unlinkSync(this.licenseFile);
      }
      return { success: true, license: this.getStatus() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = LicenseManager;
