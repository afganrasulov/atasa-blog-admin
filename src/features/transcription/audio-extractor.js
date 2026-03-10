import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Temp directory for audio files
const AUDIO_DIR = path.join(os.tmpdir(), 'atasa-audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

export { AUDIO_DIR };

// Check & update yt-dlp before extraction
async function ensureYtDlpUpdated() {
    try {
        const { stdout } = await execAsync('yt-dlp --version', { timeout: 10000 });
        const version = stdout.trim();
        const versionDate = new Date(version.replace(/\./g, '-'));
        const daysSinceUpdate = (Date.now() - versionDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceUpdate > 30) {
            console.log(`🔄 yt-dlp is ${Math.floor(daysSinceUpdate)} days old (${version}), updating...`);
            try {
                await execAsync('yt-dlp -U', { timeout: 60000 });
                const { stdout: newVersion } = await execAsync('yt-dlp --version', { timeout: 10000 });
                console.log(`✅ yt-dlp updated: ${version} → ${newVersion.trim()}`);
            } catch (e) {
                console.log(`⚠️ yt-dlp update failed (continuing with ${version}): ${e.message.split('\n')[0]}`);
            }
        }
    } catch {
        console.log('⚠️ Could not check yt-dlp version');
    }
}

// Fallback chain for audio extraction — 6 different strategies
export async function extractAudio(videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(AUDIO_DIR, `${videoId}.mp3`);

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    // Auto-update yt-dlp if stale
    await ensureYtDlpUpdated();

    const methods = [
        // 1. Standard best audio
        {
            name: 'bestaudio/mp3',
            cmd: `yt-dlp -f bestaudio -x --audio-format mp3 --audio-quality 128K -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 2. Specific format: m4a then convert (sometimes mp3 extraction fails but m4a works)
        {
            name: 'bestaudio/m4a→mp3',
            cmd: `yt-dlp -f bestaudio[ext=m4a]/bestaudio -x --audio-format mp3 --audio-quality 128K --no-check-certificates -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 3. Download worst video+audio (small file) then extract audio — works when audio-only streams are blocked
        {
            name: 'worstvideo+audio→mp3',
            cmd: `yt-dlp -f "worstvideo+bestaudio/worst" -x --audio-format mp3 --audio-quality 128K --no-check-certificates -o "${outputPath}" "${url}"`,
            timeout: 360000
        },
        // 4. No format selection — let yt-dlp decide best approach
        {
            name: 'auto-format',
            cmd: `yt-dlp -x --audio-format mp3 --audio-quality 128K --no-check-certificates --extractor-retries 5 -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 5. Geo bypass + IPv4 + retries + slower pace
        {
            name: 'geo-bypass+slow',
            cmd: `yt-dlp -x --audio-format mp3 --audio-quality 128K --geo-bypass --extractor-retries 10 --force-ipv4 --sleep-interval 3 --max-sleep-interval 6 --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -o "${outputPath}" "${url}"`,
            timeout: 480000
        },
        // 6. Pipe through ffmpeg directly (last resort: download any format, pipe to ffmpeg)
        {
            name: 'pipe-to-ffmpeg',
            cmd: `yt-dlp -f "bestaudio/best" --no-check-certificates -o - "${url}" | ffmpeg -i pipe:0 -vn -acodec libmp3lame -b:a 128k -y "${outputPath}"`,
            timeout: 480000
        }
    ];

    const errors = [];

    for (let i = 0; i < methods.length; i++) {
        const method = methods[i];
        console.log(`🎵 [${i + 1}/${methods.length}] Trying "${method.name}" for ${videoId}...`);
        try {
            // Clean up before each attempt
            cleanupPartialFiles(outputPath);

            await execAsync(method.cmd, {
                timeout: method.timeout,
                shell: '/bin/bash',
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer
            });

            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                if (stats.size > 1000) {
                    console.log(`✅ Audio extracted with "${method.name}": ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                    return { outputPath, method: method.name, fileSize: stats.size };
                }
                console.log(`⚠️ "${method.name}" produced too small file (${stats.size} bytes), trying next...`);
                fs.unlinkSync(outputPath);
            } else {
                console.log(`⚠️ "${method.name}" did not create output file, trying next...`);
            }
        } catch (error) {
            const shortError = error.message.split('\n')[0].substring(0, 200);
            console.log(`⚠️ "${method.name}" failed: ${shortError}`);
            errors.push(`${method.name}: ${shortError}`);
            cleanupPartialFiles(outputPath);
        }
    }

    throw new Error(`All ${methods.length} extraction methods failed for ${videoId}:\n${errors.join('\n')}`);
}

