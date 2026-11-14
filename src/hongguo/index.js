const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { fetchAppPlayUrl } = require('./app-source');
const { decryptMp4Buffer } = require('./decrypt');

/**
 * Resolve direct high-speed CDN stream and decryption key for any Hongguo VID with retry
 * @param {string} vid Hongguo Episode Video ID
 * @param {object} options Optional settings (quality, signal, maxRetries)
 * @returns {Promise<{url: string, contentKey: string|null, codec: string, quality: string, userAgent: string}>}
 */
async function resolveHongguoPlayUrl(vid, options = {}) {
  const maxRetries = options.maxRetries || 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Wait 1.5s between retries to satisfy upstream gateway pacing
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
      const info = await fetchAppPlayUrl(String(vid), options);
      if (info && info.url) {
        return {
          url: info.url,
          contentKey: info.contentKey || null,
          codec: info.codec || 'hevc',
          quality: info.quality || '1080p',
          userAgent: info.userAgent || 'com.phoenix.read/74332'
        };
      }
    } catch (err) {
      lastError = err;
      if (options.signal?.aborted) throw err;
      console.warn(`[Hongguo VIP] Resolve attempt ${attempt + 1}/${maxRetries} failed:`, err.message);
    }
  }

  throw lastError || new Error('Failed to resolve Hongguo VIP stream after retries');
}

/**
 * Download and decrypt any Hongguo VIP Episode (Ep 1 to 100+)
 * @param {string} vid Hongguo Video ID
 * @param {string} outputPath Target .mp4 file path
 * @param {function} onProgress Progress callback ({ percent, speed, downloadedBytes, totalBytes, phase })
 * @param {AbortSignal} signal Cancellation signal
 */
async function downloadAndDecryptHongguo(vid, outputPath, onProgress = () => {}, signal = null) {
  onProgress({ percent: 10, speed: '⚡ Resolving VIP Stream...', downloadedBytes: 0, totalBytes: 0, phase: 'resolving' });
  
  const playInfo = await resolveHongguoPlayUrl(vid, { signal });
  if (!playInfo || !playInfo.url) {
    throw new Error('Failed to obtain VIP video stream from Hongguo Official API');
  }

  onProgress({ percent: 20, speed: '⚡ 1080P VIP Downloading...', downloadedBytes: 0, totalBytes: 0, phase: 'downloading' });

  let lastBytes = 0;
  let lastTime = Date.now();

  const response = await axios.get(playInfo.url, {
    headers: {
      'User-Agent': playInfo.userAgent || 'com.phoenix.read/74332',
      'Accept': '*/*'
    },
    responseType: 'arraybuffer',
    signal,
    timeout: 60000,
    onDownloadProgress: (progressEvent) => {
      const downloadedBytes = progressEvent.loaded || 0;
      const totalBytes = progressEvent.total || 0;
      const now = Date.now();
      const deltaMs = now - lastTime;
      if (deltaMs >= 300) {
        const deltaBytes = downloadedBytes - lastBytes;
        const speedBps = (deltaBytes / deltaMs) * 1000;
        let speedStr = `${(speedBps / 1024 / 1024).toFixed(1)} MB/s`;
        if (speedBps < 1024 * 1024) speedStr = `${(speedBps / 1024).toFixed(0)} KB/s`;
        
        let percent = 20;
        if (totalBytes > 0) {
          percent = Math.min(85, Math.round(20 + (downloadedBytes / totalBytes) * 65));
        } else {
          percent = Math.min(85, Math.round(20 + (downloadedBytes / 6000000) * 65));
        }

        onProgress({
          percent,
          speed: speedStr,
          downloadedBytes,
          totalBytes,
          phase: 'downloading'
        });

        lastBytes = downloadedBytes;
        lastTime = now;
      }
    }
  });

  const rawBuffer = Buffer.from(response.data);
  const downloadedBytes = rawBuffer.length;
  const totalBytes = rawBuffer.length;

  if (signal?.aborted) {
    throw new Error('Download aborted by user');
  }

  // Decryption phase
  let finalBuffer = rawBuffer;
  if (playInfo.contentKey) {
    onProgress({ percent: 90, speed: '⚡ Decrypting CENC...', downloadedBytes, totalBytes, phase: 'decrypting' });
    finalBuffer = decryptMp4Buffer(rawBuffer, playInfo.contentKey);
  }

  onProgress({ percent: 96, speed: '⚡ Saving MP4...', downloadedBytes, totalBytes, phase: 'saving' });

  // Ensure parent directory exists
  const parentDir = path.dirname(outputPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Write file atomically
  const tempPath = `${outputPath}.tmp_${Date.now()}`;
  fs.writeFileSync(tempPath, finalBuffer);
  if (fs.existsSync(outputPath)) {
    try { fs.unlinkSync(outputPath); } catch (_) {}
  }
  fs.renameSync(tempPath, outputPath);

  const stat = fs.statSync(outputPath);
  onProgress({
    percent: 100,
    speed: 'Done',
    downloadedBytes: stat.size,
    totalBytes: stat.size,
    phase: 'completed'
  });

  return {
    outputPath,
    size: stat.size,
    codec: playInfo.codec,
    quality: playInfo.quality
  };
}

module.exports = {
  resolveHongguoPlayUrl,
  downloadAndDecryptHongguo
};
