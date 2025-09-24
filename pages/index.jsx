import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const Editor = dynamic(() => import('../src/components/ProEditor'), { ssr: false });

export default function Home() {
  const [status, setStatus] = useState('Ready');

  return (
    <div className="container">
      <Head>
        <title>AutoReel Pro Advanced</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="header">
        <div className="brand">
          <div className="logo">AR</div>
          <div>
            <h1>AutoReel Pro Advanced</h1>
            <div className="small">Smart editor · Auto captions · TTS · Watermark · Share helpers</div>
          </div>
        </div>
        <div className="small">Status: <strong style={{color:'#a7f3d0'}}>{status}</strong></div>
      </div>

      <div className="grid">
        <div className="card">
          <Editor setOuterStatus={setStatus} />
        </div>

        <div className="card">
          <h3>Preview & Tools</h3>
          <p className="small">After processing you can download the final video, copy hashtags, or use share helpers.</p>

          <div className="meta">
            <div className="tag">Auto-generated hashtags and captions</div>
            <div className="tag">Client-side video editing (privacy)</div>
            <div className="tag">Server TTS (OpenAI) with fallback</div>
            <div className="tag">Clear debug logs for fast troubleshooting</div>
          </div>

          <div style={{marginTop:12}}>
            <h4>How to deploy</h4>
            <ol className="small">
              <li>Create GitHub repo & push this project.</li>
              <li>Deploy on Vercel (Import GitHub repo).</li>
              <li>Set env var <code>OPENAI_API_KEY</code> in Vercel Project Settings.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="footer">
        Built for you — AutoReel Pro Advanced. Check README for full instructions.
      </div>
    </div>
  );
}
