const fs = require('fs');
const path = require('path');

console.log('=== STARTING AUTOMATED SECURITY AUDIT ===\n');

function getAllFiles(dir, exts = ['.js', '.ts', '.tsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file === '.next' || file === 'build') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (exts.some(ext => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const backendFiles = getAllFiles(path.join(__dirname, '../src'));
const issues = [];

// 1. Check for SQL Injection risks in db.query
console.log('1. Checking for SQL string interpolation in db.query()...');
for (const file of backendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let inQuery = false;
  let querySnippet = '';
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('db.query(`') || line.includes('client.query(`')) {
      inQuery = true;
      querySnippet = line;
      startLine = i + 1;
    } else if (inQuery) {
      querySnippet += '\n' + line;
      if (line.includes('`')) {
        inQuery = false;
        // Check if query contains ${...}
        const interpolations = querySnippet.match(/\$\{([^}]+)\}/g);
        if (interpolations) {
          // Check what is interpolated
          for (const interp of interpolations) {
            // Safe interpolations: column names from whitelists, integer conversions, conditions.join, etc.
            issues.push({
              type: 'SQL_INTERPOLATION',
              file: path.relative(process.cwd(), file),
              line: startLine,
              snippet: interp,
              context: querySnippet.slice(0, 150).replace(/\s+/g, ' ')
            });
          }
        }
      }
    }
  }
}

// 2. Check for Information Disclosure (err.message or err.stack in responses)
console.log('2. Checking for Information Disclosure in error responses...');
for (const file of backendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((line.includes('err.message') || line.includes('err.stack')) &&
        (line.includes('res.status(') || line.includes('res.json(') || line.includes('error(res,'))) {
      // Check if guarded by development environment
      if (!line.includes("process.env.NODE_ENV === 'development'") && !line.includes('getPublicErrorMessage')) {
        issues.push({
          type: 'INFO_DISCLOSURE',
          file: path.relative(process.cwd(), file),
          line: i + 1,
          snippet: line.trim()
        });
      }
    }
  }
}

// 3. Check for SSRF / Unvalidated URL fetching
console.log('3. Checking for SSRF / unvalidated URL fetching (fetch, axios, http.get)...');
for (const file of backendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((line.includes('fetch(') || line.includes('axios.get(') || line.includes('axios.post(')) &&
        !line.includes('http://127.0.0.1') && !line.includes('https://api.razorpay.com') && !line.includes('google')) {
      issues.push({
        type: 'EXTERNAL_FETCH',
        file: path.relative(process.cwd(), file),
        line: i + 1,
        snippet: line.trim().slice(0, 100)
      });
    }
  }
}

// 4. Check for Hardcoded Secrets or Weak Defaults
console.log('4. Checking for Hardcoded Secrets or Weak Defaults...');
for (const file of backendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/(secret|password|jwt_secret)\s*[:=]\s*['"][^'"]+['"]/i) &&
        !line.includes('process.env') && !line.includes('dummy') && !line.includes('SENSITIVE_FIELDS')) {
      issues.push({
        type: 'HARDCODED_SECRET',
        file: path.relative(process.cwd(), file),
        line: i + 1,
        snippet: line.trim()
      });
    }
  }
}

console.log(`\nAudit completed. Found ${issues.length} potential points to inspect.`);
console.log(JSON.stringify(issues, null, 2));
