import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import formidable from 'formidable';
import { promisify } from 'util';
import axios from 'axios';

export const config = {
  api: {
    bodyParser: false, // penting biar formidable bisa handle multipart form-data
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // parse form data
  const form = formidable({ multiples: false, keepExtensions: true });
  const parseForm = promisify(form.parse.bind(form));

  try {
    const [fields, files] = await parseForm(req);
    const file = files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const inputPath = file.filepath;
    const outputPath = path.join(process.cwd(), 'tmp', `out-${Date.now()}.mp4`);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    const start = Number(fields.start?.[0] || fields.start || 0);
    const end = Number(fields.end?.[0] || fields.end || 15);
    const duration = Math.max(1, end - start);
    const useVoice = fields.useVoice == '1';
    const enableWatermark = fields.enableWatermark == '1';
    const caption = fields.caption?.[0] || fields.caption || '';

    let command = ffmpeg(inputPath).setFfmpegPath(ffmpegPath);

    // trim video
    command = command.setStartTime(start).setDuration(duration);

    // scale & watermark
    if (enableWatermark) {
      const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png');
      if (fs.existsSync(watermarkPath)) {
        command = command
          .videoFilters(
            `[in]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v];[v][wm];[wm][logo]overlay=W-w-10:H-h-10[out]`
          )
          .input(watermarkPath);
      }
    } else {
      command = command.videoFilters(
        'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1'
      );
    }

    // if voiceover requested
    if (useVoice) {
      const ttsText = caption || `Voiceover for ${path.basename(file.originalFilename)}`;
      const ttsRes = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/tts`, { text: ttsText });
      const audioBase64 = ttsRes.data?.audio;

      if (audioBase64) {
        const audioPath = path.join(process.cwd(), 'tmp', `tts-${Date.now()}.mp3`);
        const audioBytes = Buffer.from(audioBase64, 'base64');
        await fs.promises.writeFile(audioPath, audioBytes);

        command = command.input(audioPath).audioCodec('aac').outputOptions(['-shortest']);
      }
    }

    await new Promise((resolve, reject) => {
      command
        .outputOptions(['-c:v libx264', '-preset veryfast', '-crf 23'])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    const videoBuffer = await fs.promises.readFile(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.send(videoBuffer);

    // cleanup
    fs.promises.unlink(inputPath).catch(() => {});
    fs.promises.unlink(outputPath).catch(() => {});
  } catch (err) {
    console.error('process-video error:', err);
    res.status(500).json({ error: err.message });
  }
}