const fs = require('fs');
const path = require('path');
const url = require('url');

const CACHE_DIR = path.join(process.cwd(), 'api_cache');

function getCachedData(opName) {
  if (!opName) return null;
  const direct = path.join(CACHE_DIR, `${opName}.json`);
  if (fs.existsSync(direct)) {
    try {
      return JSON.parse(fs.readFileSync(direct, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

module.exports = (req, res) => {
  const parsed = url.parse(req.url, true);
  let opName = parsed.query && parsed.query.op ? parsed.query.op : '';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Apollo-Require-Preflight');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let bodyChunks = [];
  req.on('data', chunk => bodyChunks.push(chunk));
  req.on('end', () => {
    let parsedBody = null;
    try {
      const bodyStr = Buffer.concat(bodyChunks).toString('utf8');
      if (bodyStr) parsedBody = JSON.parse(bodyStr);
    } catch (e) {}

    if (!opName && parsedBody) {
      if (Array.isArray(parsedBody) && parsedBody.length > 0) {
        opName = parsedBody[0].operationName || '';
      } else if (parsedBody.operationName) {
        opName = parsedBody.operationName;
      }
    }

    // VideoFrameUrl / VideoClipUrl
    if (opName === 'VideoFrameUrl' || opName === 'VideoClipUrl') {
      const items = Array.isArray(parsedBody) ? parsedBody : [parsedBody || {}];
      let results;
      if (opName === 'VideoFrameUrl') {
        results = items.map(item => {
          const vars = (item && item.variables) || {};
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
          const vars = (item && item.variables) || {};
          return { data: { videoClipUrl: vars.url || '' } };
        });
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(Array.isArray(parsedBody) ? results : results[0]));
      return;
    }

    if (opName === 'GenerateVeltToken') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ data: { generateVeltToken: 'atelier_demo_token' } }));
      return;
    }

    if (opName === 'CheckFeatureFlag') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ data: { checkFeatureFlag: false } }));
      return;
    }

    const cached = getCachedData(opName);
    if (cached) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(cached));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ data: {} }));
  });
};
