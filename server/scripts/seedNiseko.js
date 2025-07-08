// scripts/seedNiseko.js
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');
const User = require('../models/User');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for seeding...');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Niseko United Resort Data
const nisekoResortData = {
  name: "Niseko United",
  slug: "niseko-united",
  description: "Japan's premier powder skiing destination with four interconnected resort areas on Mt. Annupuri, offering world-class skiing and the deepest powder snow on Earth.",
  
  location: {
    country: "Japan",
    region: "Hokkaido",
    city: "Kutchan",
    coordinates: {
      latitude: 42.8048,
      longitude: 140.6874
    },
    timezone: "Asia/Tokyo"
  },
  
  stats: {
    totalTrails: 61,
    totalLifts: 32,
    skiableArea: {
      hectares: 800,
      acres: 2000
    },
    elevationBase: 255,
    elevationSummit: 1188,
    verticalDrop: 933,
    longestRun: 5.6, // km
    averageSnowfall: 590 // inches per year
  },
  
  trailDistribution: {
    beginner: {
      percentage: 30,
      kilometers: 22.4
    },
    intermediate: {
      percentage: 40,
      kilometers: 18.2
    },
    advanced: {
      percentage: 30,
      kilometers: 10.2
    }
  },
  
  season: {
    typicalOpen: "2024-12-05",
    typicalClose: "2025-05-06",
    operatingHours: {
      start: "08:30",
      end: "20:30",
      nightSkiing: true
    }
  },
  
  currency: "JPY",
  currentPricing: {
    adultFullDay: 10500,
    youthFullDay: 8900,
    childFullDay: 6300,
    season: "2024-25",
    lastUpdated: new Date()
  },
  
  website: "https://niseko.ne.jp/en/",
  bookingUrls: [
    {
      name: "Official Niseko United",
      url: "https://niseko.ne.jp/en/online-liftpass/",
      description: "Direct booking from Niseko United official website"
    },
    {
      name: "Klook",
      url: "https://www.klook.com/en-US/activity/1685-niseko-ski-pass/",
      description: "Book through Klook with instant confirmation"
    }
  ],
  
  images: [
    {
      url: "https://niseko.ne.jp/images/hero-winter.jpg",
      caption: "Niseko United powder skiing with Mt. Yotei in background",
      type: "hero"
    },
    {
      url: "https://niseko.ne.jp/images/trail-map.jpg",
      caption: "Niseko United trail map showing all four areas",
      type: "trail-map"
    }
  ],
  
  trailMapUrl: "https://niseko.ne.jp/en/map/",
  
  areas: [
    {
      name: "Grand Hirafu",
      description: "The largest area with the most extensive night skiing in Japan",
      lifts: 12,
      trails: 21,
      features: ["night-skiing", "terrain-park", "beginner-friendly"]
    },
    {
      name: "Hanazono",
      description: "Family-friendly area with excellent terrain park",
      lifts: 4,
      trails: 12,
      features: ["terrain-park", "beginner-friendly", "family-area"]
    },
    {
      name: "Niseko Village",
      description: "Quiet area with the longest gondola in the region",
      lifts: 8,
      trails: 16,
      features: ["scenic-views", "beginner-friendly"]
    },
    {
      name: "Annupuri",
      description: "Western area with excellent backcountry access",
      lifts: 6,
      trails: 12,
      features: ["backcountry-access", "expert-terrain"]
    }
  ],
  
  features: [
    "night-skiing", "terrain-park", "backcountry-access", "ski-school",
    "equipment-rental", "restaurants", "accommodation", "high-speed-lifts",
    "snow-making"
  ],
  
  tags: ["powder", "japan", "hokkaido", "night-skiing", "backcountry", "family-friendly"]
};

