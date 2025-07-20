const fs = require('fs');
const https = require('https');

// Function to make HTTPS request
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Function to fetch data from Overpass API
async function fetchOverpassData(query) {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    console.log('Fetching data from Overpass API...');
    const response = await makeRequest(url);
    return JSON.parse(response);
}

async function fetchSkiResortsAndFeatures() {
    try {
        // Query to fetch all ski resort elements
        const query = `
[out:json][timeout:1800];
(
  node["piste:type"="downhill"];
  way["piste:type"="downhill"];
  relation["piste:type"="downhill"];
  node["aerialway"];
  way["aerialway"];
  relation["aerialway"];
);
out center;
`;

        console.log('Executing Overpass query...');
        const data = await fetchOverpassData(query);
        
        // Process the data - just save all elements as they come
        const processedData = {
            elements: data.elements || []
        };

        // Save the processed data
        const outputFile = 'skiresorts_clean.json';
        fs.writeFileSync(outputFile, JSON.stringify(processedData, null, 2));
        
        console.log(`\nData saved to ${outputFile}`);
        console.log(`\nSummary:`);
        console.log(`- Total elements: ${processedData.elements.length}`);
        
        // Count by type
        const relations = processedData.elements.filter(el => el.type === 'relation');
        const ways = processedData.elements.filter(el => el.type === 'way');
        const nodes = processedData.elements.filter(el => el.type === 'node');
        
        console.log(`- Relations: ${relations.length}`);
        console.log(`- Ways: ${ways.length}`);
        console.log(`- Nodes: ${nodes.length}`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run the script
fetchSkiResortsAndFeatures(); 