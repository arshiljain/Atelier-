const fs = require('fs');
const path = require('path');
const url = require('url');

let CHUNK_MAP = {};
try {
  const mapPath = path.join(process.cwd(), 'chunk_id_map.json');
  if (fs.existsSync(mapPath)) {
    CHUNK_MAP = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  }
} catch (e) {}

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
  if (ext === '.js') searchDirs = ['js', '_next/static/chunks', '_next/static/chunks/pages'];
  else if (ext === '.css') searchDirs = ['css', '_next/static/css'];
  else if (['.woff2', '.woff', '.otf', '.ttf'].includes(ext)) searchDirs = ['fonts', '_next/static/media'];
  else searchDirs = ['images', 'marketing-assets'];

  for (const dirName of searchDirs) {
    const dir = path.join(process.cwd(), dirName.replace(/\//g, path.sep));
    if (!fs.existsSync(dir)) continue;

    // 1. Exact match
    const exact = path.join(dir, filename);
    if (fs.existsSync(exact) && fs.statSync(exact).isFile()) return { file: exact, ext };

    // 2. Prefix match
    const files = fs.readdirSync(dir);
    const matched = files.find(f => {
      if (f.startsWith(baseName) && f.endsWith(ext)) return true;
      const prefix = baseName.split('.')[0];
      if (prefix.length > 2 && f.startsWith(prefix) && f.endsWith(ext)) return true;
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
  const reqPath = parsed.query && parsed.query.path ? parsed.query.path : parsed.pathname;
  const found = findFile(reqPath);

  if (found && fs.existsSync(found.file)) {
    const contentType = MIME_TYPES[found.ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(found.file).pipe(res);
    return;
  }

  // Graceful fallback for missing Next.js script chunks
  const cleanPath = reqPath.split('?')[0];
  if (cleanPath.endsWith('.js')) {
    const filename = path.basename(cleanPath);
    const baseName = filename.replace(/\.js$/, '');
    const prefix = baseName.split('.')[0];
    const chunkId = CHUNK_MAP[prefix] || CHUNK_MAP[baseName] || prefix;

    const ids = Array.from(new Set([
      chunkId,
      isNaN(Number(chunkId)) ? chunkId : Number(chunkId),
      prefix,
      baseName
    ])).filter(Boolean);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(`(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([${JSON.stringify(ids)},{}]);`);
    return;
  }

  res.statusCode = 404;
  res.end('Static asset not found: ' + reqPath);
};
