const fs = require('fs');

// Load the OSM data
const data = JSON.parse(fs.readFileSync('skiresorts.json', 'utf-8'));

const trails = [];
const lifts = [];

for (const el of data.elements) {
  // Extract trails: node or way with 'piste:type'
  if ((el.type === 'node' || el.type === 'way') && el.tags && el.tags['piste:type']) {
    trails.push({
      id: el.id,
      type: el.type,
      name: el.tags.name || null,
      tags: el.tags,
      geometry: el.geometry || null,
      nodes: el.nodes || null,
      lat: el.lat || null,
      lon: el.lon || null
    });
  }
  // Extract lifts: node or way with 'aerialway'
  if ((el.type === 'node' || el.type === 'way') && el.tags && el.tags.aerialway) {
    lifts.push({
      id: el.id,
      type: el.type,
      name: el.tags.name || null,
      tags: el.tags,
      geometry: el.geometry || null,
      nodes: el.nodes || null,
      lat: el.lat || null,
      lon: el.lon || null
    });
  }
}

fs.writeFileSync('all_trails_lifts.json', JSON.stringify({ trails, lifts }, null, 2));
console.log(`Extracted ${trails.length} trails and ${lifts.length} lifts to all_trails_lifts.json`); 