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
    const port = options.port || 3000; // default port if not provided
    const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/clear-cache',
        method: 'POST'
    }, (res) => {
        res.on('data', (chunk) => process.stdout.write(chunk));
        res.on('end', () => process.exit(0));  
    });
    req.on('error', (err) => {
        console.error('Error clearing cache:', err);
        process.exit(1);
    });
    req.end();
} 


const originURL = options.origin;


//create Server
const server = http.createServer((req, res) => {
    const requestURL = req.url;
    const cacheKey = `${req.method}:${requestURL}`;
    if (req.method === 'POST' && requestURL === '/clear-cache') {
        if(cache.size > 0) {
            console.log('Clearing cache as per request');
            cache.clear();
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Cache cleared');
            return;
        }   else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Cache is already empty');
            return;
        }
    }

    if(cache.has(cacheKey)) {
        const cachedResponse = cache.get(cacheKey);
        res.writeHead(cachedResponse.statusCode, {
            ...cachedResponse.headers,
            'X-Cache': 'HIT'
        });
        res.end(cachedResponse.body);
        return;
    }

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
    if(originURL && options.port) {
    console.log(`Caching proxy server running on port ${options.port}, forwarding to ${originURL}`);
    }
});


// Handle server errors
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  process.exit(1);
});
