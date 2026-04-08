const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend files
app.use(express.static('public'));

// Proxy route for GeoServer WFS requests
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