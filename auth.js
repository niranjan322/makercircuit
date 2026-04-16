function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    const tabsContainer = document.getElementById('auth-tabs');
    
    if (tab === 'login') {
        tabsContainer.style.display = 'flex';
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else if (tab === 'register') {
        tabsContainer.style.display = 'flex';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('register-form').classList.add('active');
    } else if (tab === 'forgot') {
        tabsContainer.style.display = 'none';
        document.getElementById('forgot-form').classList.add('active');
    }
}

function togglePasswordVisibility(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconEl.classList.remove('fa-eye');
        iconEl.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        iconEl.classList.remove('fa-eye-slash');
        iconEl.classList.add('fa-eye');
    }
}

// Password strength validator
function isStrongPassword(password) {
    // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
}

function showMessage(elId, msg, isError = true) {
    const el = document.getElementById(elId);
    el.className = isError ? 'error-msg' : 'success-msg';
    el.style.color = isError ? '#ff4c4c' : 'var(--neon-green)';
    el.innerText = msg;
}

// Handle Login API
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    showMessage('login-msg', 'Authenticating...', false);

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            showMessage('login-msg', 'Login successful! Redirecting...', false);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        } else {
            showMessage('login-msg', data.message || 'Login failed');
        }
    } catch (err) {
        showMessage('login-msg', 'Server error. Make sure the Node.js API is running!');
    }
});

// Handle Register - Step 1: Send OTP
let pendingRegData = null;
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    if (!isStrongPassword(password)) {
        showMessage('reg-msg', 'Password must be at least 8 chars long, include uppercase, lowercase, number, and special character.');
        return;
    }

    showMessage('reg-msg', 'Sending OTP to email...', false);
    document.getElementById('reg-msg').style.color = 'var(--text-secondary)';

    try {
        const res = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, type: 'register' })
        });
        const data = await res.json();
        
        if (res.ok) {
            pendingRegData = { name, email, password };
            document.getElementById('reg-step-1').style.display = 'none';
            document.getElementById('reg-step-2').style.display = 'block';
            showMessage('reg-msg', 'OTP Sent! Please check your email inbox (and spam folder).', false);
        } else {
            showMessage('reg-msg', data.message || 'Failed to send OTP');
        }
    } catch (err) {
        showMessage('reg-msg', 'Server error saving OTP request.');
    }
});

// Handle Register - Step 2: Verify OTP
async function verifyRegistration() {
    const otp = document.getElementById('reg-otp').value;
    if (!otp || !pendingRegData) return showMessage('reg-msg', 'Please enter valid OTP');

    showMessage('reg-msg', 'Verifying...', false);
    
    try {
        const payload = { ...pendingRegData, otp };
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok) {
            showMessage('reg-msg', 'Account created successfully! Redirecting to login...', false);
            setTimeout(() => { 
                switchTab('login'); 
                document.getElementById('login-email').value = pendingRegData.email; 
                document.getElementById('reg-step-1').style.display = 'block';
                document.getElementById('reg-step-2').style.display = 'none';
                document.getElementById('register-form').reset();
                pendingRegData = null;
                document.getElementById('reg-msg').innerText = '';
            }, 2000);
        } else {
            showMessage('reg-msg', data.message || 'OTP Verification failed');
        }
    } catch (err) {
        showMessage('reg-msg', 'Server error during verification.');
    }
}

// Handle Forgot Password - Step 1: Send Request
document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    showMessage('forgot-msg', 'Sending OTP to email...', false);

    try {
        const res = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, type: 'reset' })
        });
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('forgot-step-1').style.display = 'none';
            document.getElementById('forgot-step-2').style.display = 'block';
            showMessage('forgot-msg', 'Reset OTP sent! Check your email.', false);
        } else {
            showMessage('forgot-msg', data.message || 'Failed to send OTP');
        }
    } catch (err) {
        showMessage('forgot-msg', 'Server error.');
    }
});

// Handle Forgot Password - Step 2: Reset Password
async function resetPassword() {
    const email = document.getElementById('forgot-email').value;
    const otp = document.getElementById('forgot-otp').value;
    const newPassword = document.getElementById('forgot-new-password').value;

    if (!isStrongPassword(newPassword)) {
        showMessage('forgot-msg', 'New password must be at least 8 chars long, include uppercase, lowercase, number, and special character.');
        return;
    }

    showMessage('forgot-msg', 'Resetting password...', false);
    
    try {
        const res = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, newPassword })
        });
        const data = await res.json();
        
        if (res.ok) {
            showMessage('forgot-msg', 'Password reset successfully! Redirecting to login...', false);
            setTimeout(() => { 
                switchTab('login');
                document.getElementById('login-email').value = email;
                document.getElementById('forgot-step-1').style.display = 'block';
                document.getElementById('forgot-step-2').style.display = 'none';
                document.getElementById('forgot-form').reset();
                document.getElementById('forgot-msg').innerText = '';
            }, 2000);
        } else {
            showMessage('forgot-msg', data.message || 'Reset failed');
        }
    } catch (err) {
        showMessage('forgot-msg', 'Server error.');
    }
}
