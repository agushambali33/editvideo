import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import clsx from 'clsx';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

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
  const ffmpegRef = useRef(null);

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

  const loadFfmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    log('Loading ffmpeg.wasm...');
    const ffmpeg = new FFmpeg();

    ffmpeg.on('progress', ({ ratio }) => {
      setProgress(`ffmpeg ${Math.round(ratio * 100)}%`);
    });

    ffmpeg.on('log', ({ message }) => {
      log(message);
    });

    await ffmpeg.load();
    log('ffmpeg loaded ✅');
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
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
    setProgress('Starting...');
    setOuterStatus?.('Processing');

    try {
      const ffmpeg = await loadFfmpeg();

      const name = 'input.mp4';
      const tmp = 'tmp.mp4';
      const out = 'final.mp4';
      const narration = 'tts.mp3';

      await ffmpeg.writeFile(name, await fetchFile(file));

      const start = Number(startRef.current?.value) || 0;
      const end = Number(endRef.current?.value) || 15;
      const duration = Math.max(1, end - start);

      log(`Trimming ${start}s -> ${end}s`);

      // watermark
      let watermarkFound = false;
      try {
        const w = await fetch('/watermark.png');
        if (w.ok) {
          const ab = await w.arrayBuffer();
          await ffmpeg.writeFile('watermark.png', new Uint8Array(ab));
          watermarkFound = true;
          log('Watermark loaded into FS');
        }
      } catch {
        log('No watermark present');
      }

      // args
      setProgress('Editing video...');
      const args = ['-ss', String(start), '-t', String(duration), '-i', name];

      if (watermarkFound && enableWatermark) {
        args.push(
          '-i', 'watermark.png',
          '-filter_complex',
          `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v];[v][1:v]overlay=W-w-10:H-h-10`,
          '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', tmp
        );
      } else {
        args.push(
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1',
          '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', tmp
        );
      }

      log('Running ffmpeg: ' + args.join(' '));
      await ffmpeg.exec(args);
      log('Video edited, tmp exists');

      // voiceover
      if (useVoice) {
        setProgress('Requesting TTS...');
        log('Requesting TTS from server...');
        const ttsText = caption || `Voiceover for ${file.name.replace(/\.[^/.]+$/, '')}`;
        const ttsRes = await axios.post('/api/tts', { text: ttsText });

        if (ttsRes.data?.audio) {
          log('TTS audio received');
          const audioBase64 = ttsRes.data.audio;
          const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
          await ffmpeg.writeFile(narration, audioBytes);

          setProgress('Merging audio...');
          await ffmpeg.exec([
            '-i', tmp, '-i', narration,
            '-c:v', 'copy', '-c:a', 'aac',
            '-map', '0:v:0', '-map', '1:a:0',
            '-shortest', out
          ]);
        } else {
          log('TTS failed, fallback to video only');
          await ffmpeg.exec(['-i', tmp, '-c:v', 'copy', '-c:a', 'aac', '-shortest', out]);
        }
      } else {
        await ffmpeg.exec(['-i', tmp, '-c:v', 'copy', '-c:a', 'aac', '-shortest', out]);
      }

      // read final
      const data = await ffmpeg.readFile(out);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      log('Final video ready ✅');

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

      setProgress('Done ✅');
      setOuterStatus?.('Ready');
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