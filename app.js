'use strict'
// Imports dependencies and set up http server
const request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()),
  axios = require('axios')
const moment = require('moment')

const { urlencoded, json } = require('body-parser')

// Google Access Tokens
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const { google } = require('googleapis');

// Database
const mongoose = require('./useDB.js');
const db = mongoose.connection;

const authRoutes = require('./authRoutes');
const cacheRoutes = require('./cacheUtil');

// Middlewares
app.use(urlencoded({ extended: true }));
app.use(json());
app.use(authRoutes);
app.use(cacheRoutes);
app.use(express.json()); // Enable JSON request body parsing


// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'))

//
app.get('/', (req, res) => {
  //console.log("Pinged!")
  res.send('Running...')
})

// Display this on page if the user has signed in successfully
app.get('/success', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Sign In Success</title>
        <script>
          window.onload = function() {
            window.close();
          }
        </script>
      </head>
      <body>
        <h1>Signed In Successfully</h1>
      </body>
    </html>
  `);
});


// Messenger Webhook
app.post('/webhook', (req, res) => {
  // Parse the request body from the POST
  let body = req.body

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0]
      console.log(webhook_event)

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id
      console.log('Sender PSID: ' + sender_psid)

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message)
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback)
      }
    })
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED')
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404)
  }
})

app.post('/set_reminder', async (req, res) => {
  let body = await req.body
  const sender_psid = await body.sender_psid[0]
  const time = await body.time.substring(0, body.time.length - 1)
  let timeUnit =
    (await body.time[(await body.time.length) - 1]) === 'd'
      ? 'days'
      : (await body.time[(await body.time.length) - 1]) === 's'
        ? 'seconds'
        : (await body.time[(await body.time.length) - 1]) === 'h'
          ? 'hours'
          : (await body.time[(await body.time.length) - 1]) === 'm'
            ? 'minutes'
            : undefined
  if (time == 1) timeUnit = timeUnit.substring(0, timeUnit.length - 1)
  const course = await body.course
  const courseWork = await body.courseWork

  const dueDate = new Date(
    courseWork.dueDate.year,
    courseWork.dueDate.month - 1, // Subtract 1 from the month value
    courseWork.dueDate.day,
    courseWork.dueTime.hours !== undefined ? courseWork.dueTime.hours + 8 : 11,
    courseWork.dueTime.minutes !== undefined ? courseWork.dueTime.minutes : 59
  )

  console.log('DATE:')
  console.log(courseWork.dueDate)
  console.log('TIME:')
  console.log(courseWork.dueTime)

  const reminderDate = await moment(await dueDate).subtract(
    await time,
    timeUnit
  )
  let currentDate = await moment(new Date()).add(8, 'hours')

  const formattedReminderDate = reminderDate.format(
    'dddd, MMMM Do YYYY, h:mm:ss a'
  )
  const formattedDueDate = moment(dueDate).format(
    'dddd, MMMM Do YYYY, h:mm:ss a'
  )
  const formattedCurrentDate = moment(currentDate).format(
    'dddd, MMMM Do YYYY, h:mm:ss a'
  )

  /** Date format end */

  const response = {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text: `REMINDER!
        \nYou have an upcoming deadline for an activity!
        \n
        \n
        \nCourse: \n${await course.name}
        \nActivity: ${await courseWork.title}
        `,
        buttons: [
          {
            type: 'web_url',
            url: courseWork.alternateLink,
            title: `Go to Activity`,
            webview_height_ratio: 'full'
          },
          {
            type: 'postback',
            title: `Return to Menu`,
            webview_height_ratio: 'full',
            payload: 'menu'
          }
        ]
      }
    }
  }
  async function getUser(sender_psid) {
    return new Promise(async (resolve, reject) => {
      await db
        .collection('noteyfi_users')
        .findOne({ psid: String(sender_psid) }, (err, result) => {
          if (err) {
            reject('Rejected')
          } else {
            resolve(result)
          }
        })
    })
  }

  class SetReminder {
    constructor(reminderDate, sender_psid, response) {
      this.reminderDate = reminderDate
      this.sender_psid = sender_psid
      this.response = response
      this.listenerInterval
    }

    async start() {

      const user = await getUser(sender_psid).then(user => user).catch(err => null);

      this.sendConfirmation()
      this.listenerInterval = setInterval(() => {
        currentDate = moment(new Date()).add(8, 'hours')
        console.log('CHECKING')
        console.log(courseWork.title)

        if (
          reminderDate.isSame(currentDate) ||
          currentDate.isAfter(reminderDate)
        ) {
          this.sendReminder()
          this.stop()
        } else {
          console.log(currentDate)
          console.log(reminderDate)
        }
      }, 2000)
    }
    async stop() {
      clearInterval(this.listenerInterval)
    }

    async sendConfirmation() {
      await callSendAPI(this.sender_psid, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: `You have successfully set a reminder!
          \nYou will be Reminded ${time} ${timeUnit} before ${formattedDueDate}
          \nReminder Date: ${formattedReminderDate}
          \nDeadline Date: ${formattedDueDate}`,
            buttons: [
              {
                type: 'postback',
                title: `Return to Menu`,
                webview_height_ratio: 'full',
                payload: 'menu'
              }
            ]
          }
        }
      })
    }
    async sendReminder() {
      await callSendAPI(this.sender_psid, this.response)
    }
  }

  new SetReminder(await reminderDate, await sender_psid, await response).start()
})

const botResponses = require('./bot-responses')
const { Promise } = require('mongoose')

// function for sending multiple responses at once
async function sendMultipleResponses(multiResponses, sender_psid) {
  try {
    for (const res of multiResponses) {
      await callSendAPI(sender_psid, res)
    }
    console.log('All responses sent successfully!')
  } catch (error) {
    console.error('Error sending responses:', error)
  }
}

// Handles messages events
async function handleMessage(sender_psid, received_message) {
  let response

  // Checks if the message contains text
  if (received_message.text) {
    let msg = received_message.text.toLowerCase()
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API

    console.log('RECEIVED MESSAGE: ')
    console.log(received_message.text)

    // if the message is a quick reply
    if (received_message.quick_reply) {
      let payload = received_message.quick_reply.payload

      handleQuickReplies(sender_psid, payload)

      // if it's just plain text
    } else {
      // if (msg === 'ha' || msg === 'ha?') {
      //   await callSendAPI(sender_psid, {text: 'ha?'})
      //   await callSendAPI(sender_psid, {text: 'tawo?'})
      // }
      // else if (msg === 'test1') {
      //   await callSendAPI(sender_psid, await botResponses.response('menu', sender_psid))
      // } else

      if (msg === 'test') {

        const user = await db.collection("noteyfi_users").findOne(
          { psid: String(sender_psid) })

        await axios.post('https://classroom-listener-server.glitch.me/stop_listening', user)
          .then(response => {
            console.log(response.data);
          })
          .catch(error => {
            console.error(error);
          });
      }
      else if (msg === 'get started') {
        await callSendAPI(sender_psid, await botResponses.response('menu', sender_psid))
      } else if (msg[0] === '/') {
        response = {
          text: await botResponses.askGPT(msg)
        }
      } else {
        await callSendAPI(sender_psid, {
          text: `'${received_message.text}' is an invalid command!`
        })
        await callSendAPI(sender_psid, await botResponses.response('menu', sender_psid))
      }
    }
  } else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url
    response = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [
            {
              title: 'Is this the right picture?',
              subtitle: 'Tap a button to answer.',
              image_url: attachment_url,
              buttons: [
                {
                  type: 'postback',
                  title: 'Yes!',
                  payload: 'yes'
                },
                {
                  type: 'postback',
                  title: 'No!',
                  payload: 'no'
                }
              ]
            }
          ]
        }
      }
    }
  }

  // Send the response message
  callSendAPI(sender_psid, response)
}
const postback_payload = 'get_started';

axios.post(`https://graph.facebook.com/v2.6/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, {
  get_started: {
    payload: postback_payload
  }
})
// Google Classroom Notification
app.post('/notifications', (req, res) => {
  console.log('Called!')
  console.log('Received notification:', req.body)
  res.status(200).send('Notification received')
})

