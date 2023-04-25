const axios = require('axios')

function addToCache(key, value) {
    axios.post('https://hollow-iodized-beanie.glitch.me/add_data', { key: key, value: value })
        .then(response => {
            console.log(response.data);
        })
        .catch(error => {
            console.error(error);
        });
}
function getAllFromCache() {
    return new Promise(async (resolve, reject) => {
        axios.get('https://hollow-iodized-beanie.glitch.me/allData')
            .then(async response => {
                resolve(await response.data)
            })
            .catch(async error => {
                reject(await error);
            });
    })
}
function updateACache(key, newValue){
    return new Promise(async (resolve, reject) => {
        axios.put(`https://hollow-iodized-beanie.glitch.me/data/${String(key)}`, newValue)
        .then(response => {
            // Handle success response
            resolve(response.data); // Output: { message: 'Data updated in cache successfully' }
        })
        .catch(error => {
            // Handle error response
            reject(error.response.data); // Output: { error: 'Failed to update data in cache' }
        });
    })
}
function removeACache(key) {
    return new Promise(async (resolve, reject) => {
        axios.delete('https://hollow-iodized-beanie.glitch.me/del_data/' + key)
            .then(response => {
                resolve(response.data) 
            })
            .catch(error => {
                reject(error.response.data)
            });
    })
}
function getFromCache(key) {
    return new Promise(async (resolve, reject) => {
        axios.get('https://hollow-iodized-beanie.glitch.me/data/' + key)
            .then(async response => {
                resolve(await response.data)
            })
            .catch(async error => {
                reject(await error.response.data);
            });
    })
}

module.exports = {
    addToCache,
    getAllFromCache,
    removeACache,
    getFromCache,
    updateACache
}