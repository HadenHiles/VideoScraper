const express = require('express');
const { chromium } = require('playwright');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const userAgents = require('./userAgents');

puppeteer.use(StealthPlugin());

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

const router = express.Router();

// POST /api/browser-backup { url, debug, proxy }
router.post('/browser-backup', async (req, res) => {
    const { url, debug, proxy } = req.body;
    const debugMode = debug === true || req.query.debug === 'true';
    if (!url) {
        console.log('[BrowserBackup] No URL provided');
        return res.status(400).json({ error: 'No URL provided' });
    }
    const isTikTok = /tiktok\.com\//i.test(url);
    let browser;
    const launchOptions = { headless: !debugMode };
    if (proxy) {
        launchOptions.proxy = { server: proxy };
        console.log('[BrowserBackup] Using proxy:', proxy);
    } else {
        console.log('[BrowserBackup] No proxy provided.');
    }
    if (isTikTok) {
        try {
            console.log('[BrowserBackup] [TikTok] Launching Playwright...');
            browser = await chromium.launch(launchOptions);
            const userAgent = getRandomUserAgent();
            const context = await browser.newContext({
                userAgent,
                viewport: { width: 1280, height: 800 },
                locale: 'en-US',
                timezoneId: 'America/New_York',
                extraHTTPHeaders: {
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.tiktok.com/',
                },
            });
            const page = await context.newPage();
            if (debugMode) {
                page.on('console', msg => console.log('[Playwright Console]', msg.text()));
                page.on('requestfailed', req => console.warn('[Playwright Request Failed]', req.url(), req.failure()));
                page.on('response', resp => {
                    if (!resp.ok()) console.warn('[Playwright Bad Response]', resp.url(), resp.status());
                });
                console.log('[Playwright] Using user-agent:', userAgent);
            }
            console.log('[Playwright] Navigating to:', url);
            let navSuccess = false;
            let navError = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    await Promise.race([
                        page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout (custom)')), 65000))
                    ]);
                    navSuccess = true;
                    break;
                } catch (err) {
                    navError = err;
                    console.warn(`[Playwright][TikTok] Navigation attempt ${attempt} failed:`, err.message);
                    if (attempt === 1) {
                        await page.waitForTimeout(2000);
                    }
                }
            }
            if (!navSuccess) {
                await browser.close();
                return res.status(504).json({ error: 'TikTok page navigation failed', details: navError?.message || 'Unknown error' });
            }
            if (debugMode) console.log('[Playwright] Page loaded:', url);
            await page.waitForTimeout(3000);
            // Try to extract from JSON blob
            let videos = [];
            try {
                if (debugMode) console.log('[Playwright] Waiting for TikTok JSON blob...');
                await Promise.race([
                    page.waitForSelector('script#\\__UNIVERSAL_DATA_FOR_REHYDRATION__', { timeout: 10000 }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Selector wait timeout')), 12000))
                ]);
                const json = await page.$eval('script#\\__UNIVERSAL_DATA_FOR_REHYDRATION__', el => el.textContent);
                if (json) {
                    if (debugMode) console.log('[Playwright] TikTok JSON blob found.');
                    const data = JSON.parse(json);
                    const video = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct?.video;
                    if (video) {
                        if (video.bitrateInfo && Array.isArray(video.bitrateInfo)) {
                            video.bitrateInfo.forEach(b => {
                                if (b.PlayAddr && b.PlayAddr.UrlList) {
                                    videos.push(...b.PlayAddr.UrlList);
                                }
                            });
                        }
                        if (video.playAddr) videos.push(video.playAddr);
                        if (video.downloadAddr) videos.push(video.downloadAddr);
                    }
                }
            } catch (jsonErr) {
                if (debugMode) console.warn('[Playwright][TikTok] JSON extraction failed:', jsonErr.message);
            }
            // If not found, use network interception
            if (!videos.length) {
                if (debugMode) console.log('[Playwright][TikTok] Falling back to network interception...');
                const found = new Set();
                await page.route('**/*', (route, request) => {
                    const url = request.url();
                    if (/tiktokcdn\.com\/video\//.test(url) && /mime_type=video_mp4/.test(url)) {
                        found.add(url);
                    }
                    route.continue();
                });
                // Simulate play if needed
                try {
                    if (debugMode) console.log('[Playwright] Attempting to click video to trigger playback...');
                    await page.click('video');
                } catch (e) { if (debugMode) console.warn('[Playwright] Video click failed:', e.message); }
                await page.waitForTimeout(3000);
                videos = Array.from(found);
            }
            await browser.close();
            if (debugMode) console.log('[BrowserBackup][TikTok] Returning videos:', videos);
            return res.json({ videos: Array.from(new Set(videos)), engine: 'playwright-tiktok' });
        } catch (err) {
            if (browser) await browser.close();
            console.warn('[Playwright TikTok Error]', err.message);
            // Fallback to Puppeteer (use generic logic)
        }
        // If TikTok Playwright fails, fallback to Puppeteer generic logic below
    }
    // Try Playwright first (generic, non-TikTok or TikTok fallback)
    try {
        console.log('[BrowserBackup] Launching Playwright...');
        browser = await chromium.launch({ headless: !debugMode });
        const userAgent = getRandomUserAgent();
        const context = await browser.newContext({
            userAgent,
            viewport: { width: 1280, height: 800 },
            locale: 'en-US',
        });
        const page = await context.newPage();
        if (debugMode) {
            page.on('console', msg => console.log('[Playwright Console]', msg.text()));
            page.on('requestfailed', req => console.warn('[Playwright Request Failed]', req.url(), req.failure()));
            page.on('response', resp => {
                if (!resp.ok()) console.warn('[Playwright Bad Response]', resp.url(), resp.status());
            });
            console.log('[Playwright] Using user-agent:', userAgent);
        }
        console.log('[Playwright] Navigating to:', url);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 });
        if (debugMode) console.log('[Playwright] Page loaded:', url);
        await page.waitForTimeout(5000);
        if (debugMode) console.log('[Playwright] Scraping video links...');
        const videos = await page.evaluate(() => {
            const found = [];
            document.querySelectorAll('video').forEach(video => {
                if (video.src) found.push(video.src);
                video.querySelectorAll('source').forEach(source => {
                    if (source.src) found.push(source.src);
                });
            });
            document.querySelectorAll('a').forEach(a => {
                if (a.href && /\.(mp4|webm|ogg)(\?.*)?$/i.test(a.href)) found.push(a.href);
            });
            return Array.from(new Set(found));
        });
        console.log('[Playwright] Found videos:', videos);
        await browser.close();
        console.log('[BrowserBackup] Playwright finished. Returning results.');
        return res.json({ videos, engine: 'playwright' });
    } catch (err) {
        if (browser) await browser.close();
        console.warn('[Playwright Backup Error]', err.message);
        // Fallback to Puppeteer
        try {
            console.log('[BrowserBackup] Launching Puppeteer fallback...');
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
            console.log('[Puppeteer] Navigating to:', url);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
            if (debugMode) console.log('[Puppeteer] Page loaded:', url);
            await page.waitForTimeout(5000);
            if (debugMode) console.log('[Puppeteer] Scraping video links...');
            const videos = await page.evaluate(() => {
                const found = [];
                document.querySelectorAll('video').forEach(video => {
                    if (video.src) found.push(video.src);
                    video.querySelectorAll('source').forEach(source => {
                        if (source.src) found.push(source.src);
                    });
                });
                document.querySelectorAll('a').forEach(a => {
                    if (a.href && /\.(mp4|webm|ogg)(\?.*)?$/i.test(a.href)) found.push(a.href);
                });
                return Array.from(new Set(found));
            });
            console.log('[Puppeteer] Found videos:', videos);
            await browser.close();
            console.log('[BrowserBackup] Puppeteer finished. Returning results.');
            return res.json({ videos, engine: 'puppeteer' });
        } catch (err2) {
            if (browser) await browser.close();
            console.error('[Puppeteer Backup Error]', err2);
            return res.status(500).json({ error: 'Both Playwright and Puppeteer backup failed', details: err2.message });
        }
    }
});

module.exports = router;
