/*
 * Starter Project for Messenger Platform Quick Start Tutorial
 *
 * Remix this as the starting point for following the Messenger Platform
 * quick start tutorial.
 *
 * https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start/
 *
 */

"use strict";

// Imports dependencies and set up http server
const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  app = express().use(body_parser.json()); // creates express http server

const { OAuth2Client } = require("google-auth-library");

const { urlencoded, json } = require("body-parser");

const mongoose = require("mongoose");

const mongoString =
  "mongodb+srv://batchy_bot:Tilapia-626@cluster0.kqimzoq.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(mongoString + "/noteyfi_data", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  writeConcern: { w: "majority" },
});

/** MONGO Database */
var db = mongoose.connection;
db.on("error", () => console.log("Error in Connecting to Database"));
db.once("open", () => console.log("Connected to Database"));

app.use(urlencoded({ extended: true }));
app.use(json());

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

app.get("/success", (req, res) => {
  res.send("Sign In Successfully");
});

app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Get the webhook event. entry.messaging is an array, but 
      // will only ever contain one event, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
      
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Add support for GET requests to our webhook

// Accepts GET requests at the /webhook endpoint
app.get("/webhook", (req, res) => {
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "verifytoken";

  // Parse params from the webhook verification request
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

app.get("/oauth2callback", async (req, res) => {
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

      console.log(tokens);

      await db.collection("noteyfi_users").updateOne(
        { psid: targetPSID },
        {
          $push: {
            vle_accounts: tokens,
          },
        }
      );

      /*
                    // Use the access token to make API requests
                    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
                    const { data } = await classroom.courses.list();
                    console.log(data);
                    */
    } catch (error) {
      console.log(error);
    }
    res.redirect("/success");
  });
});
