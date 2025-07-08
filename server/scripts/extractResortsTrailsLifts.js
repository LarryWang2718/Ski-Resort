const fs = require('fs');

// Load the OSM data
const data = JSON.parse(fs.readFileSync('skiresorts.json', 'utf-8'));
const elementsById = {};
for (const el of data.elements) {
  elementsById[el.id] = el;
}

const resorts = [];
const memberTypeRoleSet = new Set();
let missingRefs = 0;
let totalMembers = 0;

for (const rel of data.elements) {
  if (rel.type !== 'relation') continue;
  if (!rel.tags || rel.tags['piste:type'] !== 'downhill' || !rel.tags.name) continue;

  const resort = {
    name: rel.tags.name,
    tags: rel.tags,
    center: rel.center || null,
    trails: [],
    lifts: []
  };

  if (rel.members) {
    for (const member of rel.members) {
      totalMembers++;
      memberTypeRoleSet.add(`${member.type}:${member.role}`);
      const el = elementsById[member.ref];
      if (!el || !el.tags) {
        missingRefs++;
        continue;
      }
      // Trails: piste:type=downhill
      if (el.tags['piste:type'] === 'downhill') {
        resort.trails.push({
          name: el.tags.name || null,
          id: el.id,
          tags: el.tags,
          geometry: el.geometry || null,
          nodes: el.nodes || null
        });
      }
      // Lifts: aerialway=*
      if (el.tags.aerialway) {
        resort.lifts.push({
          name: el.tags.name || null,
          id: el.id,
          tags: el.tags,
          geometry: el.geometry || null,
          nodes: el.nodes || null
        });
      }
    }
  }
  resorts.push(resort);
}

fs.writeFileSync('resorts_trails_lifts.json', JSON.stringify(resorts, null, 2));
console.log(`Extracted ${resorts.length} resorts with trails and lifts to resorts_trails_lifts.json`);

// Print unique member types and roles
console.log('\nUnique member type:role combinations in resort relations:');
for (const entry of memberTypeRoleSet) {
  console.log(entry);
}

// Report missing references
console.log(`\nTotal member references: ${totalMembers}`);
console.log(`Missing member references in elementsById: ${missingRefs}`); 