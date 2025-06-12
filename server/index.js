const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { pipeline } = require('stream');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Fetch video links from a given URL
app.post('/api/videos', async (req, res) => {
    const { url } = req.body;
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
            execFile('python', ['-m', 'yt_dlp', '-j', url], { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
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
    try {
        const response = await axios({
            url: videoUrl,
            method: 'GET',
            responseType: 'stream',
        });
        // Determine filename
        let name = filename || path.basename(videoUrl.split('?')[0]);
        // Try to get extension from content-type if not present
        if (!/\.[a-zA-Z0-9]+$/.test(name) && response.headers['content-type']) {
            const ext = response.headers['content-type'].split('/')[1].split(';')[0];
            name += `.${ext}`;
        }
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        pipeline(response.data, res, (err) => {
            if (err) {
                res.status(500).end('Error streaming video');
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to download video', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
