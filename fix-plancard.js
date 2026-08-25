const fs = require('fs');
const file = 'frontend/src/components/public/PlanCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const newFormat = `function formatDuration(days: number) {
  if (days >= 365) return 'Annual Plan';
  if (days === 180) return '6-Month Plan';
  if (days === 90) return 'Quarterly Plan';
  if (days === 30) return 'Monthly Plan';
  if (days === 7) return 'Weekly Plan';

  const y = Math.round(days / 365);
  const m = Math.round(days / 30);
  if (days > 365) return String(y) + ' Years';
  if (days > 30) return String(m) + ' Months';
  return String(days) + ' Days';
}`;

content = content.replace(
  /function formatDuration\(days: number\) \{[\s\S]*?return String\(days\) \+ ' Day' \+ \(days !== 1 \? 's' : ''\);\n\}/,
  newFormat
);

fs.writeFileSync(file, content);
