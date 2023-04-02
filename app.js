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

const { OAuth2Client } = require('google-auth-library');

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

// Accepts POST requests at /webhook endpoint
app.post("/webhook", (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === "page") {
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // Get the webhook event. entry.messaging is an array, but
      // will only ever contain one event, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
    });

    // Return a '200 OK' response to all events
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Add support for GET requests to our webhook
app.get("/messaging-webhook", (req, res) => {
  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === config.verifyToken) {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

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
  const CLIENT_ID =
    "524422024726-kbjdo5pbmant8nbnli4dppmbicc430ts.apps.googleusercontent.com";
  const CLIENT_SECRET = "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";
  var REDIRECT_URI =
    "https://hollow-iodized-beanie.glitch.me/messaging-webhook/oauth2callback";
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

      console.log(this.participantID + ":\n");
      console.log(tokens);

      await db.collection("noteyfi_users").updateOne(
        { psid: this.participantID },
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
