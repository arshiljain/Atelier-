const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME_TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json'
};

function findFile(reqPath) {
  const cleanPath = reqPath.split('?')[0];
  const filename = path.basename(cleanPath);
  const ext = path.extname(filename).toLowerCase();
  const baseName = filename.replace(ext, '');

  let searchDirs = [];
  if (ext === '.js') searchDirs = ['js'];
  else if (ext === '.css') searchDirs = ['css'];
  else if (['.woff2', '.woff', '.otf', '.ttf'].includes(ext)) searchDirs = ['fonts'];
  else searchDirs = ['images', 'marketing-assets'];

  for (const dirName of searchDirs) {
    const dir = path.join(process.cwd(), dirName);
    if (!fs.existsSync(dir)) continue;

    // 1. Exact match
    const exact = path.join(dir, filename);
    if (fs.existsSync(exact) && fs.statSync(exact).isFile()) return { file: exact, ext };

    // 2. Prefix match
    const files = fs.readdirSync(dir);
    const matched = files.find(f => {
      if (f.startsWith(baseName) && f.endsWith(ext)) return true;
      const prefix = baseName.split('.')[0];
      if (prefix.length > 3 && f.startsWith(prefix) && f.endsWith(ext)) return true;
      return false;
    });

    if (matched) {
      return { file: path.join(dir, matched), ext };
    }
  }

  return null;
}

module.exports = (req, res) => {
  const parsed = url.parse(req.url, true);
  const found = findFile(parsed.pathname);

  if (found && fs.existsSync(found.file)) {
    const contentType = MIME_TYPES[found.ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(found.file).pipe(res);
    return;
  }

  res.statusCode = 404;
  res.end('Static asset not found: ' + parsed.pathname);
};
