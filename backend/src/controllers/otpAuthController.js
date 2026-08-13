const db = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

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

    // Check if OTP exists and is not expired
    const result = await db.query(
      `SELECT * FROM otp_codes WHERE mobile = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
      [cleanMobile, code]
    );

    if (result.rows.length === 0) {
      return error(res, 'Invalid or expired OTP', 400);
    }

    // OTP is valid. Delete all OTPs for this number to prevent reuse
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
