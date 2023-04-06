const express = require('express');
const authRouter = express.Router();
const { OAuth2Client } = require("google-auth-library");


const mongoose = require('./useDB.js');
const db = mongoose.connection;

const { google } = require("googleapis");


authRouter.get("/oauth2callback", async (req, res) => {
  const targetPSID = req.query.state;

  const CLIENT_ID =
    "231696863119-lhr8odkfv58eir2l6m9bvdt8grnlnu4k.apps.googleusercontent.com";
  const CLIENT_SECRET = "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";
  var REDIRECT_URI = "https://hollow-iodized-beanie.glitch.me/oauth2callback";
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
      console.log("SUCCEEDED");

      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
      });

      const classroom = google.classroom({ version: "v1", auth: oauth2Client });

      classroom.courses.list({}, (err, res) => {
        if (err) {
          console.error(err);
          return;
        }
        const courses = res.data.courses;
        console.log("Courses:");
        if (courses.length) {
          courses.forEach((course) => {
            console.log(`${course.name} (${course.id})`);
          });
        } else {
          console.log("No courses found.");
        }
      });
    } catch (error) {
      console.log(error);
    }
    res.redirect("/success");
  });
});

module.exports = {
  authRouter
}