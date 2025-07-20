const fs = require('fs');

const clusters = JSON.parse(fs.readFileSync('cluster_with_center.json'));
const filtered = clusters.filter(cluster => Array.isArray(cluster.members) && cluster.members.length > 1);

fs.writeFileSync('clusters_multi_member.json', JSON.stringify(filtered, null, 2));
console.log(`Filtered to ${filtered.length} clusters with more than 1 member. Output: clusters_multi_member.json`); 