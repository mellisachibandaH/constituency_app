const express = require('express'); 
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Proxy route (works only if GeoServer is online and accessible)
app.get('/wfs', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:8081/geoserver/wfs', {
      params: req.query
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});