import React, { useState, useEffect } from 'react';

const API_BASE='http://localhost:4000/api';
const SNAPINSTA_API = 'https://snapinsta.to/api/ajaxSearch';

// Helper to guess filename from URL
const getFilename=(videoUrl: string)=> {
  try {
    const urlObj=new URL(videoUrl);
    const pathname=urlObj.pathname.split('/').filter(Boolean);
    let name=pathname[pathname.length - 1] || 'video';

    if ( !/\.[a-zA-Z0-9]+$/.test(name)) {
      // fallback to .mp4 if no extension
      name+='.mp4';
    }

    return name;
  }

  catch {
    return 'video.mp4';
  }
}

// Remove duplicate videos by file name, file size, and video duration (using loaded metadata)
async function dedupeVideosWithMeta(videos: string[]): Promise<string[]> {
  const metaList = await Promise.all(videos.map((v) => {
    return new Promise<{url: string, size?: number, duration?: number, playable: boolean}>(resolve => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = v;
      video.onloadedmetadata = () => {
        resolve({ url: v, duration: Math.round(video.duration), playable: !!video.duration && !isNaN(video.duration) });
      };
      video.onerror = () => resolve({ url: v, playable: false });
    });
  }));
  const lastMap = new Map<string, string>();
  for (const meta of metaList) {
    const sizeMatch = meta.url.match(/[?&]size=(\d+)/);
    const size = sizeMatch ? sizeMatch[1] : '';
    const key = `${size}|${meta.duration || ''}`;
    if (meta.playable) {
      lastMap.set(key, meta.url);
    }
  }
  return Array.from(lastMap.values());
}

// Remove duplicate videos by file name, file size, and video duration (if available)
function dedupeVideos(videos: string[]): string[] {
  const seen = new Map<string, string>();
  // Helper to get video metadata (size, duration)
  async function getVideoMeta(url: string): Promise<{size?: string, duration?: number}> {
    return new Promise(resolve => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration
        });
      };
      video.onerror = () => resolve({});
    });
  }
  // This function is now async, but for simplicity, we'll dedupe by file name and size from URL, and duration if available in URL (e.g., as a query param)
  return videos.filter((v) => {
    const name = getFilename(v);
    // Try to extract file size from query string if present
    const sizeMatch = v.match(/[?&]size=(\d+)/);
    const size = sizeMatch ? sizeMatch[1] : '';
    // Try to extract duration from query string if present
    const durationMatch = v.match(/[?&](duration|length)=(\d+)/);
    const duration = durationMatch ? durationMatch[2] : '';
    const key = name + '|' + size + '|' + duration;
    if (seen.has(key)) return false;
    seen.set(key, v);
    return true;
  });
}

// Helper to get video aspect ratio
function getAspectRatio(width: number, height: number) {
  if (!width || !height) return 1;
  return width / height;
}

