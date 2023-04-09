const express = require('express');
const authRouter = express.Router();
const { OAuth2Client } = require("google-auth-library");


const mongoose = require('./useDB.js');
const db = mongoose.connection;

const { google } = require("googleapis");


const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const REDIRECT_URI = process.env.REDIRECT_URI;
  const SCOPES = process.env.SCOPE_STRING;

const oauth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );




async function isSameAccount(newAccessToken, storedAccessToken) {
  
  // Get the user ID for the first access token
  const res1 = await oauth2Client.tokeninfo({ access_token: newAccessToken });
  const userId1 = res1.data.sub;

  // Get the user ID for the second access token
  const res2 = await oauth2Client.tokeninfo({ access_token: storedAccessToken });
  const userId2 = res2.data.sub;

  // Compare the user IDs
  if (userId1 === userId2) {
    return true;
  } else {
    return false;
  }
}


authRouter.get("/oauth2callback", async (req, res) => {
  const targetPSID = req.query.state;

  

  return new Promise(async (resolve, reject) => {
    
    const { code } = req.query;

    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      // Assuming you have retrieved the access token and stored it in the `tokens` object
const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      console.log("TOKEN INFO:")
console.log(tokenInfo.data);

      await db.collection("noteyfi_users").updateOne(
        { psid: targetPSID },
        {
          $push: {
            vle_accounts: tokens,
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
    res.redirect("/success");
  });
});

module.exports = authRouter;