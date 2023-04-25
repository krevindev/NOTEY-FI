const express = require('express');
const NodeCache = require('node-cache');

const app = express();

// Create a new cache instance with a file-based storage
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120, useClones: false, file: 'cacheFile.json' });

app.use(express.json()); // Enable JSON request body parsing

// Middleware for caching
app.use((req, res, next) => {
    // Check if data is already in cache
    const data = cache.get(req.url);
    if (data) {
        // Retrieve data from cache and send response
        return res.json(data);
    } else {
        // If data is not in cache, proceed to the next middleware or route
        next();
    }
});

// Route handler for adding data to cache
app.post('/add_data', (req, res) => {
    // Fetch data from request body
    const key = req.body.key;
    const value = req.body.value;

    // Store data in cache with the specified key and value
    cache.set(key, value);

    // Send response
    res.json({ message: 'Data added to cache successfully' });
});

// Route handler for retrieving data from cache
app.get('/data/:key', (req, res) => {
    // Retrieve data from cache with the specified key
    const key = req.params.key;
    const value = cache.get(key);

    if (value) {
        // If data is found in cache, send response
        res.json(value);
    } else {
        // If data is not found in cache, send error response
        res.status(404).json({ error: 'Data not found in cache' });
    }
});

// Route handler to retrieve and display all data from cache
app.get('/allData', (req, res) => {
    // Get all the keys from cache
    const keys = cache.keys();
  
    // Retrieve all data from cache using keys
    const allData = cache.mget(keys);
  
    // Send response
    res.json(allData);
  });

// Start the Express server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

