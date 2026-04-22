// ─── Tab Switcher ─────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));

    if (tab === 'login') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else if (tab === 'register') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('register-form').classList.add('active');
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
    // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
}

// ─── Show Message ─────────────────────────────────────────────────────────────
function showMessage(elId, msg, isError = true) {
    const el = document.getElementById(elId);
    el.style.color = isError ? '#ff4c4c' : 'var(--neon-green)';
    el.innerText = msg;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    showMessage('login-msg', 'Signing in...', false);

    try {
        const res = await apiFetch('/api/login', {
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
    } catch {
        showMessage('login-msg', 'Cannot connect to server. Try again later.');
    }
});

// ─── REGISTER ─────────────────────────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!isStrongPassword(password)) {
        showMessage('reg-msg', 'Password must be 8+ chars with uppercase, lowercase, number & symbol.');
        return;
    }

    showMessage('reg-msg', 'Creating account...', false);

    try {
        const res = await apiFetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('reg-msg', 'Account created! Redirecting to login...', false);
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
