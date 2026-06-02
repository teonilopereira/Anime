const fs = require('fs');

function replaceProgressStorage(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace localStorage calls for specific progress keys
    // We can replace localStorage.getItem(key) with a helper function if needed, 
    // but the easiest is to just replace localStorage.setItem, getItem, removeItem, key, length 
    // inside the progress loops and specifically when dealing with keys like `u:${userId}` or volumeStorageKey
    
    // Instead of complex AST, let's just make a simple wrapper in those files or replace specific lines.
    // Let's replace 'localStorage' with 'UserStore' EXCEPT for 'pref:' and 'currentUser'
    
    content = content.replace(/localStorage\.getItem\('pref:/g, "localStorage.getItem('pref:");
    content = content.replace(/localStorage\.getItem\('currentUser'\)/g, "localStorage.getItem('currentUser')");
    
    // A safer way: replace localStorage with UserStore everywhere, and then revert the known ones
    content = content.replace(/localStorage/g, 'UserStore');
    content = content.replace(/UserStore\.getItem\('pref:/g, "localStorage.getItem('pref:");
    content = content.replace(/UserStore\.getItem\('currentUser'\)/g, "localStorage.getItem('currentUser')");
    
    // If there's any other generic pref, it might break. Let's check script.js
    
    fs.writeFileSync(filePath, content);
}

replaceProgressStorage('Js/detalle.js');
replaceProgressStorage('Js/script.js');
// Check mis-listas.js as well
if (fs.existsSync('Js/mis-listas.js')) {
    replaceProgressStorage('Js/mis-listas.js');
}
if (fs.existsSync('Js/usuario.js')) {
    replaceProgressStorage('Js/usuario.js');
}

console.log('Done');