function cleanupPartialFiles(outputPath) {
    for (const suffix of ['', '.part', '.temp', '.webm', '.m4a']) {
        const f = outputPath + suffix;
        if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch { }
    }
}

// Transcribe with OpenAI Whisper
export async function transcribeWithOpenAI(audioPath, apiKey, language) {
    console.log(`🎙️ Transcribing with OpenAI Whisper...`);
    const fileBuffer = fs.readFileSync(audioPath);
    const fileName = path.basename(audioPath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const formParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
        `Content-Type: audio/mpeg\r\n\r\n`
    ];

    const filePartHeader = Buffer.from(formParts.join(''));
    const filePartFooter = Buffer.from('\r\n');

    const fields = [['model', 'whisper-1'], ['language', language], ['response_format', 'text']];
    let fieldsPart = '';
    for (const [key, value] of fields) {
        fieldsPart += `--${boundary}\r\n`;
        fieldsPart += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        fieldsPart += `${value}\r\n`;
    }
    fieldsPart += `--${boundary}--\r\n`;

    const body = Buffer.concat([filePartHeader, fileBuffer, filePartFooter, Buffer.from(fieldsPart)]);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try { errorMessage = JSON.parse(errorText).error?.message || errorText; } catch { errorMessage = errorText; }
        throw new Error(errorMessage);
    }

    const transcript = await response.text();
    console.log(`✅ OpenAI transcription completed (${transcript.length} chars)`);
    return transcript;
}

// Transcribe with AssemblyAI
export async function transcribeWithAssemblyAI(audioPath, apiKey, language) {
    console.log(`🎙️ Transcribing with AssemblyAI...`);
    const fileData = fs.readFileSync(audioPath);

    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/octet-stream' },
        body: fileData
    });
    const uploadData = await uploadResponse.json();
    if (!uploadData.upload_url) throw new Error('Upload failed');

    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: uploadData.upload_url, language_code: language })
    });
    const transcriptData = await transcriptResponse.json();
    if (transcriptData.error) throw new Error(transcriptData.error);
    const transcriptId = transcriptData.id;

    let completed = false, attempts = 0;
    while (!completed && attempts < 120) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        const checkResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
            headers: { 'Authorization': apiKey }
        });
        const checkData = await checkResponse.json();
        if (checkData.status === 'completed') {
            console.log(`✅ AssemblyAI transcription completed (${checkData.text?.length || 0} chars)`);
            return checkData.text;
        } else if (checkData.status === 'error') {
            throw new Error(checkData.error || 'Transcription failed');
        }
        if (attempts % 6 === 0) console.log(`Polling ${attempts}: ${checkData.status}`);
    }
    throw new Error('Transcription timeout');
}

// Unified transcribe function
export async function transcribeAudio(audioPath, provider, apiKey, language) {
    if (provider === 'openai') return transcribeWithOpenAI(audioPath, apiKey, language);
    return transcribeWithAssemblyAI(audioPath, apiKey, language);
}

// Cleanup old audio files (called by interval)
export function cleanupAudioFiles() {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    try {
        fs.readdirSync(AUDIO_DIR).forEach(file => {
            const filePath = path.join(AUDIO_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Deleted old file: ${file}`);
            }
        });
    } catch (e) { console.error('Cleanup error:', e.message); }
}
