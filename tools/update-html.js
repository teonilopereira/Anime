const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('Js/core/auth.js')) {
        // Find <script src="Js/script.js"></script> and insert new scripts before it
        content = content.replace(
            /<script src="Js\/script\.js"><\/script>/gi,
            '<script src="Js/core/auth.js"></script>\n    <script src="Js/core/progress.js"></script>\n    <script src="Js/ui-effects.js"></script>\n    <script src="Js/script.js"></script>'
        );
        
        // Also check if they only had api.js or datos.js and no script.js, we might need to insert them somewhere else.
        // But let's assume they all have script.js.
        fs.writeFileSync(f, content);
        console.log('Updated ' + f);
    }
});
