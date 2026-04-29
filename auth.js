// ─── State ────────────────────────────────────────────────────────────────────
let otpEmail = '';         // email saved after step-1 success
let countdownInterval = null;

// ─── Tab Switcher ─────────────────────────────────────────────────────────────
function switchTab(tab) {
    // Hide OTP step if visible
    showOTPStep(false);

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));

    if (tab === 'login') {
        document.getElementById('tab-login-btn').classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else if (tab === 'register') {
        document.getElementById('tab-register-btn').classList.add('active');
        document.getElementById('register-form').classList.add('active');
    } else if (tab === 'forgot') {
        document.getElementById('forgot-form').classList.add('active');
    }
}

// ─── Password Toggle ──────────────────────────────────────────────────────────
function togglePasswordVisibility(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconEl.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        iconEl.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ─── Password Strength ────────────────────────────────────────────────────────
function isStrongPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
}

// ─── Message Helper ───────────────────────────────────────────────────────────
function showMessage(elId, msg, isError = true) {
    const el = document.getElementById(elId);
    el.style.color = isError ? '#ff4c4c' : 'var(--neon-green)';
    el.innerText = msg;
}

// ─── OTP Step Visibility ──────────────────────────────────────────────────────
function showOTPStep(show) {
    const otpStep = document.getElementById('otp-step');
    const loginForm = document.getElementById('login-form');
    const tabs = document.getElementById('auth-tabs');

    if (show) {
        loginForm.classList.remove('active');
        tabs.style.opacity = '0.3';
        tabs.style.pointerEvents = 'none';
        otpStep.classList.add('active');
    } else {
        otpStep.classList.remove('active');
        tabs.style.opacity = '';
        tabs.style.pointerEvents = '';
        clearInterval(countdownInterval);
    }
}

function backToLogin() {
    showOTPStep(false);
    clearInterval(countdownInterval);
    // Re-show login form
    document.getElementById('tab-login-btn').classList.add('active');
    document.getElementById('login-form').classList.add('active');
    showMessage('login-msg', '', true);
}

// ─── OTP Countdown Timer ──────────────────────────────────────────────────────
function startCountdown(minutes = 10) {
    clearInterval(countdownInterval);
    let total = minutes * 60;
    const el = document.getElementById('otp-countdown');
    const resendBtn = document.getElementById('resend-btn');
    resendBtn.disabled = true;

    countdownInterval = setInterval(() => {
        const m = String(Math.floor(total / 60)).padStart(2, '0');
        const s = String(total % 60).padStart(2, '0');
        el.textContent = `${m}:${s}`;
        total--;

        if (total < 0) {
            clearInterval(countdownInterval);
            el.textContent = '00:00';
            el.style.color = '#ff4c4c';
            resendBtn.disabled = false;
            showMessage('otp-msg', 'OTP expired. Please resend.', true);
        }
    }, 1000);
}

// ─── OTP Boxes – Auto-focus & Backspace ──────────────────────────────────────
function initOTPBoxes() {
    const boxes = document.querySelectorAll('.otp-inputs input');

    boxes.forEach((box, i) => {
        // Auto-advance on digit
        box.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            box.value = val ? val[0] : '';
            box.classList.toggle('filled', !!box.value);
            if (box.value && i < boxes.length - 1) {
                boxes[i + 1].focus();
            }
        });

        // Backspace goes back
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && i > 0) {
                boxes[i - 1].focus();
                boxes[i - 1].value = '';
                boxes[i - 1].classList.remove('filled');
            }
        });

        // Paste support
        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            pasted.split('').forEach((ch, idx) => {
                if (boxes[idx]) {
                    boxes[idx].value = ch;
                    boxes[idx].classList.add('filled');
                }
            });
            boxes[Math.min(pasted.length, 5)].focus();
        });
    });
}

function getOTPValue() {
    return Array.from(document.querySelectorAll('.otp-inputs input'))
        .map(b => b.value).join('');
}

function clearOTPBoxes() {
    document.querySelectorAll('.otp-inputs input').forEach(b => {
        b.value = '';
        b.classList.remove('filled');
    });
    document.getElementById('otp-0').focus();
}

function shakeOTPBoxes() {
    const boxes = document.getElementById('otp-boxes');
    boxes.classList.add('shake');
    boxes.addEventListener('animationend', () => boxes.classList.remove('shake'), { once: true });
}