// Sample Trail Data (representative trails from each area)
const nisekoTrailsData = [
  // Grand Hirafu Area
  {
    name: "Family Run",
    resortArea: "Grand Hirafu",
    difficulty: "beginner",
    status: "open",
    conditions: "excellent",
    length: 1500,
    verticalDrop: 180,
    groomingType: "groomed",
    features: ["beginner-friendly", "night-skiing", "wide-open"],
    description: "Perfect beginner slope with gentle gradient and night skiing",
    operatingHours: {
      start: "08:30",
      end: "20:30",
      nightSkiing: true
    },
    popularityScore: 8
  },
  {
    name: "Hirafu Zawa",
    resortArea: "Grand Hirafu",
    difficulty: "intermediate",
    status: "open",
    conditions: "good",
    length: 2800,
    verticalDrop: 400,
    groomingType: "groomed",
    features: ["night-skiing", "scenic-views"],
    description: "Long intermediate run with beautiful views of Mt. Yotei",
    operatingHours: {
      start: "08:30",
      end: "20:30",
      nightSkiing: true
    },
    popularityScore: 7
  },
  {
    name: "Shirakaba Course",
    resortArea: "Grand Hirafu",
    difficulty: "advanced",
    status: "open",
    conditions: "excellent",
    length: 1800,
    verticalDrop: 350,
    groomingType: "ungroomed",
    features: ["trees", "powder", "steep-sections"],
    description: "Challenging tree run through birch forests",
    popularityScore: 9
  },
  
  // Hanazono Area  
  {
    name: "Strawberry Fields",
    resortArea: "Hanazono",
    difficulty: "beginner",
    status: "open",
    conditions: "good",
    length: 1200,
    verticalDrop: 120,
    groomingType: "groomed",
    features: ["beginner-friendly", "family-run", "wide-open"],
    description: "Wide, gentle slope perfect for beginners and families",
    popularityScore: 6
  },
  {
    name: "Hanazono Park",
    resortArea: "Hanazono",
    difficulty: "intermediate",
    status: "open",
    conditions: "excellent",
    length: 800,
    verticalDrop: 150,
    groomingType: "groomed",
    features: ["terrain-park", "halfpipe"],
    description: "Terrain park with jumps, rails, and halfpipe",
    popularityScore: 8
  },
  
  // Niseko Village Area
  {
    name: "Cruiser",
    resortArea: "Niseko Village",
    difficulty: "intermediate",
    status: "open",
    conditions: "good",
    length: 3200,
    verticalDrop: 450,
    groomingType: "groomed",
    features: ["scenic-views", "gentle-gradient"],
    description: "Long, gentle cruise with spectacular mountain views",
    popularityScore: 7
  },
  {
    name: "Wonderland",
    resortArea: "Niseko Village",
    difficulty: "advanced",
    status: "open",
    conditions: "excellent",
    length: 1600,
    verticalDrop: 300,
    groomingType: "ungroomed",
    features: ["powder", "trees", "backcountry-access"],
    description: "Off-piste area with deep powder and tree skiing",
    popularityScore: 9
  },
  
  // Annupuri Area
  {
    name: "Junior",
    resortArea: "Annupuri",
    difficulty: "beginner",
    status: "open",
    conditions: "good",
    length: 2200,
    verticalDrop: 200,
    groomingType: "groomed",
    features: ["beginner-friendly", "gentle-gradient"],
    description: "Long, gentle beginner run from top to bottom",
    popularityScore: 6
  },
  {
    name: "Dynamic Course",
    resortArea: "Annupuri",
    difficulty: "advanced",
    status: "open",
    conditions: "excellent",
    length: 2000,
    verticalDrop: 380,
    groomingType: "ungroomed",
    features: ["backcountry-access", "powder", "steep-sections"],
    description: "Challenging off-piste run with backcountry gate access",
    popularityScore: 8
  }
];

