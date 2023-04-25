const express = require('express');
const NodeCache = require('node-cache');

const cacheRouter = express();

// Create a new cache instance with a file-based storage
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120, useClones: false, file: 'cacheFile.json' });

cacheRouter.use(express.json()); // Enable JSON request body parsing

// Middleware for caching
cacheRouter.use((req, res, next) => {
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

cacheRouter.put('/update_data/:key', (req, res) => {
    const key = req.body.key;
    const newValue = req.body.value;

    console.log('BODY:')
    console.log(req)


    try {
        const existing = cache.get(key);

        if (existing) {
            const updatedValue = { ...existingValue, ...newValue };
            cache.set(key, updatedValue);
            res.json({ message: 'Date updated in cache successfully!' });
        } else {
            res.status(404).json({ error: 'Data not found in cache' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to update data in cache' });
    }
})

// Route handler for adding data to cache
cacheRouter.post('/add_data', (req, res) => {
    // Fetch data from request body
    const key = req.body.key;
    const value = req.body.value;

    // Store data in cache with the specified key and value
    cache.set(key, value);

    // Send response
    res.json({ message: 'Data added to cache successfully' });
});

// Route handler for removing data from cache based on key
cacheRouter.delete('/del_data/:key', (req, res) => {
    // Retrieve the key from the request parameters
    const key = req.params.key;

    // Remove the item from cache based on the key
    const success = cache.del(key);

    if (success) {
        // If item is removed from cache, send success response
        res.json({ message: 'Data removed from cache successfully' });
    } else {
        // If item is not found in cache, send error response
        res.status(404).json({ error: 'Data not found in cache' });
    }
});


// Route handler for retrieving data from cache
cacheRouter.get('/data/:key', (req, res) => {
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
cacheRouter.get('/allData', (req, res) => {
    // Get all the keys from cache
    const keys = cache.keys();

    // Retrieve all data from cache using keys
    const allData = cache.mget(keys);

    // Send response
    res.json(allData);
});

module.exports = cacheRouter;