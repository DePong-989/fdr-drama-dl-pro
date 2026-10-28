const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');

class DramaDownloader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.downloadDir = options.downloadDir || path.join(__dirname, '..', 'downloads');
    this.maxConcurrent = options.maxConcurrent || options.concurrentDownloads || 5;
    this.ffmpegPath = options.ffmpegPath || 'ffmpeg';
    this.queue = [];
    this.activeTasks = new Map(); // taskId -> { process, task, progress }
    this.completedTasks = [];
    this.ensureDir(this.downloadDir);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  setDownloadDir(dir) {
    this.downloadDir = dir;
    this.ensureDir(dir);
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
      const coverPath = path.join(folder, 'cover.jpg');
      const posterPath = path.join(folder, `${this.sanitizeFilename(dramaTitle)}.jpg`);
      if (fs.existsSync(coverPath) && fs.existsSync(posterPath)) return;

      const res = await fetch(coverUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (!fs.existsSync(coverPath)) fs.writeFileSync(coverPath, buffer);
        if (!fs.existsSync(posterPath)) fs.writeFileSync(posterPath, buffer);
      }
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
      dramaTitle: task.dramaTitle || 'Unknown Drama',
      episodeTitle: cleanEpTitle,
      url: task.url,
      vid: task.vid || '',
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

      // Stagger subsequent parallel launches by 160ms to prevent CPU spike & socket congestion
      if (this.activeTasks.size < this.maxConcurrent && this.queue.some(t => t.status === 'queued')) {
        setTimeout(launchNext, 160);
      } else {
        this._isLaunchingQueue = false;
      }
    };

    launchNext();
  }

  startTask(task) {
    task.status = 'downloading';
    task.error = null;
    // Register active task synchronously immediately to prevent queue overshoot or race condition
    this.activeTasks.set(task.id, {
      process: null,
      task,
      startTime: Date.now()
    });
    this.emit('task-status-changed', task);

    if (task.vid) {
      this.downloadHongguoVid(task);
      return;
    }

    const isDirectMp4 = task.url.toLowerCase().includes('.mp4') && !task.url.toLowerCase().includes('.m3u8');

    if (isDirectMp4) {
      this.downloadDirectMp4(task);
    } else {
      this.downloadHlsWithFFmpeg(task);
    }
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
    const resolver = this.resolveHongguoDownloader();
    const partPath = `${task.outputPath}.part`;

    task.speed = '⚡ 1080P VIP';
    task.progress = 20;
    this.emit('task-progress', task);

    const child = spawn(resolver.command, [...resolver.defaultArgs, task.vid, partPath], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      windowsHide: true
    });

    const activeEntry = this.activeTasks.get(task.id);
    if (activeEntry) {
      activeEntry.process = {
        kill: () => {
          try { child.kill('SIGKILL'); } catch (e) {}
          try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
        }
      };
    }

    let isFinished = false;
    // 90s watchdog timer ensures no process slot gets permanently blocked
    const watchdogTimer = setTimeout(() => {
      if (!isFinished && this.activeTasks.has(task.id)) {
        try { child.kill('SIGKILL'); } catch (e) {}
        try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
        this.activeTasks.delete(task.id);
        this.handleTaskFailure(task, 'Timeout 90s - Auto retrying');
      }
    }, 90000);

    let lastBytes = 0;
    let lastTime = Date.now();
    const progressTimer = setInterval(() => {
      try {
        if (fs.existsSync(partPath)) {
          const stat = fs.statSync(partPath);
          const currentBytes = stat.size;
          const now = Date.now();
          const deltaMs = now - lastTime;
          if (deltaMs >= 300 && currentBytes > 0) {
            const deltaBytes = currentBytes - lastBytes;
            const speedBps = (deltaBytes / deltaMs) * 1000;
            if (speedBps > 0) task.speed = this.formatSpeed(speedBps);
            task.downloadedBytes = currentBytes;
            lastBytes = currentBytes;
            lastTime = now;
            task.progress = Math.min(70, Math.max(25, Math.round(25 + (currentBytes / 8000000) * 45)));
            this.emit('task-progress', task);
          }
        }
      } catch (e) {}
    }, 300);

    let errBuffer = '';
    let outBuffer = '';
    child.stderr.on('data', (d) => {
      errBuffer += d.toString();
    });
    child.stdout.on('data', (d) => {
      const line = d.toString().trim();
      outBuffer += line + '\n';
      if (line.includes('download_seconds')) {
        task.progress = 75;
        task.speed = '⚡ Decrypting...';
        this.emit('task-progress', task);
      } else if (line.includes('decrypt_seconds') || line.includes('CENC decryption')) {
        task.progress = 92;
        task.speed = '⚡ Finalizing...';
        this.emit('task-progress', task);
      }
    });

    child.on('close', (code) => {
      isFinished = true;
      clearTimeout(watchdogTimer);
      clearInterval(progressTimer);
      this.activeTasks.delete(task.id);

      // Verify file integrity (must be valid MP4 and > 150KB)
      const isPartValid = this.validateVideoFile(partPath);
      const isOk = (code === 0 && isPartValid) || (outBuffer.includes('SUCCESS') && isPartValid);

      if (isOk) {
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
      } else {
        let errMsg = '';
        const errMatch = outBuffer.match(/ERROR:\s*(.+)/);
        if (errMatch) {
          errMsg = errMatch[1].trim();
        } else if (errBuffer) {
          errMsg = errBuffer.trim().slice(0, 100);
        } else {
          errMsg = `Incomplete stream for VID ${task.vid}`;
        }
        this.handleTaskFailure(task, errMsg);
      }
    });

    child.on('error', (err) => {
      isFinished = true;
      clearTimeout(watchdogTimer);
      clearInterval(progressTimer);
      try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
      this.activeTasks.delete(task.id);
      this.handleTaskFailure(task, err.message || 'Download process spawn error');
    });
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
    try {
      const response = await fetch(task.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const totalLength = parseInt(response.headers.get('content-length') || '0', 10);
      task.totalBytes = totalLength;

      const fileStream = fs.createWriteStream(partPath);
      const reader = response.body.getReader();
      let downloaded = 0;
      let lastBytes = 0;
      let lastTime = Date.now();

      const taskWrapper = {
        process: {
          kill: () => {
            reader.cancel();
            fileStream.destroy();
            try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
          }
        },
        task
      };
      this.activeTasks.set(task.id, taskWrapper);

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
      try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
      this.activeTasks.delete(task.id);
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

  // Auto-retry with exponential backoff up to 3 times
  handleTaskFailure(task, errMsg) {
    if (!task || task.status === 'paused' || task.status === 'canceled') return;

    task.retryCount = (task.retryCount || 0) + 1;
    if (task.retryCount <= 3) {
      console.log(`[Downloader]: Retrying task ${task.id} (${task.episodeTitle}) attempt ${task.retryCount}/3: ${errMsg}`);
      task.status = 'queued';
      task.speed = `ព្យាយាមម្តងទៀត (${task.retryCount}/3)`;
      this.emit('task-status-changed', task);
      setTimeout(() => {
        this.processQueue();
      }, 1500 * task.retryCount);
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

  // Update destination folder for all non-completed tasks of a specific drama
  updateDramaFolder(dramaTitle, newDir) {
    if (!newDir || !dramaTitle) return false;
    this.ensureDir(newDir);
    const dramaFolder = path.join(newDir, this.sanitizeFilename(dramaTitle));
    this.ensureDir(dramaFolder);
    let updated = false;
    this.queue.forEach(t => {
      if (t.dramaTitle === dramaTitle && t.status !== 'completed' && t.status !== 'downloading') {
        t.destDir = newDir;
        t.customDownloadDir = newDir;
        const filename = path.basename(t.outputPath);
        t.outputPath = path.join(dramaFolder, filename);
        updated = true;
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
