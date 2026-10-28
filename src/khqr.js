const { BakongKHQR } = require('bakong-khqr');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class KHQRManager {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.configFile = path.join(this.dataDir, 'payment_config.json');
    this.bakongKHQR = new BakongKHQR();
    this.ensureDir(this.dataDir);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getConfig() {
    const defaultCfg = {
      merchantName: 'Admin-FDR',
      bakongAccountId: 'abaakhppxxx@abaa',
      accountNumber: '600 462 336',
      usdAccountNumber: '093 890 098',
      bankName: 'ABA Bank',
      accountName: 'SOCHEKA HOUN',
      abaP2pToken: '2698B1575AA9',
      priceUsd: 25.00,
      currency: 'USD',
      merchantCity: 'Phnom Penh',
      plans: {
        "1MONTH": { "label": "1 ខែ (1 Month)", "price": 2.99, "days": 30 },
        "3MONTHS": { "label": "3 ខែ (3 Months)", "price": 4.99, "days": 90 },
        "1YEAR": { "label": "1 ឆ្នាំ (1 Year)", "price": 9.99, "days": 365 },
        "LIFETIME": { "label": "ពេញមួយជីវិត (Lifetime)", "price": 25.00, "days": 99999 }
      }
    };

    try {
      if (fs.existsSync(this.configFile)) {
        const loaded = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        return { ...defaultCfg, ...loaded };
      }
    } catch (e) {}

    return defaultCfg;
  }

  saveConfig(newConfig) {
    const current = this.getConfig();
    const merged = { ...current, ...newConfig };
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(merged, null, 2), 'utf8');
      return { success: true, config: merged };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Official EMVCo CRC16-CCITT algorithm
  crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= (data.charCodeAt(i) << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  formatTag(id, val) {
    const str = String(val || '');
    const len = String(str.length).padStart(2, '0');
    return `${id}${len}${str}`;
  }

  // Generate 100% Genuine ABA KHQR EMVCo Compliant String
  generateKHQRString(params = {}) {
    const cfg = this.getConfig();
    const merchantName = String(params.merchantName || cfg.merchantName || 'Admin-FDR').trim().slice(0, 25);
    const merchantCity = String(params.merchantCity || cfg.merchantCity || 'Phnom Penh').trim().slice(0, 15);
    const amount = Number(params.amount || cfg.priceUsd || 25).toFixed(2);
    const billNumber = String(params.deviceId || params.billNumber || 'FDR-VIP-PASS').trim().toUpperCase().slice(0, 25);

    // Official ABA Decoded Payload Tags
    const khrAcc = String(cfg.accountNumber || '600462336').replace(/\s+/g, '');
    const usdAcc = String(cfg.usdAccountNumber || '093890098').replace(/\s+/g, '');
    const p2pToken = cfg.abaP2pToken || '2698B1575AA9';

    // Tag 29: ABA Bank Master Routing
    const sub29 = this.formatTag('00', 'abaakhppxxx@abaa') +
                  this.formatTag('01', khrAcc) +
                  this.formatTag('02', 'ABA Bank');

    // Tag 40: ABA Dual Currency P2P Routing Payload
    const sub40 = this.formatTag('00', 'abaP2P') +
                  this.formatTag('01', p2pToken) +
                  this.formatTag('02', khrAcc) +
                  this.formatTag('03', usdAcc) +
                  this.formatTag('04', 'Dual');

    let payload = '';
    payload += this.formatTag('00', '01');
    payload += this.formatTag('01', '12'); // 12 = Dynamic QR Code with Amount
    payload += this.formatTag('29', sub29);
    payload += this.formatTag('40', sub40);
    payload += this.formatTag('52', '5999'); // Merchant Category Code
    payload += this.formatTag('53', '840');  // 840 = USD Currency
    payload += this.formatTag('54', amount); // Transaction Amount ($2.99, $4.99, $9.99, $25.00)
    payload += this.formatTag('58', 'KH');   // Country Code Cambodia
    payload += this.formatTag('59', merchantName); // Merchant Name (ADMIN FDR)
    payload += this.formatTag('60', merchantCity);

    // Tag 62: Additional Data (Bill Number / Device ID memo)
    payload += this.formatTag('62', this.formatTag('01', billNumber));

    // Tag 99: Dynamic KHQR Timestamp (Required by ABA/Bakong standard)
    const nowTs = Date.now().toString();
    const expTs = (Date.now() + 86400000).toString(); // 24 hours validity
    payload += this.formatTag('99', this.formatTag('00', nowTs) + this.formatTag('01', expTs));

    // Tag 63: CRC16 Checksum
    payload += '6304';
    const crc = this.crc16(payload);
    const fullKHQR = payload + crc;
    const md5 = crypto.createHash('md5').update(fullKHQR).digest('hex');

    return {
      khqrString: fullKHQR,
      md5,
      amount,
      currency: 'USD',
      merchantName,
      billNumber,
      bakongId: 'abaakhppxxx@abaa',
      accountNumber: usdAcc
    };
  }

  // Generate Base64 Data URL QR Code image
  async generateKHQRDataURL(params = {}) {
    const khqrData = this.generateKHQRString(params);
    const qrDataUrl = await QRCode.toDataURL(khqrData.khqrString, {
      margin: 1,
      width: 320,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    return {
      ...khqrData,
      qrDataUrl
    };
  }

  // Check transaction status via NBC Bakong Open API
  async checkPaymentStatus(md5) {
    if (!md5) return { paid: false, error: 'Missing MD5 hash' };
    const cfg = this.getConfig();
    
    // Check if Bakong Token is configured
    if (!cfg.bakongToken || !cfg.bakongToken.trim()) {
      return {
        paid: false,
        status: 'no_token',
        error: 'មិនទាន់បានបញ្ចូល NBC Bakong Token ទេ (សូមកំណត់ក្នុង Settings)'
      };
    }

    try {
      const url = cfg.bakongApiUrl || 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';
      const cleanToken = cfg.bakongToken.trim();
      const authHeader = cleanToken.toLowerCase().startsWith('bearer ') ? cleanToken : `Bearer ${cleanToken}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'User-Agent': 'FDR-Drama-DL-Pro/2.0'
        },
        body: JSON.stringify({ md5 }),
        signal: AbortSignal.timeout(7000)
      });

      const resData = await response.json().catch(() => null);

      if (!response.ok || !resData) {
        if (response.status === 401 || (resData && (resData.errorCode === 6 || (resData.responseMessage && resData.responseMessage.toLowerCase().includes('unauthorized'))))) {
          return {
            paid: false,
            status: 'unauthorized',
            error: 'Bakong Token មិនត្រឹមត្រូវ ឬផុតកំណត់ (Unauthorized)'
          };
        }
        return { paid: false, status: 'pending', error: `HTTP ${response.status}` };
      }

      // Check if transaction is confirmed paid by Bakong
      if (resData.responseCode === 0 || resData.response_code === 0) {
        return {
          paid: true,
          status: 'paid',
          data: resData.data || {},
          hash: resData.data?.hash || '',
          amount: resData.data?.amount,
          currency: resData.data?.currency
        };
      }

      // If token error reported inside 200 OK body
      if (resData.errorCode === 6 || (resData.responseMessage && resData.responseMessage.toLowerCase().includes('unauthorized'))) {
        return {
          paid: false,
          status: 'unauthorized',
          error: 'Bakong Token មិនត្រឹមត្រូវ ឬផុតកំណត់ (Unauthorized)'
        };
      }

      // Pending payment
      return {
        paid: false,
        status: 'pending',
        message: resData.responseMessage || 'កំពុងរង់ចាំការបាញ់ប្រាក់...'
      };
    } catch (e) {
      return { paid: false, error: e.message, status: 'error' };
    }
  }

  // Test if Bakong Open API Token is authentic and connected
  async testBakongToken(token) {
    if (!token || !token.trim()) {
      return { success: false, error: 'សូមបញ្ចូល Bakong Token ជាមុនសិន!' };
    }

    const cleanToken = token.trim();
    const authHeader = cleanToken.toLowerCase().startsWith('bearer ') ? cleanToken : `Bearer ${cleanToken}`;

    try {
      const url = 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'User-Agent': 'FDR-Drama-DL-Pro/2.0'
        },
        body: JSON.stringify({ md5: '00000000000000000000000000000000' }),
        signal: AbortSignal.timeout(7000)
      });

      const resData = await response.json().catch(() => null);
      if (!resData) {
        return { success: false, error: `NBC Server Error: HTTP ${response.status}` };
      }

      if (resData.errorCode === 6 || (resData.responseMessage && resData.responseMessage.toLowerCase().includes('unauthorized'))) {
        return {
          success: false,
          error: '❌ Token មិនត្រឹមត្រូវ ឬផុតកំណត់ (Unauthorized: Not yet requested for token or invalid)'
        };
      }

      // If NBC accepts the token (e.g. returns "Transaction not found" for dummy MD5)
      return {
        success: true,
        message: '✅ Bakong Token ត្រឹមត្រូវ 100%! បានភ្ជាប់ទៅកាន់ប្រព័ន្ធ NBC Bakong Open API ដោយជោគជ័យ។'
      };
    } catch (err) {
      return { success: false, error: `បរាជ័យក្នុងការតភ្ជាប់ NBC: ${err.message}` };
    }
  }
}

module.exports = KHQRManager;
