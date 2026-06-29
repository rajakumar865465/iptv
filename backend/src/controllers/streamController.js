const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const db = require('../config/db');
const jwt = require('jsonwebtoken');

ffmpeg.setFfmpegPath(ffmpegStatic);

// Keep track of active ffmpeg processes to prevent memory leaks
const activeTranscodes = new Map();

// PLAYBACK-04 FIX: Limit concurrent transcode sessions to protect server CPU.
// Each FFmpeg process is CPU-intensive; 4 simultaneous sessions saturate a t2.small.
const MAX_TRANSCODE_SESSIONS = parseInt(process.env.MAX_TRANSCODE_SESSIONS || '4', 10);

exports.transcodeStream = async (req, res) => {
  const { channelId } = req.params;
  const { quality } = req.query;

  // Accept token from Authorization header (preferred) or query param (legacy fallback)
  // Avoid query-param tokens in new clients — they appear in server logs and browser history
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : req.query.token;  // legacy fallback; remove once all mobile clients update

  if (!token) {
    return res.status(401).send('Unauthorized: No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // BUG-10 FIX: JWT payload uses `userId`, not `id`. Using decoded.id was always undefined,
    // causing every premium user to get a 403. Use decoded.userId instead.
    const licenseResult = await db.query(
      `SELECT * FROM licenses 
       WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()`,
      [decoded.userId]
    );

    if (licenseResult.rows.length === 0) {
      return res.status(403).send('Forbidden: No active license');
    }

    const license = licenseResult.rows[0];
    if (license.duration_days <= 1) {
      return res.status(403).send('Forbidden: This feature requires a Premium License');
    }

    // 2. Fetch the channel stream URL
    // PLAYBACK-04: Reject if too many active transcode sessions
    if (activeTranscodes.size >= MAX_TRANSCODE_SESSIONS) {
      return res.status(503).send('Server busy: too many active streams. Please try again shortly.');
    }

    const channelResult = await db.query(
      'SELECT stream_url FROM channels WHERE id = $1',
      [channelId]
    );

    if (channelResult.rows.length === 0) {
      return res.status(404).send('Channel not found');
    }

    const streamUrl = channelResult.rows[0].stream_url;

    // 3. Set resolution based on quality param
    let scale = '-2:360'; // Default 360p
    if (quality === '480' || quality === '480p') {
      scale = '-2:480';
    } else if (quality === '240' || quality === '240p') {
      scale = '-2:240';
    }

    // Generate a unique ID for this transcode session
    const sessionId = `${decoded.userId}_${channelId}_${Date.now()}`;

    // 4. Set Headers for streaming MPEG-TS
    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 5. Spawn FFmpeg Process
    console.log(`[Stream] Starting transcode for User ${decoded.userId} on Channel ${channelId} at ${quality}`);
    
    const command = ffmpeg(streamUrl)
      // Input options
      .inputOptions([
        '-re', // Read input at native frame rate (important for live)
      ])
      // Output options
      .outputOptions([
        `-vf scale=${scale}`,
        '-c:v libx264', // Fast software encoding
        '-preset ultrafast', // Minimum CPU usage
        '-crf 28', // Decent quality, lower bitrate
        '-c:a aac', // Audio codec
        '-b:a 96k', // Audio bitrate
        '-f mpegts' // Output format
      ])
      .on('start', (cmd) => {
        // Store command to kill it later if needed
        activeTranscodes.set(sessionId, command);
      })
      .on('error', (err, stdout, stderr) => {
        if (err.message.includes('SIGKILL') || err.message.includes('Output stream closed')) {
          console.log(`[Stream] Transcode stopped normally for session ${sessionId}`);
        } else {
          console.error(`[Stream] FFmpeg Error:`, err.message);
        }
        activeTranscodes.delete(sessionId);
        if (!res.headersSent) {
          res.status(500).end('Streaming error');
        }
      })
      .on('end', () => {
        console.log(`[Stream] Transcode finished for session ${sessionId}`);
        activeTranscodes.delete(sessionId);
        res.end();
      });

    // Pipe directly to the response object
    command.pipe(res, { end: true });

    // 6. Cleanup if the user disconnects (closes the app or changes channel)
    req.on('close', () => {
      console.log(`[Stream] Client disconnected, killing transcode session ${sessionId}`);
      command.kill('SIGKILL');
      activeTranscodes.delete(sessionId);
    });

  } catch (error) {
    console.error('[Stream] Auth error:', error);
    return res.status(401).send('Unauthorized');
  }
};
