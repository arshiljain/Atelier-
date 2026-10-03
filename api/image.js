const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function findImageFile(filename) {
  const clean = filename.replace(/%40/g, '_').replace(/@/g, '_').split('?')[0];
  const base = path.parse(clean).name;
  const ext = path.parse(clean).ext.toLowerCase();

  // Search dirs
  const searchDirs = ['images', 'marketing-assets', 'static_assets'];

  for (const d of searchDirs) {
    const dir = path.join(process.cwd(), d);
    if (!fs.existsSync(dir)) continue;

    // Direct match
    const direct = path.join(dir, filename);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

    const directClean = path.join(dir, clean);
    if (fs.existsSync(directClean) && fs.statSync(directClean).isFile()) return directClean;

    // Fuzzy scan
    const files = fs.readdirSync(dir);
    const matched = files.find(f => {
      if (f === filename || f === clean) return true;
      if (f.startsWith(base) && f.endsWith(ext)) return true;
      const prefix = base.split('_')[0];
      if (prefix.length > 4 && f.startsWith(prefix) && f.endsWith(ext)) return true;
      return false;
    });

    if (matched) return path.join(dir, matched);
  }

  // Recursive search in marketing-assets
  const marketingDir = path.join(process.cwd(), 'marketing-assets');
  if (fs.existsSync(marketingDir)) {
    const subMatch = findInDir(marketingDir, base, ext, clean);
    if (subMatch) return subMatch;
  }

  return null;
}

function findInDir(dir, base, ext, clean) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        const found = findInDir(p, base, ext, clean);
        if (found) return found;
      } else {
        if (f === clean) return p;
        if (f.startsWith(base) && f.endsWith(ext)) return p;
        const prefix = base.split('_')[0];
        if (prefix.length > 4 && f.startsWith(prefix) && f.endsWith(ext)) return p;
      }
    }
  } catch (e) {}
  return null;
}

module.exports = (req, res) => {
  const parsed = url.parse(req.url, true);
  let rawTarget = parsed.query && parsed.query.url ? parsed.query.url : '';
  
  if (!rawTarget) {
    rawTarget = parsed.pathname;
  }

  const cleanTarget = rawTarget.split('?')[0];
  const targetFilename = path.basename(cleanTarget);
  const found = findImageFile(targetFilename);

  if (found && fs.existsSync(found)) {
    const ext = path.extname(found).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(found).pipe(res);
    return;
  }

  // Fallback: proxy from Prismic if it was a prismic image
  const prismicName = targetFilename.replace(/_40/g, '%40');
  const fallbackUrl = `https://images.prismic.io/butter/${prismicName}`;
  
  https.get(fallbackUrl, upstreamRes => {
    if (upstreamRes.statusCode === 200) {
      res.statusCode = 200;
      res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      upstreamRes.pipe(res);
    } else {
      res.statusCode = 404;
      res.end('Image not found: ' + targetFilename);
    }
  }).on('error', () => {
    res.statusCode = 404;
    res.end('Image error: ' + targetFilename);
  });
};
