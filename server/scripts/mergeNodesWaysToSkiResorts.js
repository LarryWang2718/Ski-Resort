const fs = require('fs');
const turf = require('@turf/turf');

const resorts = JSON.parse(fs.readFileSync('ski-resorts.json'));
const elements = JSON.parse(fs.readFileSync('skiresorts_clean.json')).elements || [];

// Parse coordinates from ski-resorts.json
function parseCoordinates(resort) {
    try {
        const coordString = resort.location_coordinate;
        const cleanString = coordString.replace(/'/g, '"');
        const parsed = JSON.parse(cleanString);
        return {
            lat: parseFloat(parsed.lat),
            lon: parseFloat(parsed.long)
        };
    } catch (error) {
        return null;
    }
}

// Prepare resorts with coordinates and members
const resortsWithCoords = resorts.map((resort, idx) => {
    const coords = parseCoordinates(resort);
    return {
        ...resort,
        __coords: coords,
        members: []
    };
});

// Only consider nodes and ways
const nodesAndWays = elements.filter(el =>
    (el.type === 'node' && typeof el.lon === 'number' && typeof el.lat === 'number') ||
    (el.type === 'way' && el.center && typeof el.center.lon === 'number' && typeof el.center.lat === 'number')
);

// Assign each node/way to the closest resort within 10 km
for (const el of nodesAndWays) {
    let closestResort = null;
    let minDistance = Infinity;
    let elCoords = null;
    if (el.type === 'node') {
        elCoords = [el.lon, el.lat];
    } else if (el.type === 'way') {
        elCoords = [el.center.lon, el.center.lat];
    }
    if (!elCoords) continue;
    for (const resort of resortsWithCoords) {
        if (!resort.__coords) continue;
        const distance = turf.distance(
            turf.point(elCoords),
            turf.point([resort.__coords.lon, resort.__coords.lat]),
            { units: 'kilometers' }
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestResort = resort;
        }
    }
    if (closestResort && minDistance <= 10) {
        if (el.type === 'node') {
            closestResort.members.push({
                type: el.type,
                id: el.id,
                tags: el.tags || {},
                lon: el.lon,
                lat: el.lat
            });
        } else if (el.type === 'way') {
            closestResort.members.push({
                type: el.type,
                id: el.id,
                tags: el.tags || {},
                center: el.center
            });
        }
    }
}

// Remove __coords helper property
const outputResorts = resortsWithCoords.map(r => {
    const { __coords, ...rest } = r;
    return rest;
});

fs.writeFileSync('ski-resorts-with-members.json', JSON.stringify(outputResorts, null, 2));
console.log(`Merged nodes/ways into ski resorts. Output: ski-resorts-with-members.json`); 