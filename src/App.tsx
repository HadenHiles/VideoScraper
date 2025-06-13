import React, { useState, useEffect } from 'react';

const API_BASE='http://localhost:4000/api';

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

// Update backup method to use /api/browser-backup instead of /api/puppeteer-backup
async function fetchBackup(url: string, debug = false): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/browser-backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, debug, proxy: "http://127.0.0.1:49037" }),
    });
    if (!res.ok) throw new Error('Browser backup failed');
    const data = await res.json();
    return data.videos || [];
  } catch (e: any) {
    throw new Error(e?.message || 'Browser backup failed');
  }
}

function App() {
  const [url, setUrl] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<'basic' | 'backup' | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(true);
  const [videoMeta, setVideoMeta] = useState<Record<string, { width: number; height: number; aspect: number }>>({});
  const [detailedError, setDetailedError] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setProgress('basic');
    setError('');
    setDetailedError(null);
    setVideos([]);
    setSelected(null);
    let foundVideos: string[] = [];
    try {
      // Try basic method first
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
        setLoading(false);
        setProgress(null);
        return;
      }
      const data = await res.json();
      if (data.videos) {
        foundVideos = ignoreDuplicates ? await dedupeVideosWithMeta(data.videos) : data.videos;
      }
      // If no videos found, try backup automatically
      if (!foundVideos.length) {
        setProgress('backup');
        try {
          foundVideos = await fetchBackup(url);
          if (!foundVideos.length) {
            setError('No playable videos found for this URL. Some sites may block direct downloads.');
            setDetailedError('No video links were found by the backup service.');
          }
        } catch (e: any) {
          setError('Backup method failed.');
          setDetailedError(e?.message || String(e));
        }
      }
      setVideos(foundVideos);
    } catch (e: any) {
      setError('Failed to fetch videos.');
      setDetailedError(e?.message || String(e));
    }
    setLoading(false);
    setProgress(null);
  };

  const downloadVideo=(videoUrl: string)=> {
    const filename=getFilename(videoUrl);
    const a=document.createElement('a');

    a.href = `${API_BASE}/download?videoUrl=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`;
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
      loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 32 }}>
          <div style={{ width: 220, margin: '18px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Fun animated loader */}
            <div style={{ marginBottom: 10 }}>
              <svg width="60" height="60" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="24" stroke="#4f8cff" strokeWidth="6" fill="none" strokeDasharray="120" strokeDashoffset="60">
                  <animateTransform attributeName="transform" type="rotate" from="0 30 30" to="360 30 30" dur="1s" repeatCount="indefinite" />
                </circle>
                <circle cx="30" cy="30" r="12" fill="#ff5e62">
                  <animate attributeName="r" values="12;18;12" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
            <div style={{ fontSize: 15, color: '#555', fontWeight: 500, textAlign: 'center' }}>
              {progress === 'basic' ? 'Searching for videos...' : progress === 'backup' ? 'Trying advanced extraction...' : 'Loading...'}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4, textAlign: 'center' }}>
              This may take a few seconds for some sites.<br />Please do not close this tab.
            </div>
          </div>
        </div>
      )}
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
    </div>
  );
}

export default App;