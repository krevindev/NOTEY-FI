// Database
const mongoose = require('./useDB.js');
const db = mongoose.connection;


async function getAllParticipants(){
   // retrieve user vle tokens
  const userData = await db
    .collection("noteyfi_users")
    .findOne({ psid: sender_psid })
    .then((res) => res);

  const vleTokens = await userData.vle_accounts;
}

module.exports = {
  getAllParticipants
}