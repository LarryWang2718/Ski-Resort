const fs = require('fs');

const data = JSON.parse(fs.readFileSync('skiresorts.json', 'utf-8'));
const tagCounts = {};
const maxElements = 10000; // Limit for performance
let aerialwayCount = 0;

for (let i = 0; i < Math.min(data.elements.length, maxElements); i++) {
  const el = data.elements[i];
  if (el.tags) {
    for (const key of Object.keys(el.tags)) {
      tagCounts[key] = (tagCounts[key] || 0) + 1;
    }
    if (el.tags.aerialway) aerialwayCount++;
  }
}

// Sort tags by frequency
const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
console.log('Most common tag keys (top 30):');
for (let i = 0; i < Math.min(sorted.length, 30); i++) {
  console.log(`${sorted[i][0]}: ${sorted[i][1]}`);
}
console.log(`\nNumber of elements with 'aerialway' tag: ${aerialwayCount}`); 