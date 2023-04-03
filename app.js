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
const axios = require("axios");

const { urlencoded, json } = require("body-parser");

const mongoose = require("mongoose");

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const mongoString =
  "mongodb+srv://batchy_bot:Tilapia-626@cluster0.kqimzoq.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(mongoString + "/noteyfi_data", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  writeConcern: { w: "majority" },
});

/** MONGO Database */
var db = mongoose.connection;
mongoose.set('strictQuery', false);
db.on("error", () => console.log("Error in Connecting to Database"));
db.once("open", () => console.log("Connected to Database"));

app.use(urlencoded({ extended: true }));
app.use(json());

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

app.get("/", (req, res) => {
  res.send("Running...");
});

app.get("/success", (req, res) => {
  res.send("Sign In Successfully");
});

app.post("/webhook", (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === "page") {
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log("Sender PSID: " + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });
    // Return a '200 OK' response to all events
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Accepts GET requests at the /webhook endpoint
app.get("/webhoo1k", (req, res) => {
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

const botResponses = require("./bot-responses");

// Handles messages events
async function handleMessage(sender_psid, received_message) {
  let response;
  console.log('FFFFFFF')
  console.log(received_message)

  // Checks if the message contains text
  if (received_message.text) {
    let msg = received_message.text.toLowerCase();
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API

    console.log("RECEIVED MESSAGE: ");
    console.log(received_message);

    // if the message is a quick reply
    if (received_message.quick_reply) {
      let payload = received_message.quick_reply.payload;

      handleQuickReplies(sender_psid, payload);

      // if it's just plain text
    } else {
      if (msg === "test") {
        response = {
          text: `Test Succeeded`,
        };
      } else if (msg === "get started") {
        response = await botResponses.response(msg);
      } else if (msg[0] === "/") {
        response = {
          text: await botResponses.askGPT(msg),
        };
      } else {
        response = {
          text: `'${received_message.text}' is an invalid command!`,
        };
      }
    }
  } else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "Is this the right picture?",
              subtitle: "Tap a button to answer.",
              image_url: attachment_url,
              buttons: [
                {
                  type: "postback",
                  title: "Yes!",
                  payload: "yes",
                },
                {
                  type: "postback",
                  title: "No!",
                  payload: "no",
                },
              ],
            },
          ],
        },
      },
    };
  }

  // Send the response message
  callSendAPI(sender_psid, response);
}

// Handles QuickReplies
function handleQuickReplies(sender_psid, received_payload) {
  let response;
  if (received_payload === "subscribe") {
    response = { text: "Subsribing..." };
    
    botResponses.subscribe(sender_psid, db)
    .then(res => console.log(res)).catch(err => console.log(err))
  }

  callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;
  console.log("RECEIVED POSTBACK:");
  console.log(received_postback);

  if (payload === "subscribe") {
    response = { text: "Subscribing..." };
    console.log("RECEIVED QR");
  }

  // Set the response based on the postback payload
  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  }

  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    messaging_type: "RESPONSE",
    message: response,
  };

  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}
