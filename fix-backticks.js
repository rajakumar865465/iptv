const fs = require('fs');
const path = require('path');
const f1 = path.join('backend', 'src', 'controllers', 'scannerController.js');
const f2 = path.join('backend', 'src', 'controllers', 'brokenChannelController.js');
const f3 = path.join('backend', 'src', 'controllers', 'adminChannelManagementController.js');
[f1, f2, f3].forEach(f => {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/\\`/g, '`');
    fs.writeFileSync(f, text);
    console.log('Fixed', f);
  }
});
