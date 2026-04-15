function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('register-form').classList.add('active');
    }
}

// Handle Login API
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const msgEl = document.getElementById('login-msg');
    
    msgEl.className = 'success-msg';
    msgEl.style.color = 'var(--text-secondary)';
    msgEl.innerText = 'Authenticating...';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            msgEl.className = 'success-msg';
            msgEl.style.color = 'var(--neon-green)';
            msgEl.innerText = 'Login successful! Redirecting...';
            // Save token and user details to local storage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            // Redirect to home
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        } else {
            msgEl.className = 'error-msg';
            msgEl.style.color = '#ff4c4c';
            msgEl.innerText = data.message || 'Login failed';
        }
    } catch (err) {
        msgEl.className = 'error-msg';
        msgEl.style.color = '#ff4c4c';
        msgEl.innerText = 'Server error. Make sure the Node.js API is running!';
    }
});

// Handle Register API
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const msgEl = document.getElementById('reg-msg');
    
    msgEl.className = 'success-msg';
    msgEl.style.color = 'var(--text-secondary)';
    msgEl.innerText = 'Creating account...';

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            msgEl.className = 'success-msg';
            msgEl.style.color = 'var(--neon-green)';
            msgEl.innerText = 'Registration successful! You can now login.';
            // Switch to login tab safely after 2 seconds
            setTimeout(() => { switchTab('login'); document.getElementById('login-email').value = email; }, 2000);
        } else {
            msgEl.className = 'error-msg';
            msgEl.style.color = '#ff4c4c';
            msgEl.innerText = data.message || 'Registration failed';
        }
    } catch (err) {
        msgEl.className = 'error-msg';
        msgEl.style.color = '#ff4c4c';
        msgEl.innerText = 'Server error. Make sure the Node.js API is running!';
    }
});
