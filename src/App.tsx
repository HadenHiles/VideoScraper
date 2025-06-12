import React, { useState } from 'react';

const API_BASE = 'http://localhost:4000/api';

function App() {
  const [url, setUrl] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError('');
    setVideos([]);
    setSelected(null);
    try {
      const res = await fetch(`${API_BASE}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.videos) setVideos(data.videos);
      else setError('No videos found.');
    } catch (e: any) {
      setError('Failed to fetch videos.');
    }
    setLoading(false);
  };

  // Helper to guess filename from URL
  const getFilename = (videoUrl: string) => {
    try {
      const urlObj = new URL(videoUrl);
      const pathname = urlObj.pathname.split('/').filter(Boolean);
      let name = pathname[pathname.length - 1] || 'video';
      if (!/\.[a-zA-Z0-9]+$/.test(name)) {
        // fallback to .mp4 if no extension
        name += '.mp4';
      }
      return name;
    } catch {
      return 'video.mp4';
    }
  };

  const downloadVideo = (videoUrl: string) => {
    const filename = getFilename(videoUrl);
    const a = document.createElement('a');
    a.href = `${API_BASE}/download?videoUrl=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Video Scraper</h1>
      <input
        type="text"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="Enter a URL to scrape for videos"
        style={{ width: '80%', padding: 8 }}
      />
      <button onClick={fetchVideos} disabled={loading || !url} style={{ marginLeft: 8, padding: 8 }}>
        {loading ? 'Loading...' : 'Fetch Videos'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
      {videos.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>Select a video to download:</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {videos.map((v, i) => (
              <li key={v} style={{ marginBottom: 16, border: selected === v ? '2px solid #007bff' : '1px solid #ccc', borderRadius: 8, padding: 8 }}>
                <video src={v} controls style={{ maxWidth: '100%', maxHeight: 200, display: 'block', marginBottom: 8 }} />
                <div style={{ wordBreak: 'break-all' }}>{v}</div>
                <button onClick={() => { setSelected(v); downloadVideo(v); }} style={{ marginTop: 8, padding: 8 }}>
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
