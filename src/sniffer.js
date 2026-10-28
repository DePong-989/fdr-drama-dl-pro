const { BrowserWindow } = require('electron');

class VideoSniffer {
  constructor() {}

  async sniff(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') {
      return { success: false, error: 'Invalid URL provided' };
    }

    const cleanUrl = targetUrl.trim();

    // 1. Quick check: Is it already a direct media stream?
    if (cleanUrl.includes('.m3u8') || cleanUrl.includes('.mp4')) {
      const urlObj = new URL(cleanUrl);
      const filename = urlObj.pathname.split('/').pop() || 'Video_Stream';
      return {
        success: true,
        title: decodeURIComponent(filename.replace(/\.(m3u8|mp4).*$/i, '')),
        videoUrl: cleanUrl,
        type: cleanUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        cover: ''
      };
    }

    // 2. Offscreen browser sniffer for Hongguo and web platforms
    return new Promise((resolve) => {
      let resolved = false;
      let detectedMedia = [];
      let pageTitle = 'Hongguo Drama Video';
      let pageCover = '';

      const win = new BrowserWindow({
        width: 1280,
        height: 720,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
          images: true
        }
      });

      win.webContents.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        try {
          if (!win.isDestroyed()) {
            win.destroy();
          }
        } catch (e) {}
        resolve(result);
      };

      const timer = setTimeout(() => {
        if (detectedMedia.length > 0) {
          finish({
            success: true,
            title: pageTitle,
            cover: pageCover,
            videoUrl: detectedMedia[0].url,
            type: detectedMedia[0].type
          });
        } else {
          finish({
            success: false,
            error: 'No media stream detected within timeout. Try copying the direct m3u8 or mp4 link.'
          });
        }
      }, 12000);

      // Listen for network video streams
      const filter = { urls: ['*://*/*'] };
      win.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
        const u = details.url;
        const lower = u.toLowerCase();

        const isM3u8 = lower.includes('.m3u8');
        const isMp4 = lower.includes('.mp4') && !lower.includes('.html');
        const isByteDanceVideo = (lower.includes('zjcdn') || lower.includes('snssdk') || lower.includes('bytevcloud')) && (lower.includes('video') || lower.includes('.ts'));

        if (isM3u8 || isMp4 || isByteDanceVideo) {
          detectedMedia.push({
            url: u,
            type: isM3u8 ? 'm3u8' : 'mp4'
          });

          // If we found an m3u8 or mp4, we can resolve as soon as title is ready
          setTimeout(async () => {
            if (!win.isDestroyed()) {
              try {
                const title = await win.webContents.executeJavaScript('document.title');
                if (title) pageTitle = title.trim();
              } catch (e) {}
            }
            finish({
              success: true,
              title: pageTitle,
              cover: pageCover,
              videoUrl: u,
              type: isM3u8 ? 'm3u8' : 'mp4'
            });
          }, 1500);
        }

        callback({});
      });

      win.webContents.on('did-finish-load', async () => {
        try {
          const info = await win.webContents.executeJavaScript(`
            (() => {
              const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
              const ogImg = document.querySelector('meta[property="og:image"]')?.content;
              const video = document.querySelector('video');
              const videoSrc = video?.src || video?.querySelector('source')?.src || '';
              return {
                title: ogTitle || document.title || '',
                cover: ogImg || '',
                videoSrc
              };
            })()
          `);

          if (info.title) pageTitle = info.title;
          if (info.cover) pageCover = info.cover;

          if (info.videoSrc && (info.videoSrc.startsWith('http://') || info.videoSrc.startsWith('https://'))) {
            finish({
              success: true,
              title: pageTitle,
              cover: pageCover,
              videoUrl: info.videoSrc,
              type: info.videoSrc.includes('.m3u8') ? 'm3u8' : 'mp4'
            });
          }
        } catch (e) {}
      });

      win.loadURL(cleanUrl).catch((err) => {
        finish({ success: false, error: `Failed to load page: ${err.message}` });
      });
    });
  }
}

module.exports = VideoSniffer;
