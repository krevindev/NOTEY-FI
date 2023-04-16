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
  app = express().use(body_parser.json()),
  axios = require("axios"); 

const { urlencoded, json } = require("body-parser");

// Google Access Tokens
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const { google } = require("googleapis");

// Database
const mongoose = require('./useDB.js');
const db = mongoose.connection;

const authRoutes = require('./authRoutes');

// Middlewares
app.use(urlencoded({ extended: true }));
app.use(json());
app.use(authRoutes)

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

// 
app.get("/", (req, res) => {
  res.send("Running...");
});

// Display this on page if the user has signed in successfully
app.get("/success", (req, res) => {
  res.send("Sign In Successfully");
});

// Messenger Webhook
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

const botResponses = require("./bot-responses");

// Handles messages events
async function handleMessage(sender_psid, received_message) {
  let response;

  // Checks if the message contains text
  if (received_message.text) {
    let msg = received_message.text.toLowerCase();
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API

    console.log("RECEIVED MESSAGE: ");
    console.log(received_message.text);

    // if the message is a quick reply
    if (received_message.quick_reply) {
      let payload = received_message.quick_reply.payload;

      handleQuickReplies(sender_psid, payload);

      // if it's just plain text
    } else {
      if (msg === "test") {
        await callSendAPI(sender_psid, await botResponses.response("send_reminder_options", sender_psid).then(res => res))
      }
      else if (msg === "get started") {
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
// Google Classroom Notification
app.post('/notifications', (req, res) => {
  console.log("Called!")
  console.log('Received notification:', req.body);
  res.status(200).send('Notification received');
});

// Handles QuickReplies
async function handleQuickReplies(sender_psid, received_payload) {
  let response;

  if (["5_s", "10_s", "20_s"].includes(received_payload)){
    console.log("EXECUTED")
    const time = received_payload.split('_')[0];
    
    const cron = require('cron').CronJob;
    callSendAPI(sender_psid, "Successfully Set the Reminder")

    const job = new cron(`*/${time} * * * * *`, async function (testParam) {
      
        callSendAPI(sender_psid, {text: "Notif"}).then(async res => {
    callSendAPI(sender_psid, await botResponses.response("menu"))
          
        })
      console.log("PARAM: "+ testParam)
      job.stop()
      
    }, ["This is a reminder for your activity"])

    job.start();
    
    
    
  }
  else if (received_payload === "set_reminder"){
    
    await callSendAPI(sender_psid, await botResponses.response("send_reminder_options", sender_psid).then(res => res))
  }
  else if (received_payload === "view_google_courses") {
        const m = await botResponses.retrieveCourses1(sender_psid)
          await m.map(course => callSendAPI(sender_psid, {text: course}))
          //callSendAPI(sender_psid, await botResponses.response("menu"))
      }
  // Subscribe
  
  else if (received_payload === "subscribe") {
    callSendAPI(sender_psid, { text: "Please wait-..." });

    botResponses
      .subscribe(sender_psid, db)
      .then(async () => {
        // if storing succeeded
        await callSendAPI(sender_psid, {
          text: "Successfully Subscribed",
        }).then(async () =>
          callSendAPI(sender_psid, await botResponses.response("menu"))
        );
      })
      // if storing in database failed
      .catch(async () => {
        await callSendAPI(sender_psid, {
          text: "You have already Subscribed",
        }).then(async () =>
          callSendAPI(sender_psid, await botResponses.response("menu"))
        );
      });
  } else if (received_payload === "unsubscribe") {
    botResponses
      .unsubscribe(sender_psid, db)
      .then(() => callSendAPI(sender_psid, { text: "You have unsubscribed" }))
      .catch(() =>
        callSendAPI(sender_psid, { text: "You haven't subscribed yet" })
      )
      .finally(async () =>
        callSendAPI(sender_psid, await botResponses.response("get started"))
      );
  } else if (received_payload === "add_vle_account") {
    await callSendAPI(
      sender_psid,
      await botResponses.response("prompt vle accounts")
    );
  } else if (received_payload === "google_classroom_signin") {
    await callSendAPI(
      sender_psid,
      await botResponses.response("google classroom", sender_psid)
    ).then(async () => await callSendAPI(sender_psid, { text: "Signing in..." }));
  } else {
    callSendAPI(sender_psid, {
      text: "For some reason, that's an unknown postback",
    }).then(
      async () =>
        await callSendAPI(sender_psid, await botResponses.response("menu"))
    );
  }
}

// Handles messaging_postbacks events
async function handlePostback(sender_psid, received_postback) {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;
  console.log("RECEIVED POSTBACK:");
  console.log(received_postback);

  if(payload === "menu"){
    response = await botResponses.response("menu")
  }
  else if (payload === "subscribe") {
    response = { text: "Subscribing..." };
  } else if (payload === "<postback_payload>") {
    console.log("RECEIVED RECEIVED");
    response = await botResponses.response("get started");
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
  return new Promise((resolve, reject) => {
    request(
      {
        uri: "https://graph.facebook.com/v2.6/me/messages",
        qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
        method: "POST",
        json: request_body,
      },
      (err, res, body) => {
        if (!err) {
          resolve(console.log("message sent!"));
        } else {
          reject(console.error("Unable to send message:" + err));
        }
      }
    );
  });
}





app.post('/register-webhook', (req, res) => {
  const accessToken = req.headers.authorization.split(' ')[1];
  const courseId = req.body.courseId;
  const webhookUrl = 'https://your-webhook-endpoint.com';

  const payload = {
    feed: {
      feedType: 'COURSE_WORK_CHANGES',
      notificationSettings: {
        courseWorkChangesInfo: {
          courseId: courseId
        }
      },
      deliveryMode: {
        webhook: {
          url: webhookUrl
        }
      }
    }
  };

  const config = {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  axios.post('https://classroom.googleapis.com/v1/registrations', payload, config)
    .then(response => {
      console.log('Webhook registration successful:', response.data);
      res.sendStatus(200);
    })
    .catch(error => {
      console.error('Failed to register webhook:', error.message);
      res.sendStatus(500);
    });
});



