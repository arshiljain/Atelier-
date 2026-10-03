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
  const ext = path.parse(clean).ext.toLowerCase();

  const candidateBases = Array.from(new Set([
    path.parse(filename.split('?')[0]).name,
    path.parse(clean).name,
    path.parse(filename.replace(/%40/g, '_40').split('?')[0]).name,
    path.parse(filename.replace(/%40/g, '_').split('?')[0]).name,
    path.parse(filename.replace(/@/g, '_40').split('?')[0]).name,
    path.parse(filename.replace(/@/g, '_').split('?')[0]).name,
  ])).filter(Boolean);

  const searchDirs = ['images', 'marketing-assets', 'static_assets'];

  for (const d of searchDirs) {
    const dir = path.join(process.cwd(), d);
    if (!fs.existsSync(dir)) continue;

    // Direct match
    for (const b of candidateBases) {
      const direct = path.join(dir, b + ext);
      if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
    }

    // Fuzzy match against files in directory
    const files = fs.readdirSync(dir);
    const matched = files.find(f => {
      if (!f.endsWith(ext)) return false;
      for (const base of candidateBases) {
        if (f.startsWith(base)) return true;
        const prefix = base.split('_')[0];
        if (prefix.length > 4 && f.startsWith(prefix)) return true;
      }
      return false;
    });

    if (matched) return path.join(dir, matched);
  }

  // Recursive search in marketing-assets
  const marketingDir = path.join(process.cwd(), 'marketing-assets');
  if (fs.existsSync(marketingDir)) {
    for (const base of candidateBases) {
      const subMatch = findInDir(marketingDir, base, ext);
      if (subMatch) return subMatch;
    }
  }

  return null;
}

function findInDir(dir, base, ext) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        const found = findInDir(p, base, ext);
        if (found) return found;
      } else {
        if (f.endsWith(ext)) {
          if (f.startsWith(base)) return p;
          const prefix = base.split('_')[0];
          if (prefix.length > 4 && f.startsWith(prefix)) return p;
        }
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
