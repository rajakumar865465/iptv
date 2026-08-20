const db = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  try {
    const { credential, access_token } = req.body;
    if (!credential && !access_token) {
      return error(res, 'Google credential or access token is required', 400);
    }

    let googleId, email, name;

    if (credential) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
    } else if (access_token) {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      if (!userRes.ok) {
        return error(res, 'Invalid Google access token', 400);
      }
      const userData = await userRes.json();
      googleId = userData.sub;
      email = userData.email;
      name = userData.name;
    }

    if (!googleId || !email) {
      return error(res, 'Invalid Google token payload', 400);
    }

    // 1. Check if user already exists by google_id
    let userResult = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = userResult.rows[0];

    // 2. If not, check if user exists by email and link them
    if (!user) {
      let emailResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (emailResult.rows.length > 0) {
        user = emailResult.rows[0];
        await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
      }
    }

    // 3. If still no user, create a new one
    if (!user) {
      const insertResult = await db.query(
        `INSERT INTO users (full_name, email, google_id, status, role)
         VALUES ($1, $2, $3, 'active', 'user') RETURNING *`,
        [name || 'Google User', email, googleId]
      );
      user = insertResult.rows[0];
    }

    if (user.status !== 'active') {
      return error(res, 'User account is not active', 403);
    }

    // Generate standard JWT token
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
    console.error('Google login error:', err);
    return error(res, 'Google authentication failed', 401);
  }
};