// Handles QuickReplies
async function handleQuickReplies(sender_psid, received_payload) {
  let response

  if (received_payload === 'menu') {
    await callSendAPI(sender_psid, await botResponses.response(received_payload, sender_psid))
  }
  else if (received_payload.split(':')[0] === 'rem_sa') {
    await callSendAPI(
      sender_psid,
      await botResponses.response(received_payload, sender_psid)
    )
  }
  else if (received_payload.split(':')[0] == 'dead_sc') {
    const multiResponses = await botResponses.multiResponse(
      received_payload,
      sender_psid
    )
    sendMultipleResponses(multiResponses, sender_psid)
    // await callSendAPI(
    //   sender_psid,
    //   await botResponses.response(received_payload, sender_psid)
    // )
  } else if (received_payload.split(':')[0] == 'rem_t') {
    await callSendAPI(sender_psid, { text: 'Setting reminder. Please wait...' })
    await callSendAPI(
      sender_psid,
      await botResponses.response(received_payload, sender_psid)
    )
  }
  else if (received_payload === 'view_deadlines2') {
    await callSendAPI(sender_psid, { text: 'Please wait...' })
    await callSendAPI(sender_psid, await botResponses.response(received_payload, sender_psid))
  }
  else if (received_payload.split(':')[0] === 'rem_time') {
    await callSendAPI(sender_psid, {
      attachment: {
        type: 'image',
        payload: {
          url: 'https://media.tenor.com/sLLmD-W4uBAAAAAM/sike-tyler-the-creator.gif',
          is_reusable: true
        }
      }
    })
  } else if (received_payload.split(':')[0] === 'rem_sc') {
    const multiResponses = await botResponses.multiResponse(
      received_payload,
      sender_psid
    )
    sendMultipleResponses(multiResponses, sender_psid)
    // await callSendAPI(
    //   sender_psid,
    //   await botResponses.response(received_payload, sender_psid)
    // )
  } else if (received_payload.split(':')[0] == 'rem_t') {
    await callSendAPI(sender_psid, { text: 'Setting reminder. Please wait...' })
    await callSendAPI(
      sender_psid,
      await botResponses.response(received_payload, sender_psid)
    )
  } else if (received_payload === 'set_reminder') {

    await callSendAPI(
      sender_psid,
      await botResponses.response('send_reminder_options[course]', sender_psid)
    )
  } else if (received_payload === 'view_google_courses') {
    const m = await botResponses.retrieveCourses1(sender_psid)
    await m.map(course => callSendAPI(sender_psid, { text: course }))
    //callSendAPI(sender_psid, await botResponses.response("menu"))
  }
  // Subscribe
  else if (received_payload === 'subscribe') {
    await callSendAPI(sender_psid, { text: 'Please wait-...' })

    botResponses
      .subscribe(sender_psid, db)
      .then(async () => {
        // if storing succeeded
        await callSendAPI(sender_psid, {
          text: 'Successfully Subscribed'
        }).then(async () =>
          callSendAPI(sender_psid, await botResponses.response('menu', sender_psid))
        )
      })
      // if storing in database failed
      .catch(async () => {
        await callSendAPI(sender_psid, {
          text: 'You have already Subscribed'
        }).then(async () =>
          callSendAPI(sender_psid, await botResponses.response('menu', sender_psid))
        )
      })
  }
  else if (received_payload === 'mute_notif' || received_payload === 'unmute_notif') {
    await callSendAPI(sender_psid, await botResponses.response(received_payload))
    await callSendAPI(sender_psid, await botResponses.response('menu', sender_psid))
  }
  else if (received_payload === 'unsub_yes') {
    botResponses
      .unsubscribe(sender_psid, db)
      .then(() => callSendAPI(sender_psid, { text: 'You have unsubscribed' }))
      .catch(() =>
        callSendAPI(sender_psid, { text: "You haven't subscribed yet" })
      )
      .finally(async () =>
        callSendAPI(sender_psid, await botResponses.response('get started'))
      )

    await axios.post('https://classroom-listener-server.glitch.me/stop_listening', {
      psid: String(sender_psid)
    })
      .then(response => {
        console.log(response.data);
      })
      .catch(error => {
        console.error(error);
      });
  }
  else if (received_payload === 'unsubscribe') {
    await callSendAPI(sender_psid, await botResponses.response('unsubscribe'))
  } else if (received_payload === 'add_vle_account') {
    await callSendAPI(
      sender_psid,
      await botResponses.response('prompt vle accounts')
    )
  } else if (received_payload === 'google_classroom_signin') {
    await callSendAPI(
      sender_psid,
      await botResponses.response('google classroom', sender_psid)
    )
    // ).then(
    //   async () => await callSendAPI(sender_psid, { text: 'Signing in...' })
    // )
  } else if (received_payload === 'schoology_signin') {
    await callSendAPI(
      sender_psid,
      { text: `That feature is not available yet` }
    ).then(
      async () => await callSendAPI(
        sender_psid,
        await botResponses.response('prompt vle accounts')
      )
    )
  } else {
    callSendAPI(sender_psid, {
      text: "For some reason, that's an unknown payload"
    }).then(
      async () =>
        await callSendAPI(sender_psid, await botResponses.response('menu', sender_psid))
    )
  }
}

