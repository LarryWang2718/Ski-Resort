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
    // Convert location_coordinate from string to object format
    const locationCoordinate = coords ? {
        lat: String(coords.lat),
        long: String(coords.lon) // Note: database uses 'long' not 'lon'
    } : null;
    
    return {
        ...resort,
        location_coordinate: locationCoordinate || resort.location_coordinate, // Use parsed coords if available
        __coords: coords, // Keep for distance calculations
        members: []
    };
});

// Only consider way elements (trails and lifts need full geometry paths)
// Nodes are skipped as they don't represent trails/lifts
const ways = elements.filter(el =>
    el.type === 'way' && 
    el.geometry && 
    Array.isArray(el.geometry) && 
    el.geometry.length > 0
);

console.log(`Processing ${ways.length} way elements for ${resortsWithCoords.length} resorts...`);

// Configuration for clustering algorithm
const MAX_DISTANCE_KM = 10; // Maximum distance to consider a resort
const DENSITY_RADIUS_KM = 2; // Radius to check for nearby ways (cluster detection)
const DENSITY_WEIGHT = 0.5; // How much to weight density vs distance (0-1, higher = more weight on density)
const MIN_DENSITY_BONUS = 0.3; // Minimum distance reduction per nearby way (km)

// Helper function to calculate way center (average of all points for better accuracy)
function calculateWayCenter(way) {
    if (!way.geometry || way.geometry.length === 0) {
        if (way.center) {
            return [way.center.lon, way.center.lat];
        }
        return null;
    }
    
    // Calculate centroid (average of all points) for better accuracy
    let sumLon = 0, sumLat = 0;
    for (const point of way.geometry) {
        sumLon += point.lon;
        sumLat += point.lat;
    }
    return [sumLon / way.geometry.length, sumLat / way.geometry.length];
}

// Helper function to count nearby ways already assigned to a resort
function countNearbyWays(wayCenter, resortMembers, radiusKm) {
    if (!wayCenter || !resortMembers || resortMembers.length === 0) return 0;
    
    let count = 0;
    for (const member of resortMembers) {
        if (!member.geometry || !Array.isArray(member.geometry)) continue;
        
        const memberCenter = calculateWayCenter(member);
        if (!memberCenter) continue;
        
        const distance = turf.distance(
            turf.point(wayCenter),
            turf.point(memberCenter),
            { units: 'kilometers' }
        );
        
        if (distance <= radiusKm) {
            count++;
        }
    }
    return count;
}

// Prepare ways with their centers
const waysToProcess = ways.map(way => ({
    way,
    center: calculateWayCenter(way)
})).filter(w => w.center !== null);

console.log(`Calculating scores for ${waysToProcess.length} ways...`);

// Phase 1: Calculate initial scores (distance-based only for initial sort)
const initialScores = [];
for (const { way, center: wayCenter } of waysToProcess) {
    let bestResort = null;
    let minDistance = Infinity;
    
    // Find closest resort for initial ordering
    for (const resort of resortsWithCoords) {
        if (!resort.__coords) continue;
        
        const distance = turf.distance(
            turf.point(wayCenter),
            turf.point([resort.__coords.lon, resort.__coords.lat]),
            { units: 'kilometers' }
        );
        
        if (distance <= MAX_DISTANCE_KM && distance < minDistance) {
            minDistance = distance;
            bestResort = resort;
        }
    }
    
    if (bestResort) {
        initialScores.push({
            way,
            wayCenter,
            initialDistance: minDistance
        });
    }
}

// Sort by initial distance (closest ways get processed first, building clusters naturally)
initialScores.sort((a, b) => a.initialDistance - b.initialDistance);

console.log(`Processing ${initialScores.length} ways with density-weighted clustering...`);

// Phase 2: Assign with density weighting (iterative - density builds as we assign)
let assignedCount = 0;
for (const { way, wayCenter } of initialScores) {
    let bestResort = null;
    let bestScore = Infinity;
    
    // Calculate density-weighted score for each resort
    for (const resort of resortsWithCoords) {
        if (!resort.__coords) continue;
        
        // Base distance to resort
        const distanceToResort = turf.distance(
            turf.point(wayCenter),
            turf.point([resort.__coords.lon, resort.__coords.lat]),
            { units: 'kilometers' }
        );
        
        // Skip if too far
        if (distanceToResort > MAX_DISTANCE_KM) continue;
        
        // Count nearby ways already assigned to this resort (density check)
        const nearbyWaysCount = countNearbyWays(wayCenter, resort.members, DENSITY_RADIUS_KM);
        
        // Density bonus: reduce effective distance based on nearby ways
        // More nearby ways = stronger cluster = better match
        const densityBonus = nearbyWaysCount * MIN_DENSITY_BONUS;
        
        // Weighted score: combine distance and density
        // Formula: score = distance - (density_bonus * weight)
        // Lower score = better match
        const score = distanceToResort - (densityBonus * DENSITY_WEIGHT);
        
        if (score < bestScore) {
            bestScore = score;
            bestResort = resort;
        }
    }
    
    // Assign to best resort
    if (bestResort) {
        bestResort.members.push({
            type: way.type,
            id: way.id,
            tags: way.tags || {},
            geometry: way.geometry
        });
        assignedCount++;
        
        // Progress indicator for large datasets
        if (assignedCount % 1000 === 0) {
            console.log(`  Assigned ${assignedCount}/${initialScores.length} ways...`);
        }
    }
}

// Log statistics
console.log(`\nAssignment complete:`);
for (const resort of resortsWithCoords) {
    if (resort.members.length > 0) {
        console.log(`  ${resort.name}: ${resort.members.length} ways`);
    }
}

// Remove __coords helper property
const outputResorts = resortsWithCoords.map(r => {
    const { __coords, ...rest } = r;
    return rest;
});

fs.writeFileSync('ski-resorts-with-members.json', JSON.stringify(outputResorts, null, 2));
console.log(`Merged nodes/ways into ski resorts. Output: ski-resorts-with-members.json`); 