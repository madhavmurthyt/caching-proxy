#! /usr/bin/env node 


import http from 'http';
import { program } from 'commander';
import { URL } from 'url';

const cache = new Map();

program
.option('-p, --port <port>', 'Port to run the proxy server on ', parseInt)
.option('--origin <url>', 'Origin server URL')
.option('--clear-cache', 'Clear cache and exit')
.parse(process.argv);

const options = program.opts();

if(options.clearCache) {
    cache.clear();
    console.log('Cache cleared');
    process.exit(0);
    } 

if(!options.port || !options.origin) {
    console.error('Port and Origin URL are required unless --clear-cache is specified');
    process.help();
    process.exit(1);
}

const originURL = options.origin;


//create Server
const server = http.createServer((req, res) => {
    const requestURL = req.url;
    const cacheKey = `${req.method}:${requestURL}`;
    
    if(cache.has(cacheKey)) {
        const cachedResponse = cache.get(cacheKey);
        res.writeHead(cachedResponse.statusCode, {
            ...cachedResponse.headers,
            'X-Cache': 'HIT'
        });
        res.end(cachedResponse.body);
        return;
    }
console.log(`cacheKey ${cacheKey}`);
console.log(`Forwarding request to ${originURL}${requestURL}`);
  const targetURL = new URL(requestURL, originURL);
  console.log(`Target URL: ${targetURL}`);
  const proxyReqOptions = {
    hostname: targetURL.hostname,
    port: targetURL.port || 80 || (targetURL.protocol === 'https:' ? 443 : 80),
    path: targetURL.path + (targetURL.search || ''),
    method: req.method,
    headers: req.headers
  }

  const proxyReq = http.request(proxyReqOptions, (proxyRes) => {
    let body = [];
    proxyRes.on('data', (chunk) => {
        console.log(`Received chunk: ${chunk}`);
        body.push(chunk);
    });
    
    proxyRes.on('end', () => {
        body = Buffer.concat(body);
        cache.set(cacheKey, {
            statusCode: proxyRes.statusCode,
            headers: proxyRes.headers,
            body: body
        });

        res.writeHead(proxyRes.statusCode, {
            ...proxyRes.headers,
            'X-Cache': 'MISS'
        });

        res.end(body);
    });
});

    proxyReq.on('error', (err) => {
        console.error('Error with proxy request:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
    });
    req.pipe(proxyReq);
});

server.listen(options.port, () => {
    console.log(`Caching proxy server running on port ${options.port}, forwarding to ${originURL}`);
});


// Handle server errors
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  process.exit(1);
});
