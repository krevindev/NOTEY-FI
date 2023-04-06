// Database
const mongoose = require('./useDB.js');
const db = mongoose.connection;


async function getAllParticipants(){
  const arr = await db.collection("noteyfi_users").find({}).toArray()
  console.log(arr);
}

module.exports = {
  getAllParticipants
}