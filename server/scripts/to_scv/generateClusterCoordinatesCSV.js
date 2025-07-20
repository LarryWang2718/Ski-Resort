const fs = require('fs');

const clusters = JSON.parse(fs.readFileSync('clusters_large.json'));

// Create CSV content
let csvContent = 'id,longitude,latitude\n';

for (const cluster of clusters) {
    if (cluster.lon !== null && cluster.lat !== null) {
        csvContent += `${cluster.id},${cluster.lon},${cluster.lat}\n`;
    }
}

fs.writeFileSync('cluster_coordinates.csv', csvContent);
console.log(`Generated CSV with ${clusters.length} cluster coordinates. Output: cluster_coordinates.csv`); 