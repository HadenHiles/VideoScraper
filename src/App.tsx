import React,
  {
  useState
}

from 'react';

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

;

// Remove duplicate videos by file name, file size, and video duration (using loaded metadata)
async function dedupeVideosWithMeta(videos: string[]): Promise<string[]> {
  const metaList = await Promise.all(videos.map(async (v) => {
    return new Promise<{url: string, size?: number, duration?: number}>(resolve => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = v;
      video.onloadedmetadata = () => {
        resolve({ url: v, duration: Math.round(video.duration) });
      };
      video.onerror = () => resolve({ url: v });
      // Try to extract file size from query string if present
      const sizeMatch = v.match(/[?&]size=(\d+)/);
      if (sizeMatch) {
        (resolve as any).size = Number(sizeMatch[1]);
      }
    });
  }));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const meta of metaList) {
    const sizeMatch = meta.url.match(/[?&]size=(\d+)/);
    const size = sizeMatch ? sizeMatch[1] : '';
    const key = `${size}|${meta.duration || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(meta.url);
    }
  }
  return result;
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
      if (data.videos) {
        const deduped = await dedupeVideosWithMeta(data.videos);
        setVideos(deduped);
      } else setError('No videos found.');
    } catch (e: any) {
      setError('Failed to fetch videos.');
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
  }

  ;

  return (<div style= {
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

    > Paste a URL to find and download videos. Modern, responsive, and easy to use ! </p> <div style= {
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

    /> <button onClick= {
      fetchVideos
    }

    disabled= {
      loading || !url
    }

    > {
      loading ? 'Loading...' : 'Fetch Videos'
    }

    </button> </div> {
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

        >Select a video to download:</h2> <div className="video-list"> {
          videos.map((v)=> (<div key= {
                v
              }

              className= {
                `video-card$ {
                  selected===v ? ' selected' : ''
                }

                `
              }

              onClick= {
                ()=> setSelected(v)
              }

              style= {
                  {
                  cursor: 'pointer'
                }
              }

              > <video src= {
                v
              }

              controls style= {
                  {
                  width: '100%'
                }
              }

              /> <div className="filename"> {
                getFilename(v)
              }

              </div> <button style= {
                  {
                  width: '100%', marginTop: 6
                }
              }

              onClick= {
                e=> {
                  e.stopPropagation(); setSelected(v); downloadVideo(v);
                }
              }

              > Download </button> </div>))
        }

        </div> </div>)
    }

    </div>);
}

export default App;