const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import models
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');

const importData = async () => {
  try {
    // Connect to local MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skiResortDB';
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB: ${MONGODB_URI}`);

    // Read the JSON file
    const dataPath = path.join(__dirname, '../db/ski-resorts-with-members.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const resortsData = JSON.parse(rawData);

    console.log(`Found ${resortsData.length} resorts to import`);

    // Clear existing data
    await Resort.deleteMany({});
    await Trail.deleteMany({});
    await Lift.deleteMany({});
    console.log('Cleared existing data');

    let totalTrails = 0;
    let totalLifts = 0;

    // Process each resort
    for (let i = 0; i < resortsData.length; i++) {
      const resortData = resortsData[i];
      console.log(`Processing resort ${i + 1}/${resortsData.length}: ${resortData.name}`);

      // Create resort document (without members array for now)
      const resortDoc = {
        rank: resortData.rank,
        name: resortData.name,
        rating: resortData.rating,
        url: resortData.url,
        location_coordinate: resortData.location_coordinate,
        location_country: resortData.location_country,
        location_region: resortData.location_region,
        elevation_top_m: resortData.elevation_top_m,
        elevation_difference_m: resortData.elevation_difference_m,
        total_slope_length_km: resortData.total_slope_length_km,
        number_of_lifts: resortData.number_of_lifts,
        number_of_slopes: resortData.number_of_slopes,
        annual_snowfall_cm: resortData.annual_snowfall_cm,
        number_of_matches: resortData.number_of_matches,
        members: [] // Will be populated after creating trails and lifts
      };

      // Save resort and get its ObjectId
      const resort = new Resort(resortDoc);
      const savedResort = await resort.save();
      const resortId = savedResort._id;

      // Process members (trails and lifts)
      if (resortData.members && Array.isArray(resortData.members)) {
        for (const member of resortData.members) {
          try {
            // Only process 'way' elements, skip 'node' elements (stations, pylons, etc.)
            if (member.type !== 'way') {
              continue;
            }

            // Extract coordinates from center object for way elements
            const longitude = member.center ? member.center.lon : null;
            const latitude = member.center ? member.center.lat : null;

            // Determine if this is a trail or lift based on tags
            const tags = member.tags || {};
            let memberType = null;
            let memberData = null;

            // Check if it's a lift (aerialway)
            if (tags.aerialway && tags.aerialway !== 'station') {
              memberType = 'lift';
              memberData = {
                name: tags.name || `Lift ${member.id}`,
                aerialway: tags.aerialway,
                capacity: tags['aerialway:capacity'] ? parseInt(tags['aerialway:capacity']) : null,
                duration: tags['aerialway:duration'] ? parseFloat(tags['aerialway:duration']) : null,
                status: tags.operational_status || tags['aerialway:status'] || 'open',
                oneway: tags.oneway === 'yes',
                lit: tags.lit === 'yes',
                length: tags['aerialway:length'] ? parseFloat(tags['aerialway:length']) : null,
                description: tags.description || '',
                longitude: longitude ? parseFloat(longitude) : null,
                latitude: latitude ? parseFloat(latitude) : null,
                resort: resortId
              };
            }
            // Check if it's a trail (piste)
            else if (tags['piste:type'] || tags.piste) {
              memberType = 'trail';
              memberData = {
                name: tags.name || `Trail ${member.id}`,
                pisteType: tags['piste:type'] || tags.piste,
                difficulty: tags['piste:difficulty'] || 'intermediate',
                grooming: tags['piste:grooming'] || '',
                status: tags['piste:status'] || 'open',
                lit: tags['piste:lit'] === 'yes',
                oneway: tags['piste:oneway'] === 'yes',
                abandoned: tags['piste:abandoned'] === 'yes',
                gladed: tags.gladed === 'yes',
                patrolled: tags.patrolled !== 'no',
                groomingPriority: tags['piste:grooming:priority'] ? parseInt(tags['piste:grooming:priority']) : null,
                description: tags.description || '',
                longitude: longitude ? parseFloat(longitude) : null,
                latitude: latitude ? parseFloat(latitude) : null,
                resort: resortId
              };
            }

            // Save the member if we determined its type
            if (memberType && memberData) {
              let savedMember;
              if (memberType === 'lift') {
                const lift = new Lift(memberData);
                savedMember = await lift.save();
                totalLifts++;
              } else if (memberType === 'trail') {
                const trail = new Trail(memberData);
                savedMember = await trail.save();
                totalTrails++;
              }

              // Add reference to resort's members array
              if (savedMember) {
                resort.members.push({
                  refId: savedMember._id,
                  refType: memberType
                });
              }
            }
          } catch (error) {
            console.error(`Error processing member ${member.id}:`, error.message);
          }
        }

        // Update resort with the members array
        await Resort.findByIdAndUpdate(resortId, { members: resort.members });
      }

      console.log(`Completed resort ${i + 1}: ${resortData.name} (${resort.members.length} members)`);
    }

    console.log('\n=== Import Summary ===');
    console.log(`Total resorts imported: ${resortsData.length}`);
    console.log(`Total trails created: ${totalTrails}`);
    console.log(`Total lifts created: ${totalLifts}`);

    // Verify the import
    const resortCount = await Resort.countDocuments();
    const trailCount = await Trail.countDocuments();
    const liftCount = await Lift.countDocuments();

    console.log('\n=== Database Verification ===');
    console.log(`Resorts in database: ${resortCount}`);
    console.log(`Trails in database: ${trailCount}`);
    console.log(`Lifts in database: ${liftCount}`);

    console.log('\nImport completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
};

// Run the import
importData(); 