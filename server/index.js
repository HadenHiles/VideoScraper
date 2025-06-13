const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { pipeline } = require('stream');
const { execFile, spawn } = require('child_process');
const fs = require('fs');

// --- Browser backup route (Playwright first, Puppeteer fallback) ---
const browserBackup = require('./browser-backup');

const app = express();
const PORT = process.env.PORT || 6969;

app.use(cors());
app.use(express.json());
app.use('/api', browserBackup);

// Serve frontend static files
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // Serve index.html for any non-API route
    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// Fetch video links from a given URL
app.post('/api/videos', async (req, res) => {
    const { url } = req.body;
    console.log('[API] /api/videos received url:', url);
    if (!url) {
        console.warn('[API] No URL provided in request body');
        return res.status(400).json({ error: 'No URL provided' });
    }
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const videoLinks = [];
        $('video source').each((_, el) => {
            const src = $(el).attr('src');
            if (src) videoLinks.push(new URL(src, url).href);
        });
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            if (href && /\.(mp4|webm|ogg)$/i.test(href)) {
                videoLinks.push(new URL(href, url).href);
            }
        });
        let uniqueLinks = Array.from(new Set(videoLinks));
        if (uniqueLinks.length === 0) {
            // Fallback to yt-dlp for complex sites using Python -m pip
            console.log(`[API] No direct video links found for ${url}, falling back to yt-dlp...`);
            execFile('yt-dlp', ['-j', url], { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
                if (err) {
                    console.error(`[yt-dlp] Error for ${url}:`, stderr || err.message);
                    return res.status(500).json({ error: 'yt-dlp failed', details: stderr || err.message });
                }
                try {
                    const info = JSON.parse(stdout);
                    let urls = [];
                    if (Array.isArray(info)) {
                        urls = info.map(i => i.url).filter(Boolean);
                    } else if (info.url) {
                        urls = [info.url];
                    } else if (info.formats) {
                        urls = info.formats.map(f => f.url).filter(Boolean);
                    }
                    if (urls.length === 0) {
                        console.warn(`[yt-dlp] No videos found for ${url}`);
                        return res.status(404).json({ error: 'No videos found (yt-dlp)' });
                    }
                    res.json({ videos: urls });
                } catch (e) {
                    console.error(`[yt-dlp] Failed to parse output for ${url}:`, e.message);
                    res.status(500).json({ error: 'Failed to parse yt-dlp output', details: e.message });
                }
            });
        } else {
            res.json({ videos: uniqueLinks });
        }
    } catch (err) {
        console.error(`[API] Failed to fetch videos for ${url}:`, err.message);
        res.status(500).json({ error: 'Failed to fetch videos', details: err.message });
    }
});

// Proxy and stream video file
app.get('/api/download', async (req, res) => {
    const { videoUrl, filename } = req.query;
    if (!videoUrl) return res.status(400).json({ error: 'No videoUrl provided' });
    // Use yt-dlp to download and merge video+audio, then stream to user
    try {
        let name = filename || path.basename((videoUrl.split('?')[0]));
        if (!/\.[a-zA-Z0-9]+$/.test(name)) {
            name += '.mp4';
        }
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        res.setHeader('Content-Type', 'video/mp4');
        // yt-dlp command: bestvideo+bestaudio, merge, output to stdout
        const ytdlp = spawn('yt-dlp', [
            '-f', 'bestvideo+bestaudio/best',
            '-o', '-', // output to stdout
            '--merge-output-format', 'mp4',
            decodeURIComponent(videoUrl)
        ]);
        ytdlp.stdout.pipe(res);
        ytdlp.stderr.on('data', (data) => {
            console.error(`[yt-dlp download]`, data.toString());
        });
        ytdlp.on('error', (err) => {
            console.error(`[yt-dlp spawn error]`, err);
            if (!res.headersSent) res.status(500).end('Error running yt-dlp');
        });
        ytdlp.on('close', (code) => {
            if (code !== 0) {
                console.error(`[yt-dlp] exited with code ${code}`);
                if (!res.headersSent) res.status(500).end('yt-dlp failed');
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to download video', details: err.message });
    }
});

// Enhance /api/proxy-backup to support GET and POST, and return raw text for HTML scraping
app.post('/api/proxy-backup', async (req, res) => {
    const { service, payload, method = 'POST' } = req.body;
    try {
        const axiosConfig = {
            method: payload.method || method,
            url: payload.url,
            headers: payload.headers || {},
            data: payload.body || undefined,
            responseType: 'text',
            maxRedirects: 5,
            validateStatus: () => true,
        };
        const response = await axios(axiosConfig);
        res.send(response.data);
    } catch (err) {
        console.error(`[Proxy Backup] Error for ${service}:`, err.message);
        res.status(500).json({ error: 'Proxy backup failed', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
