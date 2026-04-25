const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'maker_circuit_secret_2026';
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'k.niranjan140506@gmail.com';

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://makercircuitmc.onrender.com'
];
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}
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

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

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

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Register (no OTP — direct signup)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ message: 'All fields are required' });

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing)
            return res.status(400).json({ message: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ name, email, password: hashedPassword });

        console.log(`[ACTION] Registered: ${email}`);
        res.status(201).json({ message: 'Account created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: 'All fields are required' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user)
            return res.status(400).json({ message: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(400).json({ message: 'Invalid email or password' });

        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name },
            SECRET_KEY,
            { expiresIn: '7d' }
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

// Fallback: serve index.html for non-API routes (SPA-style)
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'Route not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints available safely!`);
});