// Helper to proxy backup requests through backend
async function proxyBackupRequest(service: string, payload: any, method: 'POST' | 'GET' = 'POST') {
  const res = await fetch(`${API_BASE}/proxy-backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, payload, method }),
  });
  if (!res.ok) throw new Error('Proxy request failed');
  const data = await res.json();
  return data;
}

async function fetchFromSnapInsta(url: string): Promise<string[]> {
  try {
    const payload = {
      url: 'https://snapinsta.to/api/ajaxSearch',
      body: `q=${encodeURIComponent(url)}&t=media`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      }
    };
    const data = await proxyBackupRequest('snapinsta', payload);
    const html = data.data || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a[href$=".mp4"],a[href$=".webm"],a[href$=".ogg"]'));
    return links.map(a => (a as HTMLAnchorElement).href);
  } catch {
    return [];
  }
}

async function fetchFromTikTok(url: string): Promise<string[]> {
  try {
    const payload = {
      url: 'https://ssstik.io/abc',
      body: `id=${encodeURIComponent(url)}&locale=en`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      }
    };
    const html = (await proxyBackupRequest('ssstik', payload)).data || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a[href$=".mp4"]'));
    return links.map(a => (a as HTMLAnchorElement).href);
  } catch {
    return [];
  }
}

async function fetchFromYouTube(url: string): Promise<string[]> {
  try {
    const payload = {
      url: 'https://yt1d.com/api/ajaxSearch',
      body: `q=${encodeURIComponent(url)}&t=media`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      }
    };
    const data = await proxyBackupRequest('yt1d', payload);
    const html = data.data || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a[href$=".mp4"],a[href$=".webm"],a[href$=".ogg"]'));
    return links.map(a => (a as HTMLAnchorElement).href);
  } catch {
    return [];
  }
}

async function fetchBackup(url: string): Promise<string[]> {
  const platform = getPlatform(url);
  if (platform === 'instagram') return fetchFromSnapInsta(url);
  if (platform === 'tiktok') return fetchFromTikTok(url);
  if (platform === 'youtube') return fetchFromYouTube(url);
  return [];
}

function getPlatform(url: string) {
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  return 'other';
}

function App() {
  const [url,
  setUrl]=useState('');
  const [videos,
  setVideos]=useState<string[]>([]);
  const [loading,
  setLoading]=useState(false);
  const [error,
  setError]=useState('');
  const [selected,
  setSelected]=useState<string | null>(null);
  const [ignoreDuplicates,
  setIgnoreDuplicates]=useState(true);
  const [videoMeta, setVideoMeta] = useState<Record<string, { width: number; height: number; aspect: number }>>({});
  const [showSnapInsta, setShowSnapInsta] = useState(false);
  const [detailedError, setDetailedError] = useState<string | null>(null);

  const fetchVideos = async (useBackup = false) => {
    setLoading(true);
    setError('');
    setDetailedError(null);
    setVideos([]);
    setSelected(null);
    let foundVideos: string[] = [];
    try {
      if (useBackup) {
        foundVideos = await fetchBackup(url);
        if (!foundVideos.length) setError('Backup method could not find any videos for this URL.');
      } else {
        const res = await fetch(`${API_BASE}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) {
          let details = '';
          try {
            const errData = await res.json();
            details = errData.details || errData.error || '';
          } catch {}
          setError(`Server error: ${res.status} ${res.statusText}`);
          setDetailedError(details);
          setShowSnapInsta(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.videos) {
          foundVideos = ignoreDuplicates ? await dedupeVideosWithMeta(data.videos) : data.videos;
          if (!foundVideos.length) {
            setError('No playable videos found for this URL. Some sites may block direct downloads.');
            setShowSnapInsta(true);
          }
        } else {
          setError('No videos found.');
          setShowSnapInsta(true);
        }
      }
      setVideos(foundVideos);
    } catch (e: any) {
      setError('Failed to fetch videos.');
      setDetailedError(e?.message || String(e));
      setShowSnapInsta(true);
    }
    setLoading(false);
  };

  const downloadVideo=(videoUrl: string)=> {
    const filename=getFilename(videoUrl);
    const a=document.createElement('a');

    a.href=`$ {
      API_BASE
    }

    /download?videoUrl=$ {
      encodeURIComponent(videoUrl)
    }

    &filename=$ {
      encodeURIComponent(filename)
    }

    `;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // When videos change, load their metadata for aspect ratio
  useEffect(() => {
    if (!videos.length) return;
    const meta: Record<string, { width: number; height: number; aspect: number }> = {};
    let loaded = 0;
    videos.forEach((v) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = v;
      video.onloadedmetadata = () => {
        meta[v] = {
          width: video.videoWidth,
          height: video.videoHeight,
          aspect: getAspectRatio(video.videoWidth, video.videoHeight),
        };
        loaded++;
        if (loaded === videos.length) setVideoMeta({ ...meta });
      };
      video.onerror = () => {
        meta[v] = { width: 16, height: 9, aspect: 16 / 9 };
        loaded++;
        if (loaded === videos.length) setVideoMeta({ ...meta });
      };
    });
  }, [videos]);

  return (
    <div>
      <div style= {
        {
        maxWidth: 900, margin: '2rem auto', fontFamily: 'Montserrat, Arial, sans-serif', padding: '0 1rem'
      }
    }

    > <h1 style= {
        {
        textAlign: 'center', fontSize: '2.5rem', marginBottom: 8
      }
    }

    >Video Scraper</h1> <p style= {
        {
        textAlign: 'center', color: '#4f8cff', marginBottom: 32, fontWeight: 500
      }
    }

    > Paste a URL to find and download videos! </p> <div style= {
        {
        display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24
      }
    }

    > <input type="text"

    value= {
      url
    }

    onChange= {
      e=> setUrl(e.target.value)
    }

    placeholder="Enter a URL to scrape for videos"

    style= {
        {
        width: 'min(420px, 90vw)'
      }
    }

    /> <button
      onClick={() => fetchVideos()}
      disabled={loading || !url}
    >
      {loading ? 'Loading...' : 'Fetch Videos'}
    </button> </div> <div style= {
        {
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 12
      }
    }

    > <input type="checkbox"
    id="ignore-duplicates"
    checked= {
      ignoreDuplicates
    }

    onChange= {
      e=> setIgnoreDuplicates(e.target.checked)
    }

    style= {
        {
        marginRight: 6
      }
    }

    /> <label htmlFor="ignore-duplicates" style= {
        {
        cursor: 'pointer', color: '#22223b', fontSize: '1rem'
      }
    }

    > Ignore duplicates (by file size & duration)
    </label> </div> {
      error && <div style= {
          {
          color: 'red', marginTop: 16, textAlign: 'center'
        }
      }

      > {
        error
      }

      </div>
    }

      {
      videos.length > 0 && (<div> <h2 style= {
            {
            textAlign: 'center', fontSize: '1.4rem', marginBottom: 12
          }
        }

        >Select a video to download:</h2> <div className="video-list-masonry"> {
          videos.map((v) => {
            const meta = videoMeta[v] || { aspect: 16 / 9, width: 16, height: 9 };
            // Portrait: aspect < 1, Landscape: aspect >= 1
            const isPortrait = meta.aspect < 1;
            // Calculate container style for aspect ratio
            const containerStyle = isPortrait
              ? { width: '100%', maxWidth: 320, aspectRatio: `${meta.width} / ${meta.height}` }
              : { width: '100%', aspectRatio: `${meta.width} / ${meta.height}` };
            return (
              <div
                key={v}
                className={`video-card${selected === v ? ' selected' : ''} ${isPortrait ? 'portrait' : 'landscape'}`}
                onClick={() => setSelected(v)}
                style={{ ...containerStyle, cursor: 'pointer' }}
              >
                <video src={v} controls style={{ width: '100%', height: '100%', objectFit: 'contain', aspectRatio: `${meta.width} / ${meta.height}` }} />
                <div className="filename">{getFilename(v)}</div>
                <a
                  href={`${API_BASE}/download?videoUrl=${encodeURIComponent(v)}&filename=${encodeURIComponent(getFilename(v))}`}
                  download={getFilename(v)}
                  style={{ width: '100%', marginTop: 6, display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}
                  onClick={e => e.stopPropagation()}
                >
                  <button style={{ width: '100%' }}>Download</button>
                </a>
              </div>
            );
          })}
        </div> </div>)
    } {
      showSnapInsta && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '24px 0' }}>
          <button
            style={{ background: '#ff5e62', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 8, padding: '12px 28px', cursor: 'pointer', fontSize: '1.1rem' }}
            onClick={() => { fetchVideos(true); }}
          >
            Try backup method
          </button>
        </div>
      )
    }

      {detailedError && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#fff',
          color: '#b00020',
          border: '1.5px solid #b00020',
          borderRadius: 8,
          padding: '16px 20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.13)',
          zIndex: 9999,
          minWidth: 260,
          maxWidth: 400,
          fontSize: '0.98rem',
        }}>
          <strong>Error Details:</strong>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{detailedError}</div>
          <button style={{ marginTop: 10, float: 'right', background: '#b00020', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }} onClick={() => setDetailedError(null)}>Close</button>
        </div>
      )}
    </div>
  );
}

export default App;