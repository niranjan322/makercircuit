const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'maker_circuit_secret_2026';
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'k.niranjan140506@gmail.com';

// ─── CORS: Allow Vercel frontend + localhost dev ─────────────────────────────
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
];
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
    .then(() => console.log('[DB] Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('[DB] MongoDB connection failed:', err.message);
        process.exit(1);
    });

// ─── Mongoose Schemas ─────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const requestSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userEmail: { type: String, lowercase: true, trim: true },
    type: String,
    cause: String,
    details: String,
    review: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Request = mongoose.model('Request', requestSchema);

// ─── OTP Memory Store ─────────────────────────────────────────────────────────
const otpStore = new Map(); // key: email, value: { otp, expiresAt, type }

// ─── Resend Email ─────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_here');

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

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

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Health Check (Render uses this to confirm service is alive)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Send OTP
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email, type } = req.body;
        if (!email) return res.status(400).json({ message: 'Email required' });

        const userExists = await User.findOne({ email: email.toLowerCase() });

        if (type === 'register' && userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        if (type === 'reset' && !userExists) {
            return res.status(400).json({ message: 'User not found' });
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        otpStore.set(email.toLowerCase(), { otp, expiresAt, type });

        console.log(`[OTP] Generated for ${email}: ${otp}`);

        // Fire-and-forget email
        (async () => {
            try {
                const { error } = await resend.emails.send({
                    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
                    to: email,
                    subject: type === 'register'
                        ? 'MakerCircuit - Registration OTP'
                        : 'MakerCircuit - Password Reset OTP',
                    html: `<p>Your MakerCircuit Verification Code is: <strong>${otp}</strong><br><br>It will expire in 10 minutes.</p>`
                });
                if (error) console.error('[Email] Resend error:', error);
            } catch (e) {
                console.error('[Email] SDK error:', e.message);
            }
        })();

        res.json({ message: 'OTP processed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error generating OTP' });
    }
});

// Register with OTP
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, otp } = req.body;
        if (!name || !email || !password || !otp)
            return res.status(400).json({ message: 'All fields are required' });

        const storedOtp = otpStore.get(email.toLowerCase());
        if (!storedOtp || storedOtp.otp !== otp || storedOtp.type !== 'register')
            return res.status(400).json({ message: 'Invalid or missing OTP' });
        if (Date.now() > storedOtp.expiresAt) {
            otpStore.delete(email.toLowerCase());
            return res.status(400).json({ message: 'OTP has expired' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ name, email, password: hashedPassword });

        otpStore.delete(email.toLowerCase());
        console.log(`[ACTION] Registered: ${email}`);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset Password with OTP
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword)
            return res.status(400).json({ message: 'All fields are required' });

        const storedOtp = otpStore.get(email.toLowerCase());
        if (!storedOtp || storedOtp.otp !== otp || storedOtp.type !== 'reset')
            return res.status(400).json({ message: 'Invalid or missing OTP' });
        if (Date.now() > storedOtp.expiresAt) {
            otpStore.delete(email.toLowerCase());
            return res.status(400).json({ message: 'OTP has expired' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(400).json({ message: 'User not found' });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        otpStore.delete(email.toLowerCase());
        console.log(`[ACTION] Password reset: ${email}`);
        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        console.log(`[ACTION] Login: ${email}`);
        res.json({ message: 'Login successful', token, user: { name: user.name, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Submit Request / Review (protected)
app.post('/api/requests', authenticateToken, async (req, res) => {
    try {
        const { type, cause, details, review } = req.body;
        await Request.create({
            userId: req.user.id,
            userName: req.user.name,
            userEmail: req.user.email,
            type, cause, details, review
        });
        console.log(`[ACTION] New ${type} request from: ${req.user.email}`);
        res.status(201).json({ message: 'Request submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin Data (protected + admin-only)
app.get('/api/admin/data', authenticateToken, async (req, res) => {
    try {
        if (!req.user.email || req.user.email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            console.log(`[SECURITY] Unauthorized admin access by ${req.user.email}`);
            return res.status(403).json({ message: 'Access Denied: Admins Only.' });
        }

        const users = await User.find({}, { password: 0 });
        const requests = await Request.find({}).sort({ createdAt: -1 });
        res.json({ users, requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Serve static files locally (NOT on Render — frontend is on Vercel)
if (process.env.NODE_ENV !== 'production') {
    const path = require('path');
    const fs = require('fs');
    app.use(express.static(__dirname));
    app.use((req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
} else {
    app.use((req, res) => {
        res.status(404).json({ message: 'Route not found' });
    });
}

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints available safely!`);
});
