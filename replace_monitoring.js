const fs = require('fs');

let content = fs.readFileSync('components/AdminOwnerDashboard.js', 'utf8');

// Add import
if (!content.includes("import OwnerMonitoringTab")) {
  content = content.replace(
    "import BrandLogo from './BrandLogo';",
    "import BrandLogo from './BrandLogo';\nimport OwnerMonitoringTab from './tabs/owner/OwnerMonitoringTab';"
  );
}

// Remove the state
const stateStart = content.indexOf('// ================= 1. MONITORING STATE =================');
const stateEnd = content.indexOf('// ================= 1.5 OUTLET CASH REPORTS STATE =================');
if (stateStart !== -1 && stateEnd !== -1) {
  content = content.substring(0, stateStart) + content.substring(stateEnd);
}

// Replace JSX
const jsxStart = content.indexOf("{activeTab === 'monitoring' && (");
const jsxEndStr = "</div>\n        </div>\n      )}";
const jsxEnd = content.indexOf(jsxEndStr, jsxStart) + jsxEndStr.length;

if (jsxStart !== -1 && jsxEnd > jsxStart) {
  content = content.substring(0, jsxStart) + 
    "{activeTab === 'monitoring' && (\n        <OwnerMonitoringTab \n          user={user}\n          outlets={outlets}\n          selectedOutlet={selectedOutlet}\n          setSelectedOutlet={setSelectedOutlet}\n          showToast={showToast}\n        />\n      )}" + 
    content.substring(jsxEnd);
}

fs.writeFileSync('components/AdminOwnerDashboard.js', content);
console.log("Monitoring tab extracted and replaced.");
