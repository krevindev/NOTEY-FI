const express = require('express');
const authRouter = express.Router();
const { OAuth2Client } = require("google-auth-library");


const mongoose = require('./useDB.js');
const db = mongoose.connection;

const { google } = require("googleapis");


authRouter.get("/oauth2callback", async (req, res) => {
  const targetPSID = req.query.state;

  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const REDIRECT_URI = process.env.REDIRECT_URI;
  const SCOPES = ["https://www.googleapis.com/auth/classroom.courses.readonly"];

  return new Promise(async (resolve, reject) => {
    const oauth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    const { code } = req.query;

    try {
      const { tokens } = await oauth2Client.getToken(code);

      console.log("TOKENS:");
      console.log(tokens);

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