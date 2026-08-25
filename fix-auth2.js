const fs = require('fs');
let content = fs.readFileSync('backend/src/controllers/authController.js', 'utf8');

content = content.replace(
  /'SELECT id FROM users WHERE email = \$1 OR mobile = \$2',/,
  "'SELECT id FROM users WHERE email = $1 OR (mobile = $2 AND $2 != \\'\\')',"
);

fs.writeFileSync('backend/src/controllers/authController.js', content);
