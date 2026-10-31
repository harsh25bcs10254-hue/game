const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml' };
const server = http.createServer((req,res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  const requested = raw === '/' ? '/index.html' : raw;
  const file = path.resolve(root, '.' + requested);
  if (!file.startsWith(root + path.sep) && file !== path.join(root,'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err,data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(data);
  });
});
const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => console.log(`The Shadow Architect is running at http://127.0.0.1:${port}`));
