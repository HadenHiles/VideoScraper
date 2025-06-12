const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const router = express.Router();

// POST /api/puppeteer-backup { url }
router.post('/puppeteer-backup', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800',
            ],
            defaultViewport: { width: 1280, height: 800 },
        });
        const page = await browser.newPage();
        // Set a realistic user-agent
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
        });
        // Optionally, set cookies or other headers here if needed
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
        // Wait for videos to appear (if any)
        await page.waitForTimeout(5000);
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
        res.json({ videos });
    } catch (err) {
        console.error('[Puppeteer Backup Error]', err);
        res.status(500).json({ error: 'Puppeteer backup failed', details: err.message });
    } finally {
        if (browser) await browser.close();
    }
});

module.exports = router;
