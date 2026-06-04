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

// Fallback chain for audio extraction — GitHub Actions worker first, then 12 yt-dlp strategies
export async function extractAudio(videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(AUDIO_DIR, `${videoId}.mp3`);

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    // --- Phase 0: GitHub Actions worker (Hetzner IP'leri YouTube'da blokede, Azure GH runners açık) ---
    if (process.env.GITHUB_DISPATCH_TOKEN) {
        try {
            console.log(`🎬 [0/13] GitHub Actions worker'a job veriliyor for ${videoId}...`);
            const { downloadYouTubeAudio } = await import('./youtube-downloader.js');
            const audioUrl = await downloadYouTubeAudio(videoId);

            console.log(`📥 MinIO'dan audio indiriliyor: ${audioUrl}`);
            const resp = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
            if (!resp.ok) throw new Error(`MinIO fetch failed: HTTP ${resp.status}`);
            const buf = Buffer.from(await resp.arrayBuffer());
            fs.writeFileSync(outputPath, buf);
            const size = fs.statSync(outputPath).size;
            if (size > 1000) {
                console.log(`✅ Audio extracted via GitHub Actions: ${(size / 1024 / 1024).toFixed(2)} MB`);
                return { outputPath, method: 'github-actions', fileSize: size };
            }
            fs.unlinkSync(outputPath);
        } catch (e) {
            console.log(`⚠️ GitHub Actions worker failed: ${e.message?.slice(0, 200)} — yt-dlp fallback'lerine geçiliyor`);
        }
    }

    // Auto-update yt-dlp if stale (fallback path için)
    await ensureYtDlpUpdated();

    // --- Phase 1: yt-dlp command-based methods ---
    const cmdMethods = [
        // 1. Standard best audio
        {
            name: 'bestaudio/mp3',
            cmd: `yt-dlp -f bestaudio -x --audio-format mp3 --audio-quality 128K -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 2. m4a then convert
        {
            name: 'bestaudio/m4a→mp3',
            cmd: `yt-dlp -f bestaudio[ext=m4a]/bestaudio -x --audio-format mp3 --audio-quality 128K --no-check-certificates -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 3. Download worst video+audio then extract
        {
            name: 'worstvideo+audio→mp3',
            cmd: `yt-dlp -f "worstvideo+bestaudio/worst" -x --audio-format mp3 --audio-quality 128K --no-check-certificates -o "${outputPath}" "${url}"`,
            timeout: 360000
        },
        // 4. Auto format selection
        {
            name: 'auto-format',
            cmd: `yt-dlp -x --audio-format mp3 --audio-quality 128K --no-check-certificates --extractor-retries 5 -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 5. With browser cookies (Chrome)
        {
            name: 'cookies-chrome',
            cmd: `yt-dlp --cookies-from-browser chrome -f bestaudio -x --audio-format mp3 --audio-quality 128K -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 6. Geo bypass + custom user-agent + slow pace
        {
            name: 'geo-bypass+slow',
            cmd: `yt-dlp -x --audio-format mp3 --audio-quality 128K --geo-bypass --extractor-retries 10 --force-ipv4 --sleep-interval 3 --max-sleep-interval 6 --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" -o "${outputPath}" "${url}"`,
            timeout: 480000
        },
        // 7. PO Token support (YouTube bot protection bypass)
        {
            name: 'po-token',
            cmd: `yt-dlp -f bestaudio -x --audio-format mp3 --audio-quality 128K --extractor-args "youtube:player-client=web" --no-check-certificates -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 8. Fragment-based download
        {
            name: 'fragment-download',
            cmd: `yt-dlp -f bestaudio --downloader dash_fragments --no-check-certificates -x --audio-format mp3 --audio-quality 128K -o "${outputPath}" "${url}"`,
            timeout: 420000
        },
        // 9. Low quality fallback (64kbps mono — something is better than nothing)
        {
            name: 'low-quality-64k',
            cmd: `yt-dlp -f "worstaudio/worst" -x --audio-format mp3 --audio-quality 64K --no-check-certificates --geo-bypass -o "${outputPath}" "${url}"`,
            timeout: 300000
        },
        // 10. Pipe through ffmpeg directly
        {
            name: 'pipe-to-ffmpeg',
            cmd: `yt-dlp -f "bestaudio/best" --no-check-certificates -o - "${url}" | ffmpeg -i pipe:0 -vn -acodec libmp3lame -b:a 128k -y "${outputPath}"`,
            timeout: 480000
        }
    ];

    const errors = [];
    let methodIndex = 0;
    const totalMethods = cmdMethods.length + 2; // +2 for Invidious and Cobalt

    // Try yt-dlp methods first
    for (const method of cmdMethods) {
        methodIndex++;
        console.log(`🎵 [${methodIndex}/${totalMethods}] Trying "${method.name}" for ${videoId}...`);
        const result = await tryCmdMethod(method, outputPath);
        if (result) return result;
        if (result === false) errors.push(`${method.name}: failed`);
    }

    // --- Phase 2: API-based methods (no yt-dlp) ---

    // 11. Invidious proxy
    methodIndex++;
    console.log(`🎵 [${methodIndex}/${totalMethods}] Trying "invidious-proxy" for ${videoId}...`);
    try {
        const invResult = await downloadFromInvidious(videoId, outputPath);
        if (invResult) return invResult;
    } catch (e) {
        console.log(`⚠️ "invidious-proxy" failed: ${e.message.substring(0, 200)}`);
        errors.push(`invidious-proxy: ${e.message.substring(0, 100)}`);
    }

    // 12. cobalt.tools API
    methodIndex++;
    console.log(`🎵 [${methodIndex}/${totalMethods}] Trying "cobalt-api" for ${videoId}...`);
    try {
        const cobaltResult = await downloadFromCobalt(videoId, outputPath);
        if (cobaltResult) return cobaltResult;
    } catch (e) {
        console.log(`⚠️ "cobalt-api" failed: ${e.message.substring(0, 200)}`);
        errors.push(`cobalt-api: ${e.message.substring(0, 100)}`);
    }

    throw new Error(`All ${totalMethods} extraction methods failed for ${videoId}:\n${errors.join('\n')}`);
}

// Execute a yt-dlp command method and return result or false
async function tryCmdMethod(method, outputPath) {
    try {
        cleanupPartialFiles(outputPath);
        await execAsync(method.cmd, {
            timeout: method.timeout,
            shell: '/bin/bash',
            maxBuffer: 50 * 1024 * 1024
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
        cleanupPartialFiles(outputPath);
    }
    return false;
}

// Download audio via Invidious public instances
async function downloadFromInvidious(videoId, outputPath) {
    const instances = [
        'https://inv.nadeko.net',
        'https://invidious.nerdvpn.de',
        'https://invidious.jing.rocks',
        'https://vid.puffyan.us'
    ];

    for (const instance of instances) {
        try {
            const apiUrl = `${instance}/api/v1/videos/${videoId}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) continue;
            const data = await response.json();

            // Find audio-only adaptive format
            const audioFormats = (data.adaptiveFormats || [])
                .filter(f => f.type && f.type.startsWith('audio/'))
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

            if (audioFormats.length === 0) continue;

            const audioUrl = audioFormats[0].url;
            if (!audioUrl) continue;

            // Download and convert with ffmpeg
            const tempPath = outputPath.replace('.mp3', '.webm');
            const dlController = new AbortController();
            const dlTimeout = setTimeout(() => dlController.abort(), 300000);

            const audioResponse = await fetch(audioUrl, { signal: dlController.signal });
            clearTimeout(dlTimeout);

            if (!audioResponse.ok) continue;

            const buffer = Buffer.from(await audioResponse.arrayBuffer());
            fs.writeFileSync(tempPath, buffer);

            // Convert to mp3 with ffmpeg
            await execAsync(`ffmpeg -i "${tempPath}" -vn -acodec libmp3lame -b:a 128k -y "${outputPath}"`, { timeout: 120000 });
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                if (stats.size > 1000) {
                    console.log(`✅ Audio extracted via Invidious (${instance}): ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                    return { outputPath, method: `invidious:${instance}`, fileSize: stats.size };
                }
            }
        } catch (e) {
            console.log(`⚠️ Invidious ${instance} failed: ${e.message.substring(0, 100)}`);
        }
    }
    return null;
}

// Download audio via cobalt.tools API
async function downloadFromCobalt(videoId, outputPath) {
    const cobaltInstances = [
        'https://api.cobalt.tools',
        'https://cobalt-api.kwiatekmiki.com'
    ];

    for (const apiBase of cobaltInstances) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(`${apiBase}/api/json`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    isAudioOnly: true,
                    aFormat: 'mp3',
                    filenamePattern: 'basic'
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) continue;
            const data = await response.json();

            if (data.status === 'error' || !data.url) continue;

            // Download the audio file
            const dlController = new AbortController();
            const dlTimeout = setTimeout(() => dlController.abort(), 300000);

            const audioResponse = await fetch(data.url, { signal: dlController.signal });
            clearTimeout(dlTimeout);

            if (!audioResponse.ok) continue;

            const buffer = Buffer.from(await audioResponse.arrayBuffer());

            // If not mp3, convert with ffmpeg
            const contentType = audioResponse.headers.get('content-type') || '';
            if (contentType.includes('mp3') || contentType.includes('mpeg')) {
                fs.writeFileSync(outputPath, buffer);
            } else {
                const tempPath = outputPath.replace('.mp3', '.tmp');
                fs.writeFileSync(tempPath, buffer);
                await execAsync(`ffmpeg -i "${tempPath}" -vn -acodec libmp3lame -b:a 128k -y "${outputPath}"`, { timeout: 120000 });
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            }

            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                if (stats.size > 1000) {
                    console.log(`✅ Audio extracted via Cobalt (${apiBase}): ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                    return { outputPath, method: `cobalt:${apiBase}`, fileSize: stats.size };
                }
            }
        } catch (e) {
            console.log(`⚠️ Cobalt ${apiBase} failed: ${e.message.substring(0, 100)}`);
        }
    }
    return null;
}

function cleanupPartialFiles(outputPath) {
    for (const suffix of ['', '.part', '.temp', '.webm', '.m4a', '.tmp']) {
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
