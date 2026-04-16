const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'maker_circuit_secret_2026';

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const usersFile = path.join(__dirname, 'users.json');
const requestsFile = path.join(__dirname, 'requests.json');

// Memory store for OTPs
const otpStore = new Map(); // key: email, value: { otp, expiresAt, type }

if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([]));
}
if (!fs.existsSync(requestsFile)) {
    fs.writeFileSync(requestsFile, JSON.stringify([]));
}

function getUsers() {
    return JSON.parse(fs.readFileSync(usersFile));
}

function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function getRequests() {
    return JSON.parse(fs.readFileSync(requestsFile));
}

function saveRequests(requests) {
    fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
}

// Nodemailer Config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // You MUST replace this or setup ENV variables in Railway!
        user: process.env.EMAIL_USER || 'k.niranjan140506@gmail.com',
        pass: process.env.EMAIL_PASS || 'your_gmail_app_password_here'
    }
});

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP API
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email, type } = req.body;
        if (!email) return res.status(400).json({ message: 'Email required' });

        const users = getUsers();
        const userExists = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (type === 'register' && userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        if (type === 'reset' && !userExists) {
            return res.status(400).json({ message: 'User not found' });
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        otpStore.set(email.toLowerCase(), { otp, expiresAt, type });

        const mailOptions = {
            from: process.env.EMAIL_USER || 'k.niranjan140506@gmail.com',
            to: email,
            subject: type === 'register' ? 'MakerCircuit - Registration OTP' : 'MakerCircuit - Password Reset OTP',
            text: `Your OTP is: ${otp}. It will expire in 10 minutes.`
        };

        console.log(`[DEPLOYER LOG - OTP GENERATED] For ${email}: ${otp}`);

        // Fire off the email asynchronously without blocking the user interface
        transporter.sendMail(mailOptions).catch(mailErr => {
            console.error('Email failed to send. Ensure EMAIL_PASS is set. OTP logged to console.');
        });

        res.json({ message: 'OTP processed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error generating OTP' });
    }
});

// User Registration API with OTP
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, otp } = req.body;
        if (!name || !email || !password || !otp) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const storedOtpData = otpStore.get(email.toLowerCase());
        if (!storedOtpData || storedOtpData.otp !== otp || storedOtpData.type !== 'register') {
            return res.status(400).json({ message: 'Invalid or missing OTP' });
        }
        if (Date.now() > storedOtpData.expiresAt) {
            otpStore.delete(email.toLowerCase());
            return res.status(400).json({ message: 'OTP has expired' });
        }

        const users = getUsers();
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now(), name, email, password: hashedPassword };
        users.push(newUser);
        saveUsers(users);
        
        // Clean up OTP
        otpStore.delete(email.toLowerCase());

        console.log(`[DEPLOYER LOG - ACTION] New user registered & verified: ${email}`);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset Password API with OTP
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const storedOtpData = otpStore.get(email.toLowerCase());
        if (!storedOtpData || storedOtpData.otp !== otp || storedOtpData.type !== 'reset') {
            return res.status(400).json({ message: 'Invalid or missing OTP' });
        }
        if (Date.now() > storedOtpData.expiresAt) {
            otpStore.delete(email.toLowerCase());
            return res.status(400).json({ message: 'OTP has expired' });
        }

        const users = getUsers();
        const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (userIndex === -1) {
            return res.status(400).json({ message: 'User not found' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        users[userIndex].password = hashedPassword;
        saveUsers(users);

        // Clean up OTP
        otpStore.delete(email.toLowerCase());

        console.log(`[DEPLOYER LOG - ACTION] Password reset successfully for: ${email}`);
        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// User Login API
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = getUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name }, 
            SECRET_KEY, 
            { expiresIn: '1h' }
        );
        
        console.log(`[DEPLOYER LOG - ACTION] User logged in: ${email}`);
        res.json({ message: 'Login successful', token, user: { name: user.name, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Middleware to verify token for protected routes
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

// Submit a new request or review
app.post('/api/requests', authenticateToken, (req, res) => {
    try {
        const { type, cause, details, review } = req.body;
        const requests = getRequests();
        const newReq = {
            id: Date.now(),
            userId: req.user.id,
            userName: req.user.name,
            userEmail: req.user.email,
            type,
            cause,
            details,
            review,
            createdAt: new Date().toISOString()
        };
        requests.push(newReq);
        saveRequests(requests);
        
        console.log(`[DEPLOYER LOG - ACTION] New ${type} request submitted by: ${req.user.email}`);
        res.status(201).json({ message: 'Request submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin API to get all users and requests
app.get('/api/admin/data', authenticateToken, (req, res) => {
    try {
        const ADMIN_EMAIL = 'k.niranjan140506@gmail.com';
        if (!req.user.email || req.user.email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            console.log(`[SECURITY] Unauthorized admin access attempt by ${req.user.email}`);
            return res.status(403).json({ message: 'Access Denied: Admins Only.' });
        }
        
        const users = getUsers().map(u => ({ id: u.id, name: u.name, email: u.email }));
        const requests = getRequests();
        res.json({ users, requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Fallback to serve index.html for undefined routes
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints available safely!`);
});
