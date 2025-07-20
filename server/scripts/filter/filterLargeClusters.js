const fs = require('fs');

const clusters = JSON.parse(fs.readFileSync('clusters_with_nodes.json'));

// Filter clusters with 10 or more elements
const largeClusters = clusters.filter(cluster => cluster.members.length >= 10);

fs.writeFileSync('clusters_large.json', JSON.stringify(largeClusters, null, 2));
console.log(`Filtered to ${largeClusters.length} clusters with 10+ elements. Output: clusters_large.json`);
console.log(`Original clusters: ${clusters.length}`);
console.log(`Removed: ${clusters.length - largeClusters.length} clusters`); 