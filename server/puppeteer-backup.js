const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const userAgents = require('./userAgents');

puppeteer.use(StealthPlugin());

const router = express.Router();

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// POST /api/puppeteer-backup { url }
router.post('/puppeteer-backup', async (req, res) => {
    const { url, debug } = req.body;
    const debugMode = debug === true || req.query.debug === 'true';
    if (!url) return res.status(400).json({ error: 'No URL provided' });
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: !debugMode,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800',
            ],
            defaultViewport: { width: 1280, height: 800 },
        });
        const page = await browser.newPage();
        // Rotate user-agent
        const userAgent = getRandomUserAgent();
        await page.setUserAgent(userAgent);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
        });
        if (debugMode) {
            page.on('console', msg => console.log('[Puppeteer Console]', msg.text()));
            page.on('requestfailed', req => console.warn('[Puppeteer Request Failed]', req.url(), req.failure()));
            page.on('response', resp => {
                if (!resp.ok()) console.warn('[Puppeteer Bad Response]', resp.url(), resp.status());
            });
            console.log('[Puppeteer] Using user-agent:', userAgent);
        }
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
        if (debugMode) console.log('[Puppeteer] Page loaded:', url);
        await page.waitForTimeout(5000);
        if (debugMode) console.log('[Puppeteer] Scraping video links...');
        // Scrape all video sources and downloadable links
        const videos = await page.evaluate(() => {
            const found = [];
            // <video> tags
            document.querySelectorAll('video').forEach(video => {
                if (video.src) found.push(video.src);
                video.querySelectorAll('source').forEach(source => {
                    if (source.src) found.push(source.src);
                });
            });
            // <a> tags with video extensions
            document.querySelectorAll('a').forEach(a => {
                if (a.href && /\.(mp4|webm|ogg)(\?.*)?$/i.test(a.href)) found.push(a.href);
            });
            return Array.from(new Set(found));
        });
        if (debugMode) console.log('[Puppeteer] Found videos:', videos);
        res.json({ videos });
    } catch (err) {
        console.error('[Puppeteer Backup Error]', err);
        res.status(500).json({ error: 'Puppeteer backup failed', details: err.message });
    } finally {
        if (browser) await browser.close();
    }
});

module.exports = router;
