const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');

    // 1. Add id and display:none to Admin link
    content = content.replace(
        /<li><a href="admin\.html"( class=".*?")?>Admin<\/a><\/li>/g,
        '<li id="nav-admin" style="display:none;"><a href="admin.html"$1>Admin</a></li>'
    );

    // 2. Inject authorization check for Admin link in checkAuth()
    const checkAuthAuthNavItem = /if\s*\(token\s*&&\s*user\s*&&\s*authNavItem\)\s*\{/;
    if (checkAuthAuthNavItem.test(content) && !content.includes('nav-admin')) {
        const adminLogic = `
            const adminNavItem = document.getElementById('nav-admin');
            if (adminNavItem && user.email === 'admin@makercircuit.com') {
                adminNavItem.style.display = 'inline-block';
            }
            if (token && user && authNavItem) {`;
        
        content = content.replace(checkAuthAuthNavItem, adminLogic);
    }

    fs.writeFileSync(path.join(dir, file), content);
    console.log(`Updated ${file}`);
});