// ─── LOGIN – Step 1: Credentials ─────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Show spinner
    document.getElementById('login-btn-text').style.display = 'none';
    document.getElementById('login-btn-spinner').style.display = 'inline';
    document.getElementById('login-btn').disabled = true;
    showMessage('login-msg', '', false);

    try {
        const res = await apiFetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.otpRequired) {
            otpEmail = email;
            document.getElementById('otp-display-email').textContent = email;
            showOTPStep(true);
            clearOTPBoxes();
            startCountdown(10);
            document.getElementById('otp-countdown').style.color = '';
            showMessage('otp-msg', '', false);
        } else {
            showMessage('login-msg', data.message || 'Login failed');
        }
    } catch {
        showMessage('login-msg', 'Cannot connect to server. Try again later.');
    } finally {
        document.getElementById('login-btn-text').style.display = 'inline';
        document.getElementById('login-btn-spinner').style.display = 'none';
        document.getElementById('login-btn').disabled = false;
    }
});

// ─── LOGIN – Step 2: OTP Verify ──────────────────────────────────────────────
document.getElementById('verify-otp-btn').addEventListener('click', async () => {
    const otp = getOTPValue();
    if (otp.length < 6) {
        showMessage('otp-msg', 'Please enter the complete 6-digit OTP.', true);
        shakeOTPBoxes();
        return;
    }

    document.getElementById('verify-btn-text').style.display = 'none';
    document.getElementById('verify-btn-spinner').style.display = 'inline';
    document.getElementById('verify-otp-btn').disabled = true;
    showMessage('otp-msg', '', false);

    try {
        const res = await apiFetch('/api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: otpEmail, otp })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('otp-msg', '✅ Verified! Redirecting…', false);
            clearInterval(countdownInterval);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        } else {
            showMessage('otp-msg', data.message || 'Invalid OTP. Try again.');
            shakeOTPBoxes();
            clearOTPBoxes();
        }
    } catch {
        showMessage('otp-msg', 'Cannot connect to server. Try again later.', true);
    } finally {
        document.getElementById('verify-btn-text').style.display = 'inline';
        document.getElementById('verify-btn-spinner').style.display = 'none';
        document.getElementById('verify-otp-btn').disabled = false;
    }
});

// ─── Resend OTP ───────────────────────────────────────────────────────────────
async function resendOTP() {
    const password = document.getElementById('login-password').value;
    if (!otpEmail || !password) {
        backToLogin();
        return;
    }

    showMessage('otp-msg', 'Resending OTP…', false);
    document.getElementById('resend-btn').disabled = true;

    try {
        const res = await apiFetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: otpEmail, password })
        });
        const data = await res.json();

        if (res.ok && data.otpRequired) {
            clearOTPBoxes();
            startCountdown(10);
            document.getElementById('otp-countdown').style.color = '';
            showMessage('otp-msg', '✅ New OTP sent!', false);
        } else {
            showMessage('otp-msg', data.message || 'Failed to resend OTP.', true);
        }
    } catch {
        showMessage('otp-msg', 'Cannot connect to server.', true);
        document.getElementById('resend-btn').disabled = false;
    }
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name         = document.getElementById('reg-name').value.trim();
    const email        = document.getElementById('reg-email').value.trim();
    const mobileNumber = document.getElementById('reg-mobile').value.trim();
    const password     = document.getElementById('reg-password').value;

    if (!isStrongPassword(password)) {
        showMessage('reg-msg', 'Password must be 8+ chars with uppercase, lowercase, number & symbol.');
        return;
    }

    showMessage('reg-msg', 'Creating account…', false);

    try {
        const res = await apiFetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, mobileNumber, password })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('reg-msg', 'Account created! Redirecting to login…', false);
            setTimeout(() => {
                switchTab('login');
                document.getElementById('login-email').value = email;
                document.getElementById('register-form').reset();
                document.getElementById('reg-msg').innerText = '';
            }, 1500);
        } else {
            showMessage('reg-msg', data.message || 'Registration failed');
        }
    } catch {
        showMessage('reg-msg', 'Cannot connect to server. Try again later.');
    }
});

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const mobileNumber = document.getElementById('forgot-mobile').value.trim();
    const newPassword  = document.getElementById('forgot-password').value;

    if (!isStrongPassword(newPassword)) {
        showMessage('forgot-msg', 'Password must be 8+ chars with uppercase, lowercase, number & symbol.');
        return;
    }

    showMessage('forgot-msg', 'Resetting password…', false);

    try {
        const res = await apiFetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobileNumber, newPassword })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('forgot-msg', 'Password reset successful! Redirecting to login…', false);
            setTimeout(() => {
                switchTab('login');
                document.getElementById('forgot-form').reset();
                document.getElementById('forgot-msg').innerText = '';
            }, 2000);
        } else {
            showMessage('forgot-msg', data.message || 'Reset failed');
        }
    } catch {
        showMessage('forgot-msg', 'Cannot connect to server. Try again later.');
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
initOTPBoxes();
