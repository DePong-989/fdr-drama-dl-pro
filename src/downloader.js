const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const { downloadAndDecryptHongguo } = require('./hongguo');

class DramaDownloader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.downloadDir = options.downloadDir || path.join(__dirname, '..', 'downloads');
    this.maxConcurrent = options.maxConcurrent || options.concurrentDownloads || 3;
    this.ffmpegPath = options.ffmpegPath || 'ffmpeg';
    this.queue = [];
    this.activeTasks = new Map(); // taskId -> { process, task, progress }
    this.completedTasks = [];
    this.downloadingCovers = new Set();
    this.macStreamCache = new Map();
    this._blockedDramaCounts = new Map();
    this.ensureDir(this.downloadDir);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  setDownloadDir(dir, updatePending = true) {
    this.downloadDir = dir;
    this.ensureDir(dir);

    // Automatically update all non-completed tasks in queue to use new directory!
    if (updatePending && Array.isArray(this.queue)) {
      let anyUpdated = false;
      this.queue.forEach(t => {
        if (t.status !== 'completed' && t.status !== 'downloading') {
          t.destDir = dir;
          t.customDownloadDir = dir;
          const dramaFolder = path.join(dir, this.sanitizeFilename(t.dramaTitle || 'Drama'));
          this.ensureDir(dramaFolder);
          const filename = path.basename(t.outputPath || `${t.episodeTitle || 'ep'}.mp4`);
          t.outputPath = path.join(dramaFolder, filename);
          anyUpdated = true;
        }
      });
      if (anyUpdated) {
        this.emit('task-status-changed', { globalDirUpdated: true, newDir: dir });
      }
    }
  }

  setMaxConcurrent(num) {
    this.maxConcurrent = Math.max(1, Math.min(10, num));
    this.processQueue();
  }

  sanitizeFilename(name) {
    return (name || 'video').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  }

  // Validate that an MP4 video file is complete, intact, and playable without freezing
  validateVideoFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) return false;
      const stat = fs.statSync(filePath);
      // Valid short drama episode must be at least 150KB
      if (stat.size < 150000) return false;

      // Check MP4 container magic signatures: 'ftyp', 'moov', or 'mdat' within first 48 bytes
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(48);
      fs.readSync(fd, buffer, 0, 48, 0);
      fs.closeSync(fd);

      const header = buffer.toString('binary');
      return header.includes('ftyp') || header.includes('moov') || header.includes('mdat');
    } catch (e) {
      return false;
    }
  }

  async downloadCover(coverUrl, folder, dramaTitle) {
    if (!coverUrl || !coverUrl.startsWith('http')) return;
    try {
      this.ensureDir(folder);
      const safeTitle = this.sanitizeFilename(dramaTitle);
      const posterPath = path.join(folder, `${safeTitle}.jpg`);
      // Clean up legacy duplicate thumbnails if they exist in this folder
      for (const legacyName of ['cover.jpg', 'thumbnail.jpg']) {
        const legacyPath = path.join(folder, legacyName);
        if (legacyPath !== posterPath && fs.existsSync(legacyPath)) {
          try { fs.unlinkSync(legacyPath); } catch (_) {}
        }
      }
      if (fs.existsSync(posterPath) || this.downloadingCovers.has(posterPath)) return;
      this.downloadingCovers.add(posterPath);

      const https = require('https');
      const http = require('http');
      const client = coverUrl.startsWith('https') ? https : http;

      await new Promise((resolve) => {
        const req = client.get(coverUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://hongguoduanju.com/'
          },
          timeout: 10000
        }, (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            resolve(false);
            return;
          }
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              if (buffer.length > 500) {
                fs.writeFileSync(posterPath, buffer);
              }
            } catch (err) {}
            resolve(true);
          });
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });
      this.downloadingCovers.delete(posterPath);
    } catch (e) {
      // Ignore if image CDN fails
    }
  }

  addTask(task, emitEvent = true) {
    // task: { id, dramaTitle, episodeTitle, url, cover, durationSec, customDownloadDir, destDir, isSingleMovie, episodeIndex }
    const id = task.id || `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const baseDir = task.customDownloadDir || task.destDir || this.downloadDir;
    const dramaFolder = path.join(baseDir, this.sanitizeFilename(task.dramaTitle));
    this.ensureDir(dramaFolder);

    // If user requested "Download Poster Only", save only the single thumbnail file and return without queuing an MP4 task
    if (task.isThumbnailOnly) {
      const thumbUrl = task.cover || task.url;
      if (thumbUrl) {
        this.downloadCover(thumbUrl, dramaFolder, task.dramaTitle).catch(() => {});
      }
      return {
        id,
        dramaTitle: task.dramaTitle || 'Unknown Drama',
        episodeTitle: 'Cover Poster',
        url: thumbUrl,
        outputPath: path.join(dramaFolder, `${this.sanitizeFilename(task.dramaTitle)}.jpg`),
        status: 'completed',
        progress: 100
      };
    }

    // Automatically download drama thumbnail alongside video!
    if (task.cover) {
      this.downloadCover(task.cover, dramaFolder, task.dramaTitle).catch(() => {});
    }

    // Format episode filename strictly as numbered episodes: "[Drama] - ភាគ 01.mp4"
    let epNum = task.episodeIndex;
    if (!epNum) {
      const epMatch = (task.episodeTitle || '').match(/([0-9]+)/);
      epNum = epMatch ? parseInt(epMatch[1], 10) : 1;
    }
    const padLen = (task.totalEpisodes && task.totalEpisodes >= 100) ? 3 : 2;
    const padded = String(epNum).padStart(padLen, '0');
    const filename = `${this.sanitizeFilename(task.dramaTitle)} - ភាគ ${padded}.mp4`;
    const cleanEpTitle = `ភាគ ${padded}`;
    const outputPath = path.join(dramaFolder, filename);

    // Default autoStart is false as requested by user ("រឿង Add ទៅកន្លែង Download សិនកំអាល Download auto")
    const isAutoStart = task.autoStart === true;
    const initialStatus = isAutoStart ? 'queued' : 'waiting';

    const taskData = {
      id,
      dramaId: task.dramaId || '',
      dramaTitle: task.dramaTitle || 'Unknown Drama',
      episodeIndex: epNum,
      episodeTitle: cleanEpTitle,
      url: task.url,
      fallbackUrl: task.fallbackUrl || '',
      vid: task.vid || (task.url && task.url.startsWith('hongguo://') ? (task.url.match(/hongguo:\/\/(\d+)/)?.[1] || '') : ''),
      cover: task.cover || '',
      destDir: baseDir,
      customDownloadDir: baseDir,
      outputPath,
      status: initialStatus, // 'waiting' | 'queued' | 'downloading' | 'completed' | 'paused' | 'error'
      progress: 0,
      speed: '0 KB/s',
      downloadedBytes: 0,
      totalBytes: 0,
      eta: '--:--',
      error: null,
      createdAt: Date.now()
    };

    // Prevent duplicate tasks for the same output file if active or waiting
    const existingActive = Array.from(this.activeTasks.values()).find(t => t.task.outputPath === outputPath);
    if (existingActive) {
      return existingActive.task;
    }
    const existingInQueue = this.queue.find(t => t.outputPath === outputPath && t.status !== 'canceled');
    if (existingInQueue) {
      if (isAutoStart && (existingInQueue.status === 'waiting' || existingInQueue.status === 'paused' || existingInQueue.status === 'error')) {
        existingInQueue.status = 'queued';
        this.emit('task-status-changed', existingInQueue);
        if (emitEvent) {
          this.processQueue();
        }
      }
      return existingInQueue;
    }

    this.queue.push(taskData);
    if (emitEvent) {
      this.emit('task-added', taskData);
      if (isAutoStart) {
        this.processQueue();
      }
    }
    return taskData;
  }

  addBatch(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    const results = [];
    for (const t of tasks) {
      results.push(this.addTask(t, false));
    }
    if (results.length > 0) {
      this.emit('task-added', results[results.length - 1]);
      if (tasks.some(t => t.autoStart)) {
        this.processQueue();
      }
    }
    return results;
  }

  processQueue() {
    if (this._isLaunchingQueue) return;
    this._isLaunchingQueue = true;

    const launchNext = () => {
      if (this.activeTasks.size >= this.maxConcurrent) {
        this._isLaunchingQueue = false;
        return;
      }
      const nextTask = this.queue.find(t => t.status === 'queued');
      if (!nextTask) {
        this._isLaunchingQueue = false;
        return;
      }
      this.startTask(nextTask);

      // Stagger subsequent parallel launches by 50ms for smooth high-speed startup
      if (this.activeTasks.size < this.maxConcurrent && this.queue.some(t => t.status === 'queued')) {
        setTimeout(launchNext, 50);
      } else {
        this._isLaunchingQueue = false;
      }
    };

    launchNext();
  }

  async resolveFallbackStreamForTask(task, preferAlternate = false) {
    if (!task) return '';
    if (!preferAlternate && task.fallbackUrl && /^https?:\/\//i.test(task.fallbackUrl) && task.fallbackUrl !== task.url) {
      return task.fallbackUrl;
    }

    const epNum = task.episodeIndex || (() => {
      const m = (task.episodeTitle || '').match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 1;
    })();

    // 1. Try MacCMS multi-source stream lookup by dramaTitle (cached per dramaTitle)
    const rawTitle = String(task.dramaTitle || '').trim();
    if (rawTitle && rawTitle !== 'Unknown Drama') {
      const cacheKey = rawTitle.toLowerCase();
      if (!this.macStreamCache.has(cacheKey)) {
        const lookupPromise = (async () => {
          const delimiter = String.fromCharCode(36, 36, 36); // "$$$"
          const parseVodEpisodes = (v) => {
            if (!v) return [];
            const candidates = [];
            if (v.vod_down_url && v.vod_down_url.includes('.mp4')) candidates.push(...v.vod_down_url.split(delimiter));
            if (v.vod_play_url) candidates.push(...v.vod_play_url.split(delimiter));
            let best = [];
            for (const part of candidates) {
              if (!part) continue;
              const urls = (part.split('#') || []).map(seg => {
                const s = seg.split('$');
                return (s[1] ? s[1].trim() : (s[0] && s[0].startsWith('http') ? s[0].trim() : ''));
              }).filter(u => /^https?:\/\//i.test(u) && (u.includes('.m3u8') || u.includes('.mp4')));
              if (urls.length > best.length) best = urls;
            }
            return best;
          };

          const searchWords = [rawTitle];
          const core = rawTitle.split(/[：:，,\s（(]/)[0].trim();
          if (core && core.length >= 2 && core !== rawTitle) searchWords.push(core);

          const normTarget = rawTitle.toLowerCase().replace(/[\s\-_，。！？：:,!?""''《》【】()（）]/g, '');
          const normCore = core.toLowerCase().replace(/[\s\-_，。！？：:,!?""''《》【】()（）]/g, '');

          for (const wd of searchWords) {
            const urls = [
              `https://cj.ffzyapi.com/api.php/provide/vod?ac=videolist&wd=${encodeURIComponent(wd)}`,
              `https://cj.lziapi.com/api.php/provide/vod?ac=videolist&wd=${encodeURIComponent(wd)}`,
              `https://bfzyapi.com/api.php/provide/vod?ac=videolist&wd=${encodeURIComponent(wd)}`,
              `https://subocaiji.com/api.php/provide/vod?ac=videolist&wd=${encodeURIComponent(wd)}`,
              `https://jinyingzy.com/provide/vod/from/jinying/at/json?ac=videolist&wd=${encodeURIComponent(wd)}`,
              `https://jszyapi.com/api.php/provide/vod?ac=videolist&wd=${encodeURIComponent(wd)}`,
              `https://api.guangsuapi.com/api.php/provide/vod?ac=videolist&wd=${encodeURIComponent(wd)}`
            ];
            // Dynamically include any additional enabled maccms_v10 sources from data/sources.json
            try {
              const srcPath = path.join(__dirname, '..', 'data', 'sources.json');
              if (fs.existsSync(srcPath)) {
                const customSources = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
                if (Array.isArray(customSources)) {
                  for (const s of customSources) {
                    if (s.enabled !== false && s.type === 'maccms_v10' && s.api && /^https?:\/\//i.test(s.api)) {
                      const base = s.api.split('?')[0];
                      if (!urls.some(u => u.startsWith(base))) {
                        const sep = s.api.includes('?') ? '&' : '?';
                        urls.push(`${s.api}${sep}ac=videolist&wd=${encodeURIComponent(wd)}`);
                      }
                    }
                  }
                }
              }
            } catch (_) {}
            const settled = await Promise.allSettled(
              urls.map(async u => {
                const r = await fetch(u, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                  signal: AbortSignal.timeout(7000)
                });
                if (!r.ok) return [];
                const d = await r.json();
                return d.list || [];
              })
            );
            const allVods = [];
            settled.forEach(s => {
              if (s.status === 'fulfilled' && Array.isArray(s.value)) allVods.push(...s.value);
            });

            const candidates = [];
            for (const v of allVods) {
              const epUrls = parseVodEpisodes(v);
              if (epUrls.length < 5) continue;
              const normName = (v.vod_name || '').toLowerCase().replace(/[\s\-_，。！？：:,!?""''《》【】()（）]/g, '');
              const isMatch = normName === normTarget ||
                (normTarget.length >= 2 && (normName.includes(normTarget) || normTarget.includes(normName))) ||
                (normCore.length >= 2 && normName.includes(normCore));
              if (!isMatch) continue;
              let score = epUrls.length * 5;
              const tName = v.type_name || '';
              if (/短剧|爽文|爽剧|言情|总裁|都市|古装|穿越|漫剧|重生|逆袭/.test(tName)) score += 1000;
              if (normName === normTarget) score += 800;
              if (epUrls[0] && epUrls[0].includes('.mp4') && !epUrls[0].includes('.m3u8')) score += 300;
              if (epUrls[0] && /ffzy|lzdown|lzcdn/i.test(epUrls[0])) score += 150;
              candidates.push({ score, epUrls });
            }
            if (candidates.length > 0) {
              candidates.sort((a, b) => b.score - a.score);
              return candidates.map(c => c.epUrls);
            }
          }
          return [];
        })().catch(() => []);
        this.macStreamCache.set(cacheKey, lookupPromise);
      }

      const candidateLists = await this.macStreamCache.get(cacheKey);
      if (Array.isArray(candidateLists) && candidateLists.length > 0) {
        for (const epUrls of candidateLists) {
          const candidateUrl = epUrls[epNum - 1];
          if (candidateUrl && (!preferAlternate || candidateUrl !== task.url)) {
            return candidateUrl;
          }
        }
        if (candidateLists[0] && candidateLists[0][epNum - 1]) {
          return candidateLists[0][epNum - 1];
        }
      }
    }

    // 2. Try Hongguo Web protected fallback-play-info or public 360p stream if task has VID
    if (task.vid && /^\d+$/.test(String(task.vid))) {
      try {
        const res = await fetch('https://hongguoduanju.com/api/video/protected/fallback-play-info', {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Content-Type': 'application/json',
            'Referer': 'https://hongguoduanju.com/'
          },
          body: JSON.stringify({ item_id: String(task.vid) }),
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          const playUrl = data.main_url || data.backup_url_1 || (data.data && (data.data.main_url || data.data.backup_url_1));
          if (playUrl && /^https?:\/\//i.test(playUrl)) {
            return playUrl;
          }
        }
      } catch (_) {}

      try {
        const pubUrl = `https://hongguoduanju.com/video/public/${task.vid}/360p.mp4`;
        const headRes = await fetch(pubUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000)
        });
        if (headRes.ok) {
          return pubUrl;
        }
      } catch (_) {}
    }

    return '';
  }

  isDirectMp4Url(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    if (lower.includes('.m3u8')) return false;
    return lower.includes('.mp4') || lower.includes('mime_type=video_mp4') || lower.includes('video/mp4');
  }

  startTask(task) {
    if (!task.vid && task.url && task.url.startsWith('hongguo://')) {
      const match = task.url.match(/hongguo:\/\/(\d+)/);
      if (match) task.vid = match[1];
    }
    task.status = 'downloading';
    task.error = null;
    // Register active task synchronously immediately to prevent queue overshoot or race condition
    this.activeTasks.set(task.id, {
      process: null,
      task,
      startTime: Date.now()
    });
    this.emit('task-status-changed', task);

    // 1. If task already has a direct HTTP/HTTPS stream (.m3u8 or .mp4), download directly at high speed
    if (task.url && /^https?:\/\//i.test(task.url)) {
      if (this.isDirectMp4Url(task.url)) {
        this.downloadDirectMp4(task);
      } else {
        this.downloadHlsFast(task);
      }
      return;
    }

    // 2. Resolve direct high-speed stream first (cached per dramaTitle); fall back to Hongguo VID binary if needed
    task._fallbackChecked = false;
    this.resolveFallbackStreamForTask(task).then((resolvedUrl) => {
      task._fallbackChecked = true;
      if (task.status === 'paused' || task.status === 'canceled') return;
      if (resolvedUrl && /^https?:\/\//i.test(resolvedUrl)) {
        task.url = resolvedUrl;
        if (this.isDirectMp4Url(task.url)) {
          this.downloadDirectMp4(task);
        } else {
          this.downloadHlsFast(task);
        }
      } else if (task.vid) {
        this.downloadHongguoVid(task);
      } else {
        this.activeTasks.delete(task.id);
        this.handleTaskFailure(task, 'Stream not found for this episode');
      }
    }).catch((err) => {
      if (task.vid) {
        this.downloadHongguoVid(task);
      } else {
        this.activeTasks.delete(task.id);
        this.handleTaskFailure(task, err.message || 'Stream resolution failed');
      }
    });
  }

  resolveHongguoDownloader() {
    // 1. Packaged environment: Physical disk MUST be used because Windows cannot execute binaries from inside app.asar
    if (process.resourcesPath) {
      const packagedPaths = [
        path.join(process.resourcesPath, 'bin', 'hongguo_downloader.exe'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'hongguo_downloader.exe'),
        path.join(path.dirname(process.execPath || ''), 'resources', 'bin', 'hongguo_downloader.exe'),
        path.join(path.dirname(process.execPath || ''), 'bin', 'hongguo_downloader.exe')
      ];
      for (const p of packagedPaths) {
        if (fs.existsSync(p)) {
          return { command: p, defaultArgs: [] };
        }
      }
    }

    // 2. Development environment: check project root bin/
    const devBin = path.join(__dirname, '..', 'bin', 'hongguo_downloader.exe');
    if (fs.existsSync(devBin)) {
      return { command: devBin, defaultArgs: [] };
    }

    const localBin = path.join(__dirname, 'bin', 'hongguo_downloader.exe');
    if (fs.existsSync(localBin)) {
      return { command: localBin, defaultArgs: [] };
    }

    // 3. Fallback to dev python virtual environment
    const venvPython = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
    const pythonExe = fs.existsSync(venvPython) ? venvPython : 'python';
    const scriptPath = path.join(__dirname, 'hongguo_downloader.py');
    return { command: pythonExe, defaultArgs: [scriptPath] };
  }

  downloadHongguoVid(task) {
    const controller = new AbortController();
    const activeEntry = this.activeTasks.get(task.id);
    if (activeEntry) {
      activeEntry.process = {
        kill: () => {
          try { controller.abort(); } catch (e) {}
        }
      };
    }

    task.speed = '⚡ 1080P VIP';
    task.progress = 15;
    this.emit('task-progress', task);

    downloadAndDecryptHongguo(task.vid, task.outputPath, (p) => {
      task.progress = p.percent;
      task.speed = p.speed;
      if (p.downloadedBytes) task.downloadedBytes = p.downloadedBytes;
      if (p.totalBytes) task.totalBytes = p.totalBytes;
      this.emit('task-progress', task);
    }, controller.signal).then(() => {
      this.activeTasks.delete(task.id);
      if (this._blockedDramaCounts) {
        this._blockedDramaCounts.delete(task.dramaTitle || '');
      }

      task.status = 'completed';
      task.progress = 100;
      task.speed = 'Done';
      task.error = null;
      try {
        const stat = fs.statSync(task.outputPath);
        task.downloadedBytes = stat.size;
        task.totalBytes = stat.size;
      } catch (e) {}
      this.emit('task-completed', task);
      this.processQueue();
    }).catch((err) => {
      this.activeTasks.delete(task.id);
      if (task.status === 'paused' || task.status === 'canceled') return;

      const errMsg = err.message || `Download failed for VID ${task.vid}`;

      // Automatically try MacCMS fallback stream if Hongguo VID fails
      if (!task._fallbackChecked) {
        task._fallbackChecked = true;
        this.resolveFallbackStreamForTask(task).then((fallbackUrl) => {
          if (task.status === 'paused' || task.status === 'canceled') return;
          if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) {
            task.url = fallbackUrl;
            task.speed = '⚡ 1080P Backup Stream...';
            this.emit('task-progress', task);
            if (this.isDirectMp4Url(fallbackUrl)) {
              this.downloadDirectMp4(task);
            } else {
              this.downloadHlsFast(task);
            }
          } else {
            this.handleTaskFailure(task, errMsg);
          }
        }).catch(() => {
          this.handleTaskFailure(task, errMsg);
        });
      } else {
        this.handleTaskFailure(task, errMsg);
      }
    });
  }

  // Ultra-fast Multi-Threaded HLS (.m3u8) Downloader: downloads .ts segments with 16 parallel connections, then remuxes locally via FFmpeg
  async downloadHlsFast(task) {
    const partPath = `${task.outputPath}.part`;
    const tsConcatPath = `${task.outputPath}.ts.part`;
    const abortCtrl = new AbortController();
    let remuxChild = null;

    this.activeTasks.set(task.id, {
      process: {
        kill: () => {
          try { abortCtrl.abort(); } catch (e) {}
          try { if (remuxChild) remuxChild.kill('SIGKILL'); } catch (e) {}
          try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
          try { if (fs.existsSync(tsConcatPath)) fs.unlinkSync(tsConcatPath); } catch (e) {}
        }
      },
      task
    });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const resolveUrl = (base, rel) => {
      try {
        return new URL(rel, base).href;
      } catch (e) {
        return rel;
      }
    };

    try {
      let currentM3u8Url = task.url;
      let m3u8Text = '';

      // Follow up to 3 levels of master -> variant playlist redirection
      for (let depth = 0; depth < 3; depth++) {
        const res = await fetch(currentM3u8Url, {
          headers,
          signal: AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(10000)])
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} on m3u8`);
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('video/mp4') || (contentType.startsWith('video/') && !contentType.includes('mpegurl'))) {
          try { await res.body?.cancel(); } catch (_) {}
          return this.downloadDirectMp4(task);
        }
        m3u8Text = await res.text();
        const lines = m3u8Text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const subM3u8 = lines.find(l => !l.startsWith('#') && l.toLowerCase().includes('.m3u8'));
        if (subM3u8) {
          currentM3u8Url = resolveUrl(currentM3u8Url, subM3u8);
        } else {
          break;
        }
      }

      // If encrypted (#EXT-X-KEY) or fMP4 (#EXT-X-MAP), delegate to FFmpeg native HLS handler
      if (m3u8Text.includes('#EXT-X-KEY') || m3u8Text.includes('#EXT-X-MAP')) {
        return this.downloadHlsWithFFmpeg(task);
      }

      const rawLines = m3u8Text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const segmentUrls = rawLines
        .filter(l => !l.startsWith('#'))
        .map(l => resolveUrl(currentM3u8Url, l));

      if (segmentUrls.length === 0) {
        return this.downloadHlsWithFFmpeg(task);
      }

      const totalSegments = segmentUrls.length;
      const buffers = new Array(totalSegments);
      let completedSegments = 0;
      let downloadedBytes = 0;
      let lastBytes = 0;
      let lastTime = Date.now();
      let nextIdx = 0;
      const concurrency = Math.min(8, totalSegments);

      const fetchSegmentWithRetry = async (segUrl) => {
        let lastErr;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (abortCtrl.signal.aborted) throw new Error('Aborted');
          try {
            const r = await fetch(segUrl, {
              headers,
              signal: AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(7000)])
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const ab = await r.arrayBuffer();
            return Buffer.from(ab);
          } catch (e) {
            lastErr = e;
            if (abortCtrl.signal.aborted) throw e;
            await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
          }
        }
        throw lastErr;
      };

      const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
          const i = nextIdx++;
          if (i >= totalSegments) break;
          const buf = await fetchSegmentWithRetry(segmentUrls[i]);
          buffers[i] = buf;
          completedSegments++;
          downloadedBytes += buf.length;
          task.downloadedBytes = downloadedBytes;
          task.progress = Math.min(94, Math.max(5, Math.round((completedSegments / totalSegments) * 92)));

          const now = Date.now();
          if (now - lastTime >= 250) {
            const deltaBytes = downloadedBytes - lastBytes;
            const speedBps = (deltaBytes / (now - lastTime)) * 1000;
            if (speedBps > 0) task.speed = this.formatSpeed(speedBps);
            lastBytes = downloadedBytes;
            lastTime = now;
            this.emit('task-progress', task);
          }
        }
      });

      await Promise.all(workers);
      if (abortCtrl.signal.aborted || task.status === 'paused' || task.status === 'canceled') return;

      // Write combined MPEG-TS segments to disk and remux to faststart MP4 via local FFmpeg
      const ws = fs.createWriteStream(tsConcatPath);
      for (let i = 0; i < totalSegments; i++) {
        if (buffers[i]) ws.write(buffers[i]);
      }
      await new Promise((resolve, reject) => {
        ws.on('finish', resolve);
        ws.on('error', reject);
        ws.end();
      });

      task.progress = 97;
      this.emit('task-progress', task);

      await new Promise((resolve, reject) => {
        remuxChild = spawn(this.ffmpegPath, [
          '-y',
          '-f', 'mpegts',
          '-i', tsConcatPath,
          '-c', 'copy',
          '-fflags', '+genpts+discardcorrupt',
          '-avoid_negative_ts', 'make_zero',
          '-bsf:a', 'aac_adtstoasc',
          '-movflags', '+faststart',
          '-f', 'mp4',
          partPath
        ], { windowsHide: true });

        remuxChild.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Local remux failed (code ${code})`));
        });
        remuxChild.on('error', reject);
      });

      try { if (fs.existsSync(tsConcatPath)) fs.unlinkSync(tsConcatPath); } catch (e) {}
      this.activeTasks.delete(task.id);

      if (!this.validateVideoFile(partPath)) {
        try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
        throw new Error('Remuxed MP4 failed validation');
      }

      try {
        if (fs.existsSync(task.outputPath)) fs.unlinkSync(task.outputPath);
        fs.renameSync(partPath, task.outputPath);
      } catch (e) {
        try { fs.copyFileSync(partPath, task.outputPath); fs.unlinkSync(partPath); } catch (e2) {}
      }

      task.status = 'completed';
      task.progress = 100;
      task.speed = 'Done';
      task.error = null;
      try {
        const stat = fs.statSync(task.outputPath);
        task.downloadedBytes = stat.size;
        task.totalBytes = stat.size;
      } catch (e) {}
      this.emit('task-completed', task);
      this.processQueue();
    } catch (err) {
      try { if (fs.existsSync(tsConcatPath)) fs.unlinkSync(tsConcatPath); } catch (e) {}
      try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
      if (abortCtrl.signal.aborted || task.status === 'paused' || task.status === 'canceled') {
        this.activeTasks.delete(task.id);
        return;
      }
      // Fallback to native FFmpeg HLS stream downloader if parallel TS fetch had any issue
      return this.downloadHlsWithFFmpeg(task);
    }
  }

  downloadHlsWithFFmpeg(task) {
    const partPath = `${task.outputPath}.part`;
    const args = [
      '-y',
      '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\nReferer: https://hongguoduanju.com/\r\n',
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '2',
      '-rw_timeout', '10000000',
      '-analyzeduration', '1000000',
      '-probesize', '1000000',
      '-i', task.url,
      '-c', 'copy',
      '-fflags', '+genpts+discardcorrupt',
      '-avoid_negative_ts', 'make_zero',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', '+faststart',
      '-f', 'mp4',
      partPath
    ];

    try {
      const child = spawn(this.ffmpegPath, args, { windowsHide: true });
      let totalDurationSec = 0;
      let lastBytes = 0;
      let lastTime = Date.now();

      this.activeTasks.set(task.id, { 
        process: {
          kill: () => {
            try { child.kill(); } catch (e) {}
            try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
          }
        }, 
        task 
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();

        const durMatch = text.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (durMatch) {
          const h = parseFloat(durMatch[1]);
          const m = parseFloat(durMatch[2]);
          const s = parseFloat(durMatch[3]);
          totalDurationSec = h * 3600 + m * 60 + s;
        }

        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch) {
          const h = parseFloat(timeMatch[1]);
          const m = parseFloat(timeMatch[2]);
          const s = parseFloat(timeMatch[3]);
          const currentSec = h * 3600 + m * 60 + s;

          if (totalDurationSec > 0) {
            task.progress = Math.min(99, Math.round((currentSec / totalDurationSec) * 100));
          } else {
            task.progress = Math.min(95, Math.round(task.progress + 1));
          }

          try {
            if (fs.existsSync(partPath)) {
              const stat = fs.statSync(partPath);
              const currentBytes = stat.size;
              const now = Date.now();
              const deltaMs = now - lastTime;
              if (deltaMs >= 500) {
                const deltaBytes = currentBytes - lastBytes;
                const speedBytesPerSec = (deltaBytes / deltaMs) * 1000;
                task.speed = this.formatSpeed(speedBytesPerSec);
                task.downloadedBytes = currentBytes;
                lastBytes = currentBytes;
                lastTime = now;
              }
            }
          } catch (e) {}

          this.emit('task-progress', task);
        }
      });

      child.on('close', (code) => {
        this.activeTasks.delete(task.id);
        const isPartValid = this.validateVideoFile(partPath);
        if (code === 0 && isPartValid) {
          try {
            if (fs.existsSync(task.outputPath)) fs.unlinkSync(task.outputPath);
            fs.renameSync(partPath, task.outputPath);
          } catch (e) {
            try { fs.copyFileSync(partPath, task.outputPath); fs.unlinkSync(partPath); } catch (e2) {}
          }

          task.status = 'completed';
          task.progress = 100;
          task.speed = 'Done';
          task.error = null;
          try {
            const stat = fs.statSync(task.outputPath);
            task.downloadedBytes = stat.size;
            task.totalBytes = stat.size;
          } catch(e) {}
          this.emit('task-completed', task);
          this.processQueue();
        } else if (task.status !== 'paused' && task.status !== 'canceled') {
          try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
          this.handleTaskFailure(task, `FFmpeg incomplete stream (Code: ${code})`);
        }
      });

      child.on('error', (err) => {
        try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
        this.activeTasks.delete(task.id);
        this.handleTaskFailure(task, err.message);
      });

    } catch (err) {
      try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
      this.activeTasks.delete(task.id);
      this.handleTaskFailure(task, err.message);
    }
  }

  async downloadDirectMp4(task) {
    const partPath = `${task.outputPath}.part`;
    const abortCtrl = new AbortController();
    let connectTimer = null;
    let fileStream = null;
    let reader = null;

    const taskWrapper = {
      process: {
        kill: () => {
          try { if (connectTimer) clearTimeout(connectTimer); } catch (e) {}
          try { abortCtrl.abort(); } catch (e) {}
          try { if (reader) reader.cancel(); } catch (e) {}
          try { if (fileStream) fileStream.destroy(); } catch (e) {}
          try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
        }
      },
      task
    };
    this.activeTasks.set(task.id, taskWrapper);

    try {
      fs.mkdirSync(path.dirname(partPath), { recursive: true });
      connectTimer = setTimeout(() => abortCtrl.abort(), 20000);
      const response = await fetch(task.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: abortCtrl.signal
      });
      clearTimeout(connectTimer);
      connectTimer = null;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const totalLength = parseInt(response.headers.get('content-length') || '0', 10);
      task.totalBytes = totalLength;

      fileStream = fs.createWriteStream(partPath);
      reader = response.body.getReader();
      let downloaded = 0;
      let lastBytes = 0;
      let lastTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(Buffer.from(value));
        downloaded += value.length;
        task.downloadedBytes = downloaded;

        if (totalLength > 0) {
          task.progress = Math.min(99, Math.round((downloaded / totalLength) * 100));
        }

        const now = Date.now();
        if (now - lastTime >= 500) {
          const deltaBytes = downloaded - lastBytes;
          const speedBps = (deltaBytes / (now - lastTime)) * 1000;
          task.speed = this.formatSpeed(speedBps);
          lastBytes = downloaded;
          lastTime = now;
          this.emit('task-progress', task);
        }
      }

      // Guarantee complete stream flush to disk before proceeding
      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
        fileStream.end();
      });

      this.activeTasks.delete(task.id);

      // Verify file integrity
      if (!this.validateVideoFile(partPath)) {
        try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
        throw new Error('Downloaded MP4 is incomplete or corrupted');
      }

      try {
        if (fs.existsSync(task.outputPath)) fs.unlinkSync(task.outputPath);
        fs.renameSync(partPath, task.outputPath);
      } catch (e) {
        try { fs.copyFileSync(partPath, task.outputPath); fs.unlinkSync(partPath); } catch (e2) {}
      }

      task.status = 'completed';
      task.progress = 100;
      task.speed = 'Done';
      this.emit('task-completed', task);
      this.processQueue();

    } catch (err) {
      if (connectTimer) clearTimeout(connectTimer);
      try { if (fileStream) fileStream.destroy(); } catch (e) {}
      try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
      this.activeTasks.delete(task.id);
      if (task.status === 'paused' || task.status === 'canceled') return;
      this.handleTaskFailure(task, err.message);
    }
  }

  pauseTask(taskId) {
    const active = this.activeTasks.get(taskId);
    if (active) {
      active.task.status = 'paused';
      if (active.process && typeof active.process.kill === 'function') {
        active.process.kill();
      }
      this.activeTasks.delete(taskId);
      this.emit('task-status-changed', active.task);
      this.processQueue();
      return true;
    }
    const queued = this.queue.find(t => t.id === taskId);
    if (queued) {
      queued.status = 'paused';
      this.emit('task-status-changed', queued);
      return true;
    }
    return false;
  }

  resumeTask(taskId) {
    const task = this.queue.find(t => t.id === taskId);
    if (task && (task.status === 'paused' || task.status === 'error')) {
      task.status = 'queued';
      this.emit('task-status-changed', task);
      this.processQueue();
      return true;
    }
    return false;
  }

  cancelTask(taskId) {
    const active = this.activeTasks.get(taskId);
    if (active) {
      active.task.status = 'canceled';
      if (active.process && typeof active.process.kill === 'function') {
        active.process.kill();
      }
      this.activeTasks.delete(taskId);
      try {
        if (fs.existsSync(active.task.outputPath)) {
          fs.unlinkSync(active.task.outputPath);
        }
      } catch (e) {}
      this.emit('task-status-changed', active.task);
      this.processQueue();
    }

    const qIdx = this.queue.findIndex(t => t.id === taskId);
    if (qIdx !== -1) {
      const removed = this.queue.splice(qIdx, 1)[0];
      removed.status = 'canceled';
      this.emit('task-status-changed', removed);
    }
    return true;
  }

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec || isNaN(bytesPerSec)) return '0 KB/s';
    if (bytesPerSec >= 1024 * 1024) {
      return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
    }
    return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  }

  pauseAll() {
    for (const [taskId] of this.activeTasks) {
      this.pauseTask(taskId);
    }
    this.queue.forEach(t => {
      if (t.status === 'queued') {
        t.status = 'paused';
        this.emit('task-status-changed', t);
      }
    });
  }

  resumeAll() {
    this.queue.forEach(t => {
      if (t.status === 'paused' || t.status === 'error') {
        t.status = 'queued';
        this.emit('task-status-changed', t);
      }
    });
    this.processQueue();
  }

  clearCompleted() {
    this.queue = this.queue.filter(t => t.status !== 'completed');
    return this.queue;
  }

  // Auto-retry with exponential backoff up to 3 times (automatically switching to alternate CDN stream if available)
  handleTaskFailure(task, errMsg) {
    if (!task || task.status === 'paused' || task.status === 'canceled') return;

    // Fast-fail if upstream Hongguo API returned empty/blocked response and fallback was already checked
    const isUpstreamBlocked = task._fallbackChecked && /video_model JSON parse failed|public_fallback_unavailable/i.test(errMsg || '');
    if (isUpstreamBlocked) {
      task.status = 'error';
      task.error = 'VIP Ep blocked by Hongguo API (Only Ep 1-5 free without MacCMS source)';
      task.speed = 'បរាជ័យ (VIP)';
      this.emit('task-error', task);

      // Circuit-breaker: if 3+ episodes of this drama are blocked upstream, fail remaining queued hongguo:// episodes immediately
      const dKey = task.dramaTitle || '';
      const count = (this._blockedDramaCounts.get(dKey) || 0) + 1;
      this._blockedDramaCounts.set(dKey, count);
      if (count >= 3 && dKey) {
        let skipped = 0;
        for (const qt of this.queue) {
          if (qt.dramaTitle === dKey && qt.status === 'queued' && (!qt.url || qt.url.startsWith('hongguo://'))) {
            qt.status = 'error';
            qt.error = 'VIP Ep blocked by Hongguo API (Only Ep 1-5 free without MacCMS source)';
            qt.speed = 'បរាជ័យ (VIP)';
            skipped++;
          }
        }
        if (skipped > 0) {
          console.log(`[Downloader]: Circuit-breaker stopped ${skipped} remaining blocked hongguo:// episodes for "${dKey}"`);
          this.emit('task-status-changed', task);
        }
      }

      this.processQueue();
      return;
    }

    task.retryCount = (task.retryCount || 0) + 1;
    if (task.retryCount <= 3) {
      console.log(`[Downloader]: Retrying task ${task.id} (${task.episodeTitle}) attempt ${task.retryCount}/3: ${errMsg}`);
      task.status = 'queued';
      task.speed = `ព្យាយាមម្តងទៀត (${task.retryCount}/3)`;
      this.emit('task-status-changed', task);

      this.resolveFallbackStreamForTask(task, true).then((altUrl) => {
        if (altUrl && /^https?:\/\//i.test(altUrl)) {
          task.url = altUrl;
        }
        setTimeout(() => {
          this.processQueue();
        }, 800 * task.retryCount);
      }).catch(() => {
        setTimeout(() => {
          this.processQueue();
        }, 800 * task.retryCount);
      });
    } else {
      task.status = 'error';
      task.error = errMsg;
      task.speed = 'បរាជ័យ';
      this.emit('task-error', task);
      this.processQueue();
    }
  }

  // Start all tasks for a specific drama
  startDrama(dramaTitle) {
    let started = false;
    this.queue.forEach(t => {
      if (t.dramaTitle === dramaTitle && (t.status === 'waiting' || t.status === 'paused' || t.status === 'error')) {
        t.status = 'queued';
        t.error = null;
        started = true;
        this.emit('task-status-changed', t);
      }
    });
    if (started) {
      this.processQueue();
    }
    return true;
  }

  // Remove all tasks of a specific drama completely from the queue
  removeDrama(dramaTitle) {
    // 1. Cancel any actively downloading tasks of this drama
    for (const [taskId, wrapper] of this.activeTasks) {
      if (wrapper.task.dramaTitle === dramaTitle) {
        this.cancelTask(taskId);
      }
    }
    // 2. Remove from queue list
    this.queue = this.queue.filter(t => t.dramaTitle !== dramaTitle);
    this.emit('task-status-changed', { dramaTitle, status: 'canceled' });
    this.processQueue();
    return true;
  }

  // Start all waiting tasks across all dramas (Batch Download)
  startAllWaiting() {
    let started = false;
    this.queue.forEach(t => {
      if (t.status === 'waiting' || t.status === 'paused' || t.status === 'error') {
        t.status = 'queued';
        t.error = null;
        started = true;
        this.emit('task-status-changed', t);
      }
    });
    if (started) {
      this.processQueue();
    }
    return true;
  }

  // Update destination folder for all non-completed tasks of a specific drama, and migrate completed episodes
  updateDramaFolder(dramaTitle, newDir) {
    if (!newDir || !dramaTitle) return false;
    this.ensureDir(newDir);
    const dramaFolder = path.join(newDir, this.sanitizeFilename(dramaTitle));
    this.ensureDir(dramaFolder);
    let updated = false;

    this.queue.forEach(t => {
      if (t.dramaTitle === dramaTitle) {
        if (t.status !== 'completed' && t.status !== 'downloading') {
          t.destDir = newDir;
          t.customDownloadDir = newDir;
          const filename = path.basename(t.outputPath);
          t.outputPath = path.join(dramaFolder, filename);
          updated = true;
        } else if (t.status === 'completed' && t.outputPath && fs.existsSync(t.outputPath)) {
          // Migrate completed file to new directory so all episodes of this drama stay together!
          try {
            const oldFile = t.outputPath;
            const newFile = path.join(dramaFolder, path.basename(oldFile));
            if (oldFile !== newFile && !fs.existsSync(newFile)) {
              fs.renameSync(oldFile, newFile);
              t.outputPath = newFile;
              t.destDir = newDir;
              t.customDownloadDir = newDir;
              updated = true;
            }
          } catch (e) {
            try {
              const oldFile = t.outputPath;
              const newFile = path.join(dramaFolder, path.basename(oldFile));
              if (oldFile !== newFile && !fs.existsSync(newFile)) {
                fs.copyFileSync(oldFile, newFile);
                fs.unlinkSync(oldFile);
                t.outputPath = newFile;
                t.destDir = newDir;
                t.customDownloadDir = newDir;
                updated = true;
              }
            } catch (err2) {}
          }
        }
      }
    });

    if (updated) {
      this.emit('task-status-changed', { dramaTitle, destDir: newDir });
    }
    return updated;
  }

  // Lossless FFmpeg concatenation of all downloaded episodes into a single Full Movie MP4
  async mergeDrama(dramaTitle, baseDir = null) {
    const dir = baseDir || this.downloadDir;
    const dramaFolder = path.join(dir, this.sanitizeFilename(dramaTitle));
    if (!fs.existsSync(dramaFolder)) {
      throw new Error('រកមិនឃើញ Folder របស់រឿងនេះទេ');
    }

    // Find all mp4 episode files, excluding existing merged movie files
    const files = fs.readdirSync(dramaFolder)
      .filter(f => f.toLowerCase().endsWith('.mp4') && !f.includes('Full Movie') && !f.includes('ពេញមួយរឿង'))
      .sort((a, b) => {
        const numA = (a.match(/(\d+)/g) || [0]).pop();
        const numB = (b.match(/(\d+)/g) || [0]).pop();
        return parseInt(numA, 10) - parseInt(numB, 10);
      });

    if (files.length < 2) {
      throw new Error(`ទាមទារយ៉ាងហោចណាស់ ២ ភាគដែលទាញយកចប់ ទើបអាចផ្គុំបាន (បច្ចុប្បន្នមាន ${files.length} ភាគ)`);
    }

    const listFileName = `concat_list_${Date.now()}.txt`;
    const listFilePath = path.join(dramaFolder, listFileName);
    const listLines = files.map(f => {
      const fullPath = path.join(dramaFolder, f).replace(/\\/g, '/');
      return `file '${fullPath}'`;
    }).join('\n');

    fs.writeFileSync(listFilePath, listLines, 'utf-8');

    const outputFileName = `${this.sanitizeFilename(dramaTitle)} - [Full Movie ពេញមួយរឿង].mp4`;
    const outputPath = path.join(dramaFolder, outputFileName);

    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFilePath,
        '-c', 'copy',
        '-fflags', '+genpts+igndts',
        '-avoid_negative_ts', 'make_zero',
        '-bsf:a', 'aac_adtstoasc',
        '-movflags', '+faststart',
        outputPath
      ], { windowsHide: true });

      proc.on('close', (code) => {
        try { if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath); } catch (e) {}
        if (code === 0 && this.validateVideoFile(outputPath)) {
          resolve({
            success: true,
            outputFile: outputPath,
            fileName: outputFileName,
            episodeCount: files.length,
            folder: dramaFolder
          });
        } else {
          try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) {}
          reject(new Error(`FFmpeg error (Code: ${code}) or incomplete merged movie file`));
        }
      });

      proc.on('error', (err) => {
        try { if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath); } catch (e) {}
        reject(err);
      });
    });
  }

  // Extract high-quality MP3 audio from downloaded drama
  async extractDramaAudio(dramaTitle, baseDir = null) {
    const dir = baseDir || this.downloadDir;
    const dramaFolder = path.join(dir, this.sanitizeFilename(dramaTitle));
    if (!fs.existsSync(dramaFolder)) {
      throw new Error('រកមិនឃើញ Folder របស់រឿងនេះទេ');
    }

    const fullMovie = path.join(dramaFolder, `${this.sanitizeFilename(dramaTitle)} - [Full Movie ពេញមួយរឿង].mp4`);
    const outputMp3 = path.join(dramaFolder, `${this.sanitizeFilename(dramaTitle)} - [សំឡេងរឿង MP3].mp3`);

    let inputArgs = [];
    let tempConcatList = null;

    if (fs.existsSync(fullMovie)) {
      inputArgs = ['-i', fullMovie];
    } else {
      const files = fs.readdirSync(dramaFolder)
        .filter(f => f.toLowerCase().endsWith('.mp4') && !f.includes('Full Movie') && !f.includes('ពេញមួយរឿង'))
        .sort((a, b) => {
          const numA = (a.match(/(\d+)/g) || [0]).pop();
          const numB = (b.match(/(\d+)/g) || [0]).pop();
          return parseInt(numA, 10) - parseInt(numB, 10);
        });

      if (files.length === 0) {
        throw new Error('មិនទាន់មានភាគណាមួយទាញយកចប់ទេ');
      }

      tempConcatList = path.join(dramaFolder, `concat_audio_${Date.now()}.txt`);
      const lines = files.map(f => `file '${path.join(dramaFolder, f).replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(tempConcatList, lines, 'utf-8');
      inputArgs = ['-f', 'concat', '-safe', '0', '-i', tempConcatList];
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, [
        '-y',
        ...inputArgs,
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        outputMp3
      ], { windowsHide: true });

      proc.on('close', (code) => {
        try { if (tempConcatList && fs.existsSync(tempConcatList)) fs.unlinkSync(tempConcatList); } catch (e) {}
        if (code === 0 && fs.existsSync(outputMp3)) {
          resolve({
            success: true,
            outputFile: outputMp3,
            fileName: path.basename(outputMp3),
            folder: dramaFolder
          });
        } else {
          try { if (fs.existsSync(outputMp3)) fs.unlinkSync(outputMp3); } catch (e) {}
          reject(new Error(`FFmpeg MP3 extraction failed (Code: ${code})`));
        }
      });

      proc.on('error', (err) => {
        try { if (tempConcatList && fs.existsSync(tempConcatList)) fs.unlinkSync(tempConcatList); } catch (e) {}
        reject(err);
      });
    });
  }

  getAllTasks() {
    return this.queue;
  }
}

module.exports = DramaDownloader;
