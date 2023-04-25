const express = require('express');
const authRouter = express.Router();
const { OAuth2Client } = require("google-auth-library");
const request = require('request');
const axios = require('axios')


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

function addToCache(key, value) {
    axios.post('https://hollow-iodized-beanie.glitch.me/add_data', { key: key, value: value })
        .then(response => {
            console.log(response.data);
        })
        .catch(error => {
            console.error(error);
        });
}

const botResponses = require('./bot-responses');
const CourseListener = require('./CourseListener').CourseListener;


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

            const userRes = {
                psid: targetPSID,
                vle_accounts: [tokens]
            }

            await db.collection("noteyfi_users").updateOne(
                { psid: targetPSID },
                {
                    $push: {
                        vle_accounts: tokens,
                    },
                }
            );

            await callSendAPI(targetPSID, { text: "Successfully Signed In!" })
                .then(async res => await callSendAPI(targetPSID, await botResponses.response("menu")))
                .then(async res => {
                    console.log("RES:");
                    console.log(userRes);
                    const user = await db.collection("noteyfi_users").findOne(
                        { psid: targetPSID })
                    // create CourseListeners to the user
                    listenToUser(user);
                })
        } catch (error) {
            console.log(error);
            await callSendAPI(targetPSID, { text: "Sign In Failed!" })
                .then(async res => await callSendAPI(targetPSID, await botResponses.response("menu")))
            return;
        }
        res.redirect("/success");
    });
});

/** Pass a user here to listen to */
async function listenToUser(user) {
    new CourseListener(user).listenCourseChange();
    new CourseListener(user).pushNotification();

    addToCache(user.psid, user);
}

/** listen to existing users in the database when this server is running */
async function listenToExistingUsers() {
    db.once('open', async () => {
        await db.collection('noteyfi_users').find().toArray((err, res) => {
            const users = res
            users.forEach(user => {
                try {
                    // if the user has a vle_accounts property
                    if (user.vle_accounts) {
                        // create CourseListeners to the user
                        listenToUser(user);
                    }
                } catch (err) {
                    console.log("User DB Error");
                    console.log("Error: " + err)
                }
            })
        });

    })
}

listenToExistingUsers();

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
module.exports = authRouter;