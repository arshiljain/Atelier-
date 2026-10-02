const fs = require('fs');
const path = require('path');
const url = require('url');

const CACHE_DIR = path.join(process.cwd(), 'api_cache');

module.exports = (req, res) => {
  const parsed = url.parse(req.url, true);
  const opName = parsed.query && parsed.query.op ? parsed.query.op : '';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Apollo-Require-Preflight');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Handle VideoFrameUrl and VideoClipUrl
  if (opName === 'VideoFrameUrl' || opName === 'VideoClipUrl') {
    let bodyChunks = [];
    req.on('data', chunk => bodyChunks.push(chunk));
    req.on('end', () => {
      try {
        const bodyStr = Buffer.concat(bodyChunks).toString('utf8');
        const parsedBody = bodyStr ? JSON.parse(bodyStr) : {};
        const isArray = Array.isArray(parsedBody);
        const items = isArray ? parsedBody : [parsedBody];

        let results;
        if (opName === 'VideoFrameUrl') {
          results = items.map(item => {
            const vars = item.variables || {};
            const itemUrl = vars.url || '';
            const match = itemUrl.match(/mux\.com\/([a-zA-Z0-9_-]+)/);
            let frameUrl = itemUrl;
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

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(isArray ? results : results[0]));
        return;
      } catch (e) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ data: null }));
        return;
      }
    });
    return;
  }

  const cacheFile = opName ? path.join(CACHE_DIR, `${opName}.json`) : null;

  if (cacheFile && fs.existsSync(cacheFile)) {
    const cachedData = fs.readFileSync(cacheFile, 'utf8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(cachedData);
    return;
  }

  // Fallback default
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ data: {} }));
};
