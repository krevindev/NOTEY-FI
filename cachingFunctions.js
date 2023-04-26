const axios = require('axios')

function addToCache(key, value) {
    return new Promise((resolve, reject) => {
        axios.post('https://hollow-iodized-beanie.glitch.me/add_data', { key: key, value: value })
        .then(response => {
            resolve(response.data)
        })
        .catch(error => {
            reject(error)
        });
    })
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
    console.log({key:key,newValue:newValue})
    return new Promise(async (resolve, reject) => {
        axios.put(`https://hollow-iodized-beanie.glitch.me/update_data/${key}`, newValue)
        .then(response => {
            resolve(console.log(response.data))
        })
        .catch(err => {
            reject(console.log('May error'))
        })
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
                reject(await error.response);
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