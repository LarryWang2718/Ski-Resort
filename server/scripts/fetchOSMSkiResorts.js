const axios = require('axios');
const fs = require('fs');

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

axios.post('https://overpass-api.de/api/interpreter', query, {
  headers: { 'Content-Type': 'text/plain' }
})
  .then(res => {
    fs.writeFileSync('skiresorts.json', JSON.stringify(res.data, null, 2));
    console.log('Downloaded ski resort and lift data to skiresorts.json');
  })
  .catch(err => {
    console.error('Error fetching data from Overpass API:', err.message);
  }); 