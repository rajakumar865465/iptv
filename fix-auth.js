const fs = require('fs');
let content = fs.readFileSync('backend/src/controllers/authController.js', 'utf8');

content = content.replace(
  /if \(\!\/\^\\d\{9,15\}\$\/\.test\(cleanMobile\)\) \{\s*return error\(res, 'Invalid mobile number', 400\);\s*\}/,
  "if (cleanMobile && !/^\\d{9,15}$/.test(cleanMobile)) {\n      return error(res, 'Invalid mobile number', 400);\n    }"
);

// We should also modify the uniqueness check:
// email = $1 OR mobile = $2 -> only check mobile if provided
content = content.replace(
  /SELECT id FROM users WHERE email = \$1 OR mobile = \$2 LIMIT 1/,
  "SELECT id FROM users WHERE email = $1 OR (mobile = $2 AND mobile != '') LIMIT 1"
);

fs.writeFileSync('backend/src/controllers/authController.js', content);
