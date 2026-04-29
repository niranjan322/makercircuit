const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'maker_circuit_secret_2026';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'k.niranjan140506@gmail.com';
const OTP_EXPIRY_MINUTES = 10;

// ─── Supabase Client ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[DB] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.');
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
console.log('[DB] Supabase client initialised.');

// ─── Nodemailer Transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS   // Gmail: use an App Password
    }
});

async function sendOTPEmail(toEmail, otp) {
    await transporter.sendMail({
        from: `"MakerCircuit 🔧" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Your MakerCircuit Login OTP',
        html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;
                    background:#0a0f1e;border:1px solid #00d4ff33;border-radius:16px;
                    padding:40px 32px;color:#e2e8f0;">
            <h2 style="color:#00d4ff;margin:0 0 8px;">MakerCircuit</h2>
            <p style="color:#94a3b8;margin:0 0 32px;font-size:14px;">Secure Login Verification</p>
            <p style="margin:0 0 16px;">Hello 👋, here is your one-time password:</p>
            <div style="background:#0d1b2a;border:2px solid #00d4ff55;border-radius:12px;
                        padding:24px;text-align:center;letter-spacing:12px;
                        font-size:40px;font-weight:800;color:#00d4ff;margin:0 0 24px;">
                ${otp}
            </div>
            <p style="color:#94a3b8;font-size:13px;margin:0;">
                ⏱ This OTP expires in <strong style="color:#e2e8f0;">${OTP_EXPIRY_MINUTES} minutes</strong>.<br>
                If you didn't request this, ignore this email.
            </p>
        </div>`
    });
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://makercircuitmc.onrender.com',
    'https://makercircuit.vercel.app'
];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access Denied' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid Token' });
        req.user = user;
        next();
    });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Health Check
app.get('/api/health', async (req, res) => {
    const { error } = await supabase.from('users').select('id').limit(1);
    res.json({ status: 'ok', db: error ? 'error' : 'connected' });
});

// ── STEP 1: Login – validate credentials, send OTP ───────────────────────────
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: 'All fields are required' });

        const normalizedEmail = email.toLowerCase().trim();

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (error) throw error;
        if (!user)
            return res.status(400).json({ message: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(400).json({ message: 'Invalid email or password' });

        // Generate OTP and store in supabase
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

        // Delete any existing OTP for this email first
        await supabase.from('otp_tokens').delete().eq('email', normalizedEmail);

        const { error: otpErr } = await supabase.from('otp_tokens').insert([{
            email: normalizedEmail,
            otp,
            expires_at: expiresAt
        }]);
        if (otpErr) throw otpErr;

        // Send email
        await sendOTPEmail(normalizedEmail, otp);

        console.log(`[OTP] Sent to: ${normalizedEmail}`);
        res.json({ message: 'OTP sent to your email. Please verify.', otpRequired: true });
    } catch (err) {
        console.error('[Login Error]', err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

// ── STEP 2: Verify OTP – issue JWT ───────────────────────────────────────────
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp)
            return res.status(400).json({ message: 'Email and OTP are required' });

        const normalizedEmail = email.toLowerCase().trim();

        const { data: record, error } = await supabase
            .from('otp_tokens')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (error) throw error;

        if (!record)
            return res.status(400).json({ message: 'OTP not found. Please login again.' });

        if (new Date() > new Date(record.expires_at))
            return res.status(400).json({ message: 'OTP expired. Please login again.' });

        if (record.otp !== otp.trim())
            return res.status(400).json({ message: 'Incorrect OTP. Try again.' });

        // OTP verified — clean up and fetch user
        await supabase.from('otp_tokens').delete().eq('email', normalizedEmail);

        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (userErr) throw userErr;

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        console.log(`[ACTION] OTP Login success: ${normalizedEmail}`);
        res.json({ message: 'Login successful', token, user: { name: user.name, email: user.email } });
    } catch (err) {
        console.error('[OTP Verify Error]', err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

// ── Register ──────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, mobileNumber, password } = req.body;
        if (!name || !email || !mobileNumber || !password)
            return res.status(400).json({ message: 'All fields are required' });

        const normalizedEmail = email.toLowerCase().trim();

        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existing)
            return res.status(400).json({ message: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const { error } = await supabase.from('users').insert([{
            name,
            email: normalizedEmail,
            mobile_number: mobileNumber,
            password: hashedPassword
        }]);

        if (error) throw error;

        console.log(`[ACTION] Registered: ${normalizedEmail}`);
        res.status(201).json({ message: 'Account created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Forgot Password ───────────────────────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { mobileNumber, newPassword } = req.body;
        if (!mobileNumber || !newPassword)
            return res.status(400).json({ message: 'Mobile number and new password are required' });

        const { data: user, error } = await supabase
            .from('users')
            .select('id')
            .eq('mobile_number', mobileNumber)
            .maybeSingle();

        if (error) throw error;
        if (!user)
            return res.status(404).json({ message: 'No account found with this mobile number' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', user.id);

        if (updateError) throw updateError;

        console.log(`[ACTION] Password Reset for mobile: ${mobileNumber}`);
        res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Submit Request / Review (protected) ──────────────────────────────────────
app.post('/api/requests', authenticateToken, async (req, res) => {
    try {
        const { type, cause, details, review } = req.body;
        const { error } = await supabase.from('requests').insert([{
            user_id: req.user.id,
            user_name: req.user.name,
            user_email: req.user.email,
            type, cause, details, review
        }]);
        if (error) throw error;
        console.log(`[ACTION] New ${type} request from: ${req.user.email}`);
        res.status(201).json({ message: 'Request submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Admin Data (protected + admin-only) ──────────────────────────────────────
app.get('/api/admin/data', authenticateToken, async (req, res) => {
    try {
        if (!req.user.email || req.user.email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            console.log(`[SECURITY] Unauthorized admin access by ${req.user.email}`);
            return res.status(403).json({ message: 'Access Denied: Admins Only.' });
        }
        const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id, name, email, mobile_number, created_at');
        const { data: requests, error: reqErr } = await supabase
            .from('requests')
            .select('*')
            .order('created_at', { ascending: false });
        if (usersErr) throw usersErr;
        if (reqErr) throw reqErr;
        res.json({ users, requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Fallback ──────────────────────────────────────────────────────────────────
app.use((req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ message: 'Route not found' });
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
