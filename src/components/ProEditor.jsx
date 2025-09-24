import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import clsx from 'clsx';

export default function ProEditor({ setOuterStatus }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('Idle');
  const [outputUrl, setOutputUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [logs, setLogs] = useState([]);
  const [useVoice, setUseVoice] = useState(true);
  const [enableWatermark, setEnableWatermark] = useState(true);

  const startRef = useRef(null);
  const endRef = useRef(null);

  // cleanup url
  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [outputUrl]);

  const log = (msg) => {
    const t = new Date().toLocaleTimeString();
    setLogs((s) => [`[${t}] ${msg}`, ...s].slice(0, 200));
    console.log('[ProEditor]', msg);
  };

  const handleFile = async (e) => {
    const f = e.target.files[0];
    setFile(f);
    setOutputUrl(null);
    log(`Selected file: ${f?.name || 'none'}`);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      log('Copied to clipboard');
      alert('Copied!');
    } catch (e) {
      log('Clipboard copy failed: ' + e.message);
    }
  };

  const run = async () => {
    if (!file) return alert('Pilih file dulu');
    setLoading(true);
    setProgress('Uploading...');
    setOuterStatus?.('Processing');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('start', startRef.current?.value || 0);
      formData.append('end', endRef.current?.value || 15);
      formData.append('useVoice', useVoice ? '1' : '0');
      formData.append('enableWatermark', enableWatermark ? '1' : '0');
      formData.append('caption', caption);

      const res = await fetch('/api/process-video', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Processing failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setOutputUrl(url);
      setProgress('Done ✅');
      setOuterStatus?.('Ready');

      // auto caption & hashtags
      if (!caption || !hashtags) {
        setProgress('Generating caption & hashtags...');
        const prompt = `Buat 1 caption singkat (bahasa Indonesia) dan 6 hashtag relevan untuk video: ${file.name.replace(/\.[^/.]+$/, '')}`;
        const capRes = await axios.post('/api/generate-caption', { prompt });
        if (capRes.data) {
          setCaption(capRes.data.caption || '');
          setHashtags((capRes.data.hashtags || []).join(' '));
          log('Caption & hashtags generated');
        }
      }
    } catch (err) {
      console.error(err);
      log('Runtime error: ' + (err.message || String(err)));
      setProgress('Error: ' + (err.message || String(err)));
      alert('Terjadi error: ' + (err.message || String(err)));
      setOuterStatus?.('Error');
    } finally {
      setLoading(false);
    }
  };

  const downloadOutput = () => {
    if (!outputUrl) return alert('No output available');
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = 'autoreel-final.mp4';
    a.click();
  };

  const shareHelpers = async () => {
    const text = `${caption}\n\n${hashtags}`.trim();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'AutoReel', text, url: window.location.href });
        log('Shared via Web Share API');
      } catch (e) {
        log('Share failed: ' + e.message);
      }
    } else {
      const fbUrl =
        'https://www.facebook.com/sharer/sharer.php?u=' +
        encodeURIComponent(window.location.href) +
        '&quote=' +
        encodeURIComponent(text);
      window.open(fbUrl, '_blank');
    }
  };

  return (
    <div>
      <h3>Pro Editor</h3>
      <div style={{ marginTop: 10 }} className="row">
        <input className="input" type="file" accept="video/*" onChange={handleFile} />
      </div>

      <div style={{ marginTop: 10 }} className="row">
        <label className="small">Start</label>
        <input className="input" defaultValue={0} ref={startRef} type="number" />
        <label className="small">End</label>
        <input className="input" defaultValue={15} ref={endRef} type="number" />
      </div>

      <div style={{ marginTop: 10 }} className="controls">
        <label>
          <input type="checkbox" checked={enableWatermark} onChange={(e) => setEnableWatermark(e.target.checked)} /> Watermark
        </label>
        <label>
          <input type="checkbox" checked={useVoice} onChange={(e) => setUseVoice(e.target.checked)} /> AI Voiceover
        </label>
      </div>

      <div style={{ marginTop: 10 }} className="row">
        <button className="action-btn" onClick={run} disabled={loading}>
          {loading ? 'Processing...' : 'Run Auto-Process'}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setCaption('');
            setHashtags('');
            setOutputUrl(null);
            setLogs([]);
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ marginTop: 10 }} className="small">
        Progress: <strong>{progress}</strong>
      </div>

      <div className="debug">
        <strong>Logs</strong>
        <div>{logs.map((l, i) => (<div key={i}>{l}</div>))}</div>
      </div>

      {outputUrl && (
        <div style={{ marginTop: 12 }} className="preview">
          <h4>Preview</h4>
          <video src={outputUrl} controls />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button className="action-btn" onClick={downloadOutput}>Download Video</button>
            <button className="secondary" onClick={() => copyToClipboard(hashtags)}>Copy Hashtags</button>
            <button className="secondary" onClick={shareHelpers}>Share / Post</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4>Caption (edit if needed)</h4>
            <textarea className="input" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <h4>Hashtags</h4>
            <input className="input" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}