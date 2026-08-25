const fs = require('fs');
let content = fs.readFileSync('frontend/src/lib/api.ts', 'utf8');

content = content.replace(
  /export const getPlans = \(params\?\: Record<string, unknown>\) =>\s*api\.get\('\/plans', \{ params \}\)\.then\(\(r\) => r\.data\.data\);/,
  "export const getPlans = (params?: Record<string, unknown>) =>\n  api.get('/plans', { params }).then((r) => Array.isArray(r.data.data) ? r.data.data : (r.data.data?.data || []));"
);

fs.writeFileSync('frontend/src/lib/api.ts', content);
