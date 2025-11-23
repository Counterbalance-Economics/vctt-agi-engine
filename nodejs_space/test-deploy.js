// Minimal test to see if service starts on Render
const http = require('http');
const port = process.env.PORT || 3000;

console.log('Starting minimal test server...');
console.log('PORT:', port);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('XAI_API_KEY exists:', !!process.env.XAI_API_KEY);
console.log('ABACUSAI_API_KEY exists:', !!process.env.ABACUSAI_API_KEY);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'healthy', port, env: process.env.NODE_ENV}));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Test server listening on 0.0.0.0:${port}`);
});