// Handles messaging_postbacks events
async function handlePostback(sender_psid, received_postback) {
  let response

  // Get the payload for the postback
  let payload = received_postback.payload
  console.log('RECEIVED POSTBACK:')
  console.log(received_postback)

  if (payload === 'menu') {
    response = await botResponses.response('menu', sender_psid)
  } else if (payload.split(':')[0] === 'rem_sc') {
    await callSendAPI(
      sender_psid,
      await botResponses.response(payload, sender_psid)
    )
  } else if (payload.split(':')[0] === 'rem_sa') {
    await callSendAPI(
      sender_psid,
      await botResponses.response(payload, sender_psid)
    )
  } else if (payload === 'subscribe') {
    response = { text: 'Subscribing...' }
  } else if (payload === 'get_started') {
    console.log('RECEIVED RECEIVED')
    response = await botResponses.response('menu', sender_psid)
  }

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { text: 'Thanks!' }
  } else if (payload === 'no') {
    response = { text: 'Oops, try sending another image.' }
  }

  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response)
}


// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid
    },
    messaging_type: 'RESPONSE',
    message: response
  }

  // Send the HTTP request to the Messenger Platform
  return new Promise((resolve, reject) => {
    request(
      {
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: request_body
      },
      (err, res, body) => {
        if (!err) {
          resolve(console.log('message sent!'))
        } else {
          reject(console.error('Unable to send message:' + err))
        }
      }
    )
  })
}

