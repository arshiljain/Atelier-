const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function findImage(filename) {
  const imagesDir = path.join(process.cwd(), 'images');
  if (!fs.existsSync(imagesDir)) return null;

  const direct = path.join(imagesDir, filename);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

  const clean = filename.replace(/%40/g, '_').split('?')[0];
  const base = path.parse(clean).name;
  const ext = path.parse(clean).ext;

  const files = fs.readdirSync(imagesDir);
  const matched = files.find(f => {
    if (f === filename || f === clean) return true;
    if (f.startsWith(base) && f.endsWith(ext)) return true;
    const prefix = base.split('_')[0];
    if (prefix.length > 5 && f.startsWith(prefix) && f.endsWith(ext)) return true;
    return false;
  });

  if (matched) return path.join(imagesDir, matched);
  return null;
}

module.exports = (req, res) => {
  const parsed = url.parse(req.url, true);
  const rawTarget = parsed.query && parsed.query.url ? parsed.query.url : '';
  if (!rawTarget) {
    res.statusCode = 400;
    res.end('Missing url parameter');
    return;
  }

  const targetFilename = path.basename(url.parse(rawTarget).pathname);
  const found = findImage(targetFilename);

  if (found && fs.existsSync(found)) {
    const ext = path.extname(found).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(found).pipe(res);
    return;
  }

  // Redirect to original URL if external
  if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
    res.writeHead(302, { Location: rawTarget });
    res.end();
    return;
  }

  res.statusCode = 404;
  res.end('Image not found');
};
