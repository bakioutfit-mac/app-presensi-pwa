const fs = require('fs');
let content = fs.readFileSync('components/tabs/owner/OwnerMonitoringTab.js', 'utf8');
content = content.replace(
  '// ================= 1. MONITORING STATE =================',
  `// ================= 1. MONITORING STATE =================
  const safeOutlets = outlets || [{ id: 1, name: 'LazyBloom' }, { id: 2, name: 'Deru Ombak' }, { id: 3, name: 'Sea Cafe' }];`
);
fs.writeFileSync('components/tabs/owner/OwnerMonitoringTab.js', content);
