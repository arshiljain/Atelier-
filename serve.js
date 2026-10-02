const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_DIR = __dirname;
const CACHE_DIR = path.join(BASE_DIR, 'api_cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function findImageFile(filename) {
  const imagesDir = path.join(BASE_DIR, 'images');
  if (!fs.existsSync(imagesDir)) return null;

  const direct = path.join(imagesDir, filename);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return direct;
  }

  const cleanName = filename.replace(/%40/g, '_').split('?')[0];
  const baseWithoutExt = path.parse(cleanName).name;
  const ext = path.parse(cleanName).ext;

  const files = fs.readdirSync(imagesDir);
  const matched = files.find(f => {
    if (f === filename || f === cleanName) return true;
    if (f.startsWith(baseWithoutExt) && f.endsWith(ext)) return true;
    const prefix = baseWithoutExt.split('_')[0];
    if (prefix.length > 5 && f.startsWith(prefix) && f.endsWith(ext)) return true;
    return false;
  });

  if (matched) {
    return path.join(imagesDir, matched);
  }
  return null;
}

function resolveFilePath(reqUrl) {
  const parsed = url.parse(reqUrl, true);
  const reqPath = decodeURIComponent(parsed.pathname);

  // 1. Next.js image optimization proxy: /_next/image?url=...
  if (reqPath === '/_next/image' && parsed.query && parsed.query.url) {
    const rawTarget = parsed.query.url;
    const targetFilename = path.basename(url.parse(rawTarget).pathname);
    const foundImage = findImageFile(targetFilename);
    if (foundImage) return foundImage;
  }

  // 2. Video requests
  if (reqPath.includes('/video/upload/') || reqPath.startsWith('/videos/')) {
    let videoSub = reqPath;
    if (videoSub.includes('/video/upload/')) {
      videoSub = videoSub.substring(videoSub.indexOf('/video/upload/') + '/video/upload/'.length);
    } else if (videoSub.startsWith('/videos/')) {
      videoSub = videoSub.substring('/videos/'.length);
    }
    const directVideo = path.join(BASE_DIR, 'videos', videoSub.replace(/\//g, path.sep));
    if (fs.existsSync(directVideo) && fs.statSync(directVideo).isFile()) {
      return directVideo;
    }
  }

  // Normalize path
  const sanitizedPath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(BASE_DIR, sanitizedPath);

  if (!filePath.startsWith(BASE_DIR)) {
    return null;
  }

  if (reqPath === '/' || reqPath === '') {
    const indexPath = path.join(BASE_DIR, 'index.html');
    if (fs.existsSync(indexPath)) return indexPath;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }

  // Clean URLs: /blocks -> /blocks.html
  if (fs.existsSync(`${filePath}.html`) && fs.statSync(`${filePath}.html`).isFile()) {
    return `${filePath}.html`;
  }

  // Directory index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const dirIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(dirIndex)) return dirIndex;
  }

  // Fuzzy image matching
  if (reqPath.startsWith('/images/')) {
    const imgName = path.basename(reqPath);
    const foundImage = findImageFile(imgName);
    if (foundImage) return foundImage;
  }

  // Webpack chunks fallback
  if (reqPath.includes('/_next/static/chunks/')) {
    const filename = path.basename(reqPath);
    const directJs = path.join(BASE_DIR, 'js', filename);
    if (fs.existsSync(directJs)) return directJs;

    const baseNameWithoutExt = filename.replace(/\.js$/, '');
    const jsFiles = fs.readdirSync(path.join(BASE_DIR, 'js'));
    const matched = jsFiles.find(f => f.startsWith(baseNameWithoutExt));
    if (matched) return path.join(BASE_DIR, 'js', matched);
  }

  // CSS chunks fallback
  if (reqPath.includes('/_next/static/css/')) {
    const filename = path.basename(reqPath);
    const directCss = path.join(BASE_DIR, 'css', filename);
    if (fs.existsSync(directCss)) return directCss;

    const baseNameWithoutExt = filename.replace(/\.css$/, '');
    const cssFiles = fs.readdirSync(path.join(BASE_DIR, 'css'));
    const matched = cssFiles.find(f => f.startsWith(baseNameWithoutExt));
    if (matched) return path.join(BASE_DIR, 'css', matched);
  }

  // Media/font fallback
  if (reqPath.includes('/_next/static/media/')) {
    const filename = path.basename(reqPath);
    const fontsDir = path.join(BASE_DIR, 'fonts');
    if (fs.existsSync(fontsDir)) {
      const directFont = path.join(fontsDir, filename);
      if (fs.existsSync(directFont)) return directFont;

      const baseNameWithoutExt = filename.split('.')[0];
      const fontFiles = fs.readdirSync(fontsDir);
      const matched = fontFiles.find(f => f.startsWith(baseNameWithoutExt));
      if (matched) return path.join(fontsDir, matched);
    }
  }

  return null;
}

// Proxy API requests with disk caching for offline support
function proxyApiRequest(req, res) {
  const targetUrl = new URL(req.url, 'https://api.atelier.design');
  const opName = targetUrl.searchParams.get('op') || '';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Apollo-Require-Preflight',
      'Access-Control-Allow-Credentials': 'true',
    });
    res.end();
    return;
  }

  // Handle VideoFrameUrl and VideoClipUrl dynamically per request variables
  if (opName === 'VideoFrameUrl' || opName === 'VideoClipUrl') {
    let bodyChunks = [];
    req.on('data', chunk => bodyChunks.push(chunk));
    req.on('end', () => {
      const bodyStr = Buffer.concat(bodyChunks).toString('utf8');
      try {
        const parsed = JSON.parse(bodyStr);
        const isArray = Array.isArray(parsed);
        const items = isArray ? parsed : [parsed];

        let results;
        if (opName === 'VideoFrameUrl') {
          results = items.map(item => {
            const vars = item.variables || {};
            const url = vars.url || '';
            const match = url.match(/mux\.com\/([a-zA-Z0-9_-]+)/);
            let frameUrl = url;
            if (match) {
              const playbackId = match[1].replace('.m3u8', '');
              const w = vars.width || 800;
              const h = vars.height || 800;
              const t = vars.offsetSeconds !== undefined ? vars.offsetSeconds : 0;
              frameUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${t}&width=${w}&height=${h}&fit_mode=preserve`;
            }
            return { data: { videoFrameUrl: frameUrl } };
          });
        } else {
          results = items.map(item => {
            const vars = item.variables || {};
            return { data: { videoClipUrl: vars.url || '' } };
          });
        }

        const respData = JSON.stringify(isArray ? results : results[0]);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
        });
        res.end(respData);
        return;
      } catch(e) {
        // Fall back to proxy
      }
    });
    return;
  }

  const cacheFile = opName ? path.join(CACHE_DIR, `${opName}.json`) : null;

  // If we have a local rebranded cache file, serve it directly
  if (cacheFile && fs.existsSync(cacheFile)) {
    let cachedData = fs.readFileSync(cacheFile);
    if (cachedData.length > 2 && cachedData[0] === 0x1f && cachedData[1] === 0x8b) {
      try { cachedData = require('zlib').gunzipSync(cachedData); } catch(e) {}
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });
    res.end(cachedData);
    return;
  }

  // Collect request body
  let bodyChunks = [];
  req.on('data', chunk => bodyChunks.push(chunk));
  req.on('end', () => {
    const bodyBuffer = Buffer.concat(bodyChunks);

    const options = {
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.hostname,
        origin: 'https://www.atelier.design',
        referer: 'https://www.atelier.design/',
      },
      timeout: 5000
    };

    const proxyReq = https.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      headers['access-control-allow-origin'] = req.headers.origin || '*';
      headers['access-control-allow-credentials'] = 'true';

      let respChunks = [];
      proxyRes.on('data', chunk => respChunks.push(chunk));
      proxyRes.on('end', () => {
        let respBuffer = Buffer.concat(respChunks);
        try {
          let text = respBuffer.toString('utf8');
          text = text.replaceAll('Atelier Studio', 'Atelier Studio');
          text = text.replaceAll('Atelier Blocks', 'Atelier Blocks');
          text = text.replaceAll('"slug":"atelier"', '"slug":"atelier"');
          text = text.replaceAll('"workspaceSlug":"atelier"', '"workspaceSlug":"atelier"');
          respBuffer = Buffer.from(text, 'utf8');
          headers['content-length'] = Buffer.byteLength(respBuffer);
        } catch(e) {}

        if (proxyRes.statusCode === 200 && cacheFile && respBuffer.length > 0 && opName !== 'VideoClipUrl' && opName !== 'VideoFrameUrl') {
          fs.writeFile(cacheFile, respBuffer, () => {});
        }
        res.writeHead(proxyRes.statusCode, headers);
        res.end(respBuffer);
      });
    });

    proxyReq.on('error', (err) => {
      console.warn(`API live request failed (${req.url}): ${err.message}. Checking offline cache...`);
      if (cacheFile && fs.existsSync(cacheFile)) {
        console.log(`Serving ${opName} from offline disk cache`);
        const cachedData = fs.readFileSync(cacheFile);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
        });
        res.end(cachedData);
        return;
      }
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Gateway Error', details: err.message }));
    });

    proxyReq.write(bodyBuffer);
    proxyReq.end();
  });
}

const server = http.createServer((req, res) => {
  const reqUrl = req.url;

  if (reqUrl.startsWith('/api/')) {
    proxyApiRequest(req, res);
    return;
  }

  const resolvedPath = resolveFilePath(reqUrl);

  if (!resolvedPath) {
    const pathname = url.parse(reqUrl).pathname;
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><title>404 Not Found</title><style>body{font-family:sans-serif;text-align:center;padding:50px;background:#0F0F0F;color:#FAFAFA;}a{color:#4DC5E5;}</style></head><body><h1>404 Not Found</h1><p>The requested path <code>${pathname}</code> was not found.</p><p><a href="/">Return to Homepage</a></p></body></html>`);
    return;
  }

  try {
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(resolvedPath);

    // Support range requests for video/audio playback
    const range = req.headers.range;
    if (range && (ext === '.mp4' || ext === '.webm' || ext === '.mp3')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(resolvedPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      file.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });

    fs.createReadStream(resolvedPath).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Internal Server Error: ${err.message}`);
  }
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`  Atelier UI static site server is live!`);
    console.log(`  URL: http://localhost:${port}`);
    console.log(`======================================================`);
    console.log(`\nQuick Navigation:`);
    console.log(`  - Home:       http://localhost:${port}/`);
    console.log(`  - Blocks:     http://localhost:${port}/blocks`);
    console.log(`  - Product:    http://localhost:${port}/product`);
    console.log(`  - Pricing:    http://localhost:${port}/pricing`);
    console.log(`  - Explore:    http://localhost:${port}/explore`);
    console.log(`  - Templates:  http://localhost:${port}/templates`);
    console.log(`  - Docs:       http://localhost:${port}/docs`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
