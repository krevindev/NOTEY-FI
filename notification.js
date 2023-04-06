// Database
const mongoose = require('./useDB.js');
const db = mongoose.connection;


db.collection("noteyfi_users").find(
  {
    psid: 
  }
)
    