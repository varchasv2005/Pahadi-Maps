const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const dataPath = (name) => path.join(ROOT, 'data', `${name}.json`);
const readData = (name) => JSON.parse(fs.readFileSync(dataPath(name), 'utf8'));
const writeData = (name, value) => fs.writeFileSync(dataPath(name), `${JSON.stringify(value, null, 2)}\n`);

function send(res, status, value, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 12000) reject(new Error('Request is too large')); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Request body must be JSON')); } });
    req.on('error', reject);
  });
}
function validText(value, max) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, app: 'Pahadi Maps prototype' });
    if (req.method === 'GET' && url.pathname === '/api/data') return send(res, 200, { hazards: readData('hazards'), helpers: readData('helpers'), places: readData('places') });
    if (req.method === 'POST' && url.pathname === '/api/hazards') {
      const input = await body(req);
      const allowed = ['blind-curve', 'landslide', 'road-damage', 'poor-lighting', 'other'];
      if (!allowed.includes(input.type) || !validText(input.description, 110) || !validText(input.location, 60)) return send(res, 400, { error: 'Choose a hazard type and provide a short description and landmark.' });
      const hazards = readData('hazards');
      const hazard = { id: `h-${randomUUID().slice(0, 8)}`, type: input.type, title: ({ 'blind-curve': 'Blind curve reported', landslide: 'Landslide or debris reported', 'road-damage': 'Road damage reported', 'poor-lighting': 'Poor lighting reported', other: 'Road hazard reported' })[input.type], description: input.description.trim(), location: input.location.trim(), lat: Number.isFinite(input.lat) ? input.lat : 30.4591, lng: Number.isFinite(input.lng) ? input.lng : 78.0661, severity: 'Medium', reportedAt: new Date().toISOString(), status: 'active' };
      hazards.unshift(hazard); writeData('hazards', hazards);
      return send(res, 201, { hazard });
    }
    if (req.method === 'POST' && url.pathname === '/api/sos') {
      const input = await body(req);
      const allowed = ['Medical assistance', 'Vehicle breakdown', 'Roadside safety', 'Other emergency'];
      if (!allowed.includes(input.need)) return send(res, 400, { error: 'Select the kind of help you need.' });
      const alerts = fs.existsSync(dataPath('alerts')) ? readData('alerts') : [];
      const alert = { id: `sos-${randomUUID().slice(0, 8)}`, need: input.need, lat: Number.isFinite(input.lat) ? input.lat : 30.4591, lng: Number.isFinite(input.lng) ? input.lng : 78.0661, createdAt: new Date().toISOString(), status: 'sent', notifiedHelpers: readData('helpers').length };
      alerts.unshift(alert); writeData('alerts', alerts);
      return send(res, 201, { alert, message: `SOS shared with ${alert.notifiedHelpers} nearby prototype helpers.` });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/')) {
      let requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(ROOT, `.${requested}`);
      if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file).pipe(res);
    }
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return send(res, 400, { error: error.message || 'Could not process request' });
  }
});

server.listen(PORT, () => console.log(`Pahadi Maps is running at http://localhost:${PORT}`));
