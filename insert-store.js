const fs = require('fs');
const path = require('path');

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if user-store.js is already included
    if (content.includes('user-store.js')) continue;

    // We want to insert user-store.js right before auth.js or script.js
    // Let's replace <script src="js/core/auth.js" defer></script>
    // with <script src="Js/core/user-store.js" defer></script>\n    <script src="js/core/auth.js" defer></script>
    
    // Some files might use Js/ or js/
    content = content.replace(/<script src=["']js\/core\/auth\.js["'] defer><\/script>/i, 
        '<script src="Js/core/user-store.js" defer></script>\n    <script src="js/core/auth.js" defer></script>');
        
    fs.writeFileSync(fullPath, content);
    console.log('Updated ' + file);
}