// Sample Lift Data
const nisekoLiftsData = [
  // Grand Hirafu Lifts
  {
    name: "Hirafu Gondola",
    resortArea: "Grand Hirafu",
    type: "gondola",
    status: "operational",
    capacity: 2400,
    speed: 180,
    length: 1800,
    verticalRise: 550,
    rideTime: 10,
    seatingCapacity: 8,
    hasWeatherProtection: true,
    operatingHours: {
      start: "08:30",
      end: "20:30",
      nightOperation: true
    },
    features: ["weather-protection", "high-speed", "night-operation"],
    description: "Main gondola providing access to upper mountain and night skiing",
    popularityScore: 9
  },
  {
    name: "Ace Quad #2",
    resortArea: "Grand Hirafu",
    type: "quad-chair",
    status: "operational",
    capacity: 2000,
    speed: 150,
    length: 1200,
    verticalRise: 300,
    rideTime: 8,
    seatingCapacity: 4,
    hasWeatherProtection: false,
    operatingHours: {
      start: "08:30",
      end: "20:30",
      nightOperation: true
    },
    features: ["high-speed", "night-operation"],
    description: "High-speed quad chair serving intermediate terrain",
    popularityScore: 7
  },
  {
    name: "King Quad #4",
    resortArea: "Grand Hirafu",
    type: "single-chair",
    status: "operational",
    capacity: 600,
    speed: 80,
    length: 800,
    verticalRise: 250,
    rideTime: 10,
    seatingCapacity: 1,
    hasWeatherProtection: false,
    operatingHours: {
      start: "08:30",
      end: "16:00",
      nightOperation: false
    },
    features: ["scenic-ride"],
    description: "Single chair accessing peak and backcountry areas",
    popularityScore: 6
  },
  
  // Hanazono Lifts
  {
    name: "Hanazono #1 (Hana1)",
    resortArea: "Hanazono",
    type: "high-speed-six",
    status: "operational",
    capacity: 2800,
    speed: 200,
    length: 1400,
    verticalRise: 400,
    rideTime: 7,
    seatingCapacity: 6,
    hasWeatherProtection: true,
    operatingHours: {
      start: "08:30",
      end: "19:30",
      nightOperation: true
    },
    features: ["weather-protection", "high-speed", "night-operation"],
    description: "High-speed 6-person chairlift with weather protection",
    popularityScore: 8
  },
  
  // Niseko Village Lifts  
  {
    name: "Niseko Village Gondola",
    resortArea: "Niseko Village",
    type: "gondola",
    status: "operational",
    capacity: 2000,
    speed: 160,
    length: 2660,
    verticalRise: 600,
    rideTime: 16,
    seatingCapacity: 8,
    hasWeatherProtection: true,
    operatingHours: {
      start: "08:30",
      end: "16:00",
      nightOperation: false
    },
    features: ["weather-protection", "scenic-ride"],
    description: "Longest gondola in the area with spectacular views",
    popularityScore: 7
  },
  
  // Annupuri Lifts
  {
    name: "Annupuri Gondola",
    resortArea: "Annupuri",
    type: "gondola",
    status: "operational",
    capacity: 1800,
    speed: 150,
    length: 2200,
    verticalRise: 500,
    rideTime: 14,
    seatingCapacity: 6,
    hasWeatherProtection: true,
    operatingHours: {
      start: "08:30",
      end: "16:00", 
      nightOperation: false
    },
    features: ["weather-protection", "scenic-ride"],
    description: "Gondola providing access to Annupuri peak and backcountry",
    popularityScore: 6
  }
];

// Sample admin user
const adminUserData = {
  firstName: "Admin",
  lastName: "User",
  email: "admin@skiresort.com",
  password: "admin123",
  role: "admin",
  location: {
    country: "Japan",
    region: "Hokkaido",
    city: "Kutchan"
  },
  profile: {
    skiLevel: "expert",
    yearsOfExperience: 15
  },
  preferences: {
    preferredCurrency: "JPY",
    language: "en"
  }
};

// Seed function
const seedDatabase = async () => {
  try {
    console.log('🎿 Starting Niseko data seeding...');
    
    // Clear existing data
    console.log('Clearing existing data...');
    await Resort.deleteMany({});
    await Trail.deleteMany({});
    await Lift.deleteMany({});
    await User.deleteMany({});
    
    // Create admin user
    console.log('Creating admin user...');
    const adminUser = await User.create(adminUserData);
    console.log(`✅ Admin user created: ${adminUser.email}`);
    
    // Create Niseko resort
    console.log('Creating Niseko United resort...');
    const nisekoResort = await Resort.create(nisekoResortData);
    console.log(`✅ Resort created: ${nisekoResort.name}`);
    
    // Create trails
    console.log('Creating trails...');
    const trailsWithResort = nisekoTrailsData.map(trail => ({
      ...trail,
      resort: nisekoResort._id
    }));
    
    const trails = await Trail.insertMany(trailsWithResort);
    console.log(`✅ ${trails.length} trails created`);
    
    // Create lifts
    console.log('Creating lifts...');
    const liftsWithResort = nisekoLiftsData.map(lift => ({
      ...lift,
      resort: nisekoResort._id
    }));
    
    const lifts = await Lift.insertMany(liftsWithResort);
    console.log(`✅ ${lifts.length} lifts created`);
    
    // Link trails to lifts (simplified relationships)
    console.log('Creating trail-lift relationships...');
    const gondola = lifts.find(lift => lift.name === "Hirafu Gondola");
    const familyRun = trails.find(trail => trail.name === "Family Run");
    
    if (gondola && familyRun) {
      familyRun.topLifts.push(gondola._id);
      gondola.servesTrails.push(familyRun._id);
      await familyRun.save();
      await gondola.save();
    }
    
    console.log('✅ Trail-lift relationships created');
    
    // Summary
    console.log('\n🎉 Niseko seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   • 1 resort (${nisekoResort.name})`);
    console.log(`   • ${trails.length} trails`);
    console.log(`   • ${lifts.length} lifts`);
    console.log(`   • 1 admin user`);
    console.log('\n🔐 Admin Login:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: admin123`);
    console.log('\n🏔️ You can now test your APIs!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the seeding
const runSeed = async () => {
  await connectDB();
  await seedDatabase();
};

// Only run if called directly
if (require.main === module) {
  runSeed();
}

module.exports = { seedDatabase, runSeed };