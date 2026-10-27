const db = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { ensureUserTrial } = require('../services/subscriptionService');

// Helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^\d{9,15}$/.test(mobile.replace(/[\s\-+]/g, ''))) {
      return error(res, 'Valid mobile number is required', 400);
    }
    
    const cleanMobile = mobile.replace(/[\s\-+]/g, '');
    const code = generateOTP();
    
    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // Save OTP to database
    await db.query(
      `INSERT INTO otp_codes (mobile, code, expires_at) VALUES ($1, $2, $3)`,
      [cleanMobile, code, expiresAt]
    );

    // TODO: Integrate your SMS Provider here (Twilio, MSG91, Fast2SMS, etc.)
    // Example: await twilioClient.messages.create({ body: \`Your NivaTV code is \${code}\`, to: \`+\${cleanMobile}\` });
    console.log(`[DEVELOPMENT ONLY] OTP for ${cleanMobile} is ${code}`);

    return success(res, null, 'OTP sent successfully');
  } catch (err) {
    console.error('Send OTP error:', err);
    return error(res, 'Failed to send OTP', 500);
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, code } = req.body;
    if (!mobile || !code) {
      return error(res, 'Mobile and code are required', 400);
    }

    const cleanMobile = mobile.replace(/[\s\-+]/g, '');

    // Look up active OTP for this mobile to check attempts counter
    const otpRes = await db.query(
      `SELECT id, code, COALESCE(attempts, 0) AS attempts FROM otp_codes
       WHERE mobile = $1 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [cleanMobile]
    );

    if (otpRes.rows.length === 0) {
      return error(res, 'Invalid or expired OTP', 400);
    }

    const currentOtp = otpRes.rows[0];

    // Lockout if 5 failed attempts exceeded
    if (currentOtp.attempts >= 5) {
      await db.query('DELETE FROM otp_codes WHERE mobile = $1', [cleanMobile]);
      return error(res, 'Too many failed attempts. This OTP has been revoked. Please request a new one.', 429);
    }

    // Verify OTP code
    if (currentOtp.code !== String(code).trim()) {
      const newAttempts = currentOtp.attempts + 1;
      if (newAttempts >= 5) {
        await db.query('DELETE FROM otp_codes WHERE mobile = $1', [cleanMobile]);
        return error(res, 'Too many failed attempts. This OTP has been revoked. Please request a new one.', 429);
      } else {
        await db.query('UPDATE otp_codes SET attempts = $1 WHERE id = $2', [newAttempts, currentOtp.id]);
        return error(res, `Invalid OTP. ${5 - newAttempts} attempt(s) remaining.`, 400);
      }
    }

    // Atomically consume the OTP and clean up
    await db.query(`DELETE FROM otp_codes WHERE mobile = $1`, [cleanMobile]);

    // Check if user exists
    let userResult = await db.query('SELECT * FROM users WHERE mobile = $1', [cleanMobile]);
    let user = userResult.rows[0];

    // If no user, create one
    if (!user) {
      const insertResult = await db.query(
        `INSERT INTO users (full_name, mobile, status, role)
         VALUES ($1, $2, 'active', 'user') RETURNING *`,
        ['User', cleanMobile]
      );
      user = insertResult.rows[0];
    }

    if (user.status !== 'active') {
      return error(res, 'User account is not active', 403);
    }

    // Generate token
    if (!user.has_claimed_trial) {
      await ensureUserTrial(user.id);
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    return success(res, {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role
      }
    }, 'Login successful');
  } catch (err) {
    console.error('Verify OTP error:', err);
    return error(res, 'OTP verification failed', 500);
  }
};
