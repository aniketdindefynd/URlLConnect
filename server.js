const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require("path");
const sqlite3 = require('sqlite3').verbose();
const serveStatic = require("serve-static");
const { readFileSync } = require('fs');
const { setupFdk } = require("@gofynd/fdk-extension-javascript/express");
const { SQLiteStorage } = require("@gofynd/fdk-extension-javascript/express/storage");
const sqliteInstance = new sqlite3.Database('session_storage.db');
const urlRouter = express.Router();
const proxyRouter = express.Router();
const cors = require('cors');

// Initialize URL storage table with migration support
sqliteInstance.serialize(() => {
    // First, create the table if it doesn't exist (for new installations)
    sqliteInstance.run(`
        CREATE TABLE IF NOT EXISTS url_storage (
            id INTEGER PRIMARY KEY,
            url TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create proxy storage table (simplified - no application_id needed)
    sqliteInstance.run(`
        CREATE TABLE IF NOT EXISTS proxy_storage (
            id INTEGER PRIMARY KEY,
            proxy_endpoint TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});


const fdkExtension = setupFdk({
    api_key: process.env.EXTENSION_API_KEY,
    api_secret: process.env.EXTENSION_API_SECRET,
    base_url: process.env.EXTENSION_BASE_URL,
    cluster: process.env.FP_API_DOMAIN,
    callbacks: {
        auth: async (req) => {
            // Write you code here to return initial launch url after auth process complete
            if (req.query.application_id) {
                return `${req.extension.base_url}/company/${req.query['company_id']}/application/${req.query.application_id}`;
            } else {
                // If accessed from company level, redirect with a message indicating sales channel access required
                return `${req.extension.base_url}/company/${req.query['company_id']}?redirect_message=sales_channel_required`;
            }
        },
        
        uninstall: async (req) => {
            // Write your code here to cleanup data related to extension
            // If task is time taking then process it async on other process.
        }
    },
    storage: new SQLiteStorage(sqliteInstance,"exapmple-fynd-platform-extension"), // add your prefix
    access_mode: "online",
    webhook_config: {
        api_path: "/api/webhook-events",
        notification_email: "useremail@example.com",
        event_map: {
            "company/product/delete": {
                "handler": (eventName) => {  console.log(eventName)},
                "version": '1'
            }
        }
    },
});

const STATIC_PATH = process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'frontend', 'public' , 'dist')
    : path.join(process.cwd(), 'frontend');
    
const app = express();
const platformApiRoutes = fdkExtension.platformApiRoutes;

// Middleware to parse cookies with a secret key
app.use(cookieParser("ext.session"));
app.use(cors());

// Middleware to parse JSON bodies with a size limit of 2mb
app.use(bodyParser.json({
    limit: '2mb'
}));

// Serve static files from the React dist directory
app.use(serveStatic(STATIC_PATH, { index: false }));

// FDK extension handler and API routes (extension launch routes)
app.use("/", fdkExtension.fdkHandler);

// Route to handle webhook events and process it.
app.post('/api/webhook-events', async function(req, res) {
    try {
      console.log(`Webhook Event: ${req.body.event} received`)
      await fdkExtension.webhookRegistry.processWebhook(req);
      return res.status(200).json({"success": true});
    } catch(err) {
      console.log(`Error Processing ${req.body.event} Webhook`);
      return res.status(500).json({"success": false});
    }
})

// Company level - return error message indicating application level required
urlRouter.get('/', async function(req, res, next) {
    try {
        return res.status(400).json({ 
            error: 'URL management is only available at the sales channel level. Please access this from a specific sales channel.' 
        });
    } catch (err) {
        next(err);
    }
});

// Application level - Get stored URL (single URL for all applications)
urlRouter.get('/application/:application_id', async function(req, res, next) {
    try {
        sqliteInstance.get(
            'SELECT url FROM url_storage WHERE id = 1', 
            (err, row) => {
                if (err) {
                    console.error('Error fetching URL:', err);
                    return res.status(500).json({ error: 'Failed to fetch URL' });
                }
                return res.json({ url: row ? row.url : '' });
            }
        );
    } catch (err) {
        next(err);
    }
});

// Company level - return error for POST requests
urlRouter.post('/', async function(req, res, next) {
    try {
        return res.status(400).json({ 
            error: 'URL management is only available at the sales channel level. Please access this from a specific sales channel.' 
        });
    } catch (err) {
        next(err);
    }
});

// Application level - Store/Update URL (single URL for all applications)
urlRouter.post('/application/:application_id', async function(req, res, next) {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Simple URL validation
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Insert or update the single URL entry
        sqliteInstance.run(
            `INSERT INTO url_storage (id, url, created_at, updated_at) 
             VALUES (1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(id) 
             DO UPDATE SET url = ?, updated_at = CURRENT_TIMESTAMP`,
            [url, url],
            function(err) {
                if (err) {
                    console.error('Error updating URL:', err);
                    return res.status(500).json({ error: 'Failed to update URL' });
                }
                return res.json({ 
                    success: true, 
                    message: 'URL updated successfully',
                    url: url
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

// Company level - return error for proxy requests  
proxyRouter.get('/', async function(req, res, next) {
    try {
        return res.status(400).json({ 
            error: 'Proxy management is only available at the sales channel level. Please access this from a specific sales channel.' 
        });
    } catch (err) {
        next(err);
    }
});

proxyRouter.post('/', async function(req, res, next) {
    try {
        return res.status(400).json({ 
            error: 'Proxy management is only available at the sales channel level. Please access this from a specific sales channel.' 
        });
    } catch (err) {
        next(err);
    }
});

proxyRouter.delete('/', async function(req, res, next) {
    try {
        return res.status(400).json({ 
            error: 'Proxy management is only available at the sales channel level. Please access this from a specific sales channel.' 
        });
    } catch (err) {
        next(err);
    }
});

// Application level - Check if proxy exists (single proxy for all applications)
proxyRouter.get('/application/:application_id', async function(req, res, next) {
    try {
        sqliteInstance.get(
            'SELECT * FROM proxy_storage WHERE id = 1', 
            (err, row) => {
                if (err) {
                    console.error('Error fetching proxy:', err);
                    return res.status(500).json({ error: 'Failed to fetch proxy status' });
                }
                return res.json({ 
                    exists: !!row,
                    proxy: row || null 
                });
            }
        );
    } catch (err) {
        next(err);
    }
});

// Application level - Create proxy (single proxy for all applications)
proxyRouter.post('/application/:application_id', async function(req, res, next) {
    try {
        const { application_id } = req.params;
        const { company_id } = req.query;
        const { platformClient } = req;

        if (!company_id) {
            return res.status(400).json({ error: 'Company ID is required' });
        }

        // Check if proxy already exists
        sqliteInstance.get(
            'SELECT * FROM proxy_storage WHERE id = 1', 
            async (err, row) => {
                if (err) {
                    console.error('Error checking existing proxy:', err);
                    return res.status(500).json({ error: 'Failed to check proxy status' });
                }

                if (row) {
                    return res.status(409).json({ 
                        error: 'Proxy already exists',
                        proxy: row
                    });
                }

                // Create proxy using Fynd Platform API
                try {
                    const extensionId = process.env.EXTENSION_API_KEY; // Using API key as extension ID
                    const attached_path = `urlconnect`;
                    const proxy_url = `${req.extension.base_url}/proxy`;

                    const proxyData = await platformClient.application(application_id).partner.addProxyPath({
                        extensionId,
                        body: {
                            attached_path,
                            proxy_url,
                        },
                    });

                    // Store proxy information in local database (single entry)
                    sqliteInstance.run(
                        `INSERT INTO proxy_storage (id, proxy_endpoint, is_active, created_at, updated_at) 
                         VALUES (1, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [attached_path],
                        function(err) {
                            if (err) {
                                console.error('Error storing proxy info:', err);
                                return res.status(500).json({ error: 'Failed to store proxy information' });
                            }
                            
                            return res.json({ 
                                success: true,
                                message: 'Proxy created successfully',
                                proxy: {
                                    attached_path,
                                    proxy_url,
                                    platform_response: proxyData
                                }
                            });
                        }
                    );

                } catch (platformError) {
                    console.error('Error creating proxy on platform:', platformError);
                    return res.status(500).json({ 
                        error: 'Failed to create proxy on platform',
                        details: platformError.message 
                    });
                }
            }
        );
    } catch (err) {
        next(err);
    }
});

// Application level - Remove proxy (single proxy for all applications)
proxyRouter.delete('/application/:application_id', async function(req, res, next) {
    try {
        const { application_id } = req.params;
        const { company_id } = req.query;
        const { platformClient } = req;

        if (!company_id) {
            return res.status(400).json({ error: 'Company ID is required' });
        }

        // Get existing proxy info
        sqliteInstance.get(
            'SELECT * FROM proxy_storage WHERE id = 1', 
            async (err, row) => {
                if (err) {
                    console.error('Error fetching proxy:', err);
                    return res.status(500).json({ error: 'Failed to fetch proxy information' });
                }

                if (!row) {
                    return res.status(404).json({ error: 'Proxy not found' });
                }

                // Remove proxy from Fynd Platform
                try {
                    const extensionId = process.env.EXTENSION_API_KEY;
                    
                    await platformClient.application(application_id).partner.removeProxyPath({
                        extensionId,
                        attachedPath: row.proxy_endpoint,
                    });

                    // Remove from local database
                    sqliteInstance.run(
                        'DELETE FROM proxy_storage WHERE id = 1',
                        function(err) {
                            if (err) {
                                console.error('Error removing proxy from database:', err);
                                return res.status(500).json({ error: 'Failed to remove proxy from database' });
                            }
                            
                            return res.json({ 
                                success: true,
                                message: 'Proxy removed successfully'
                            });
                        }
                    );

                } catch (platformError) {
                    console.error('Error removing proxy from platform:', platformError);
                    return res.status(500).json({ 
                        error: 'Failed to remove proxy from platform',
                        details: platformError.message 
                    });
                }
            }
        );
    } catch (err) {
        next(err);
    }
});

// FDK extension api route which has auth middleware and FDK client instance attached to it.
platformApiRoutes.use('/url', urlRouter);
platformApiRoutes.use('/proxy', proxyRouter);

// Proxy endpoint for bindings to access stored URL (single URL, no application_id needed)
app.get('/proxy', async (req, res) => {
    try {
        // Get the single stored URL (no application context needed)
        sqliteInstance.get(
            'SELECT url FROM url_storage WHERE id = 1', 
            (err, row) => {
                if (err) {
                    console.error('Proxy: Error fetching URL:', err);
                    return res.status(500).json({ error: 'Failed to fetch URL' });
                }
                
                if (!row || !row.url) {
                    return res.status(404).json({ 
                        error: 'No URL configured' 
                    });
                }

                // Return the stored URL - the binding can use this to redirect or fetch content
                return res.json({ 
                    url: row.url,
                    timestamp: new Date().toISOString()
                });
            }
        );
    } catch (error) {
        console.error('Proxy endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/proxy/frame', async (req, res) => {
    try {
      const raw = req.query.url || '';
      let target;
      try { target = new URL(raw); } catch { return res.status(400).send('Bad url'); }
  
      // keep your whitelist
    //   const ALLOWED_HOSTS = new Set(['asia-south1.workflow.boltic.app']);
    //   if (!ALLOWED_HOSTS.has(target.hostname)) return res.status(403).send('Host not allowed');
  
      // fetch without compression to simplify
      const upstream = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'user-agent': req.get('user-agent') || 'Mozilla/5.0',
          'accept': req.get('accept') || '*/*',
          'accept-language': req.get('accept-language') || 'en',
          'accept-encoding': 'identity', // <-- important
        },
      });
  
      // Pass status
      res.status(upstream.status);
  
      // Strip hop-by-hop or framing/blocking headers before copying
      const STRIP = new Set([
        'x-frame-options',
        'content-security-policy',
        'content-security-policy-report-only',
        'set-cookie',
        'content-length',
        'transfer-encoding',
        'content-encoding',
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade',
      ]);
  
      upstream.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (STRIP.has(k)) return;
        // You can also choose to whitelist instead of blacklist:
        // if (!['content-type','last-modified','etag','cache-control','expires','pragma','vary','location'].includes(k)) return;
        res.setHeader(key, value);
      });
  
      const ct = (upstream.headers.get('content-type') || '').toLowerCase();
  
      if (ct.includes('text/html')) {
        let html = await upstream.text();
  
        // Ensure <head> exists
        if (!/<head[^>]*>/i.test(html)) {
          html = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head></head>`);
        }
  
        // Inject <base> so relative URLs resolve against the target origin
        if (!/<base[^>]*href=/i.test(html)) {
          html = html.replace(/<head[^>]*>/i, (m) => `${m}\n<base href="${target.href}">`);
        }
  
        // Tighten / normalize our own response headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); // explicit, since we changed body
        return res.send(html);
      } else {
        // Non-HTML → just pass bytes. Don't set content-length; let Express handle it.
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (ct) res.setHeader('Content-Type', ct);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(buf);
      }
    } catch (e) {
      console.error('[frame proxy] error:', e);
      return res.status(502).send('Upstream fetch failed');
    }
  });

// If you are adding routes outside of the /api path, 
// remember to also add a proxy rule for them in /frontend/vite.config.js
app.use('/api', platformApiRoutes);

// Serve the React app for all other routes
app.get('*', (req, res) => {
    return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(path.join(STATIC_PATH, "index.html")));
});

module.exports = app;
