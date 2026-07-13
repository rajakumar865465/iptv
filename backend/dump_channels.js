const jwt = require('jsonwebtoken');
const fs = require('fs');

const secret = 'f9a8b1c4e7d6f5a3b2c1d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8';
const token = jwt.sign({ userId: 1, email: 'admin@tangotv.in', role: 'admin' }, secret, { expiresIn: '1h' });

fetch('http://35.174.78.33:5000/api/internal/channels?limit=5000', {
  headers: { Authorization: `Bearer ${token}` }
})
  .then(r => r.json())
  .then(data => {
    if (!data.data || !Array.isArray(data.data)) {
      console.error('Invalid response:', data);
      return;
    }
    
    const channels = data.data;
    
    // Group by category and status
    let working = '';
    let notWorking = '';
    
    const cats = {};
    for (const c of channels) {
      const cat = c.category_name || 'Uncategorized';
      if (!cats[cat]) cats[cat] = { working: [], notWorking: [] };
      
      const isWorking = c.health_status === 'online' || c.health_status === 'working' || c.status === 'active';
      // actually, health_status is online, offline, unstable
      if (c.health_status === 'online' || c.health_status === 'working') {
        cats[cat].working.push(c.name);
      } else {
        cats[cat].notWorking.push(`${c.name} (${c.health_status})`);
      }
    }
    
    // Format output
    for (const [cat, data] of Object.entries(cats)) {
      if (data.working.length > 0) {
        working += `\n--- ${cat} (${data.working.length} channels) ---\n`;
        working += data.working.join('\n') + '\n';
      }
      
      if (data.notWorking.length > 0) {
        notWorking += `\n--- ${cat} (${data.notWorking.length} channels) ---\n`;
        notWorking += data.notWorking.join('\n') + '\n';
      }
    }
    
    fs.writeFileSync('c:/Users/deba_pc.com/OneDrive/Desktop/iptv/working_channels.txt', working);
    fs.writeFileSync('c:/Users/deba_pc.com/OneDrive/Desktop/iptv/not_working_channels.txt', notWorking);
    
    console.log('Saved working_channels.txt and not_working_channels.txt');
    console.log(`Total Working: ${channels.filter(c => c.health_status === 'online' || c.health_status === 'working').length}`);
    console.log(`Total Not Working: ${channels.filter(c => c.health_status !== 'online' && c.health_status !== 'working').length}`);
  })
  .catch(console.error);
