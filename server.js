const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'maker_circuit_secret_2026';

app.use(morgan('dev')); // Performance and HTTP request logger
app.use(cors());
app.use(express.json());
// Serve the frontend static files
app.use(express.static(__dirname));

const usersFile = path.join(__dirname, 'users.json');
const requestsFile = path.join(__dirname, 'requests.json');

// Initialize user DB
if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([]));
}
// Initialize requests DB
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

// User Registration API
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const users = getUsers();
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now(), name, email, password: hashedPassword };
        users.push(newUser);
        saveUsers(users);
        
        console.log(`[DEPLOYER LOG - ACTION] New user registered: ${email}`);
        res.status(201).json({ message: 'User registered successfully' });
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
        const user = users.find(u => u.email === email);
        
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
            type, // 'repairing' or 'project_making'
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
        if (!req.user.email || req.user.email.trim().toLowerCase() !== ADMIN_EMAIL) {
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
    console.log(`API endpoints available at /api/login and /api/register`);
});