app.post('/register-webhook', (req, res) => {
  const accessToken = req.headers.authorization.split(' ')[1]
  const courseId = req.body.courseId
  const webhookUrl = 'https://your-webhook-endpoint.com'

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
  }

  const config = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }

  axios
    .post('https://classroom.googleapis.com/v1/registrations', payload, config)
    .then(response => {
      console.log('Webhook registration successful:', response.data)
      res.sendStatus(200)
    })
    .catch(error => {
      console.error('Failed to register webhook:', error.message)
      res.sendStatus(500)
    })
})



axios.get('https://hollow-iodized-beanie.glitch.me/')
    .then(() => {
        console.log('Pinged Main');
    })
    .catch((error) => {
        console.error('Error pinging the server:', error);
    });
axios.get('https://classroom-listener-server.glitch.me/')
    .then(() => {
        console.log('Pinged Listener!');
    })
    .catch((error) => {
        console.error('Error pinging the server:', error);
    });

setInterval(async () => {
    await axios.get('https://hollow-iodized-beanie.glitch.me/')
        .then(() => {
            console.log('Pinged Main');
        })
        .catch((error) => {
            console.error('Error pinging the server:', error);
        });

    await axios.get('https://classroom-listener-server.glitch.me/')
        .then(() => {
            console.log('Pinged Listener!');
        })
        .catch((error) => {
            console.error('Error pinging the server:', error);
        });
}, 600000); // 5 minutes