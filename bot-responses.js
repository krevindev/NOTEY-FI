const axios = require("axios"),
  request = require("request");

const img_url =
  "https://cdn.pixabay.com/photo/2016/02/25/05/36/button-1221338_1280.png";

const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SCOPES = ["https://www.googleapis.com/auth/classroom.courses.readonly"];

const mongoose = require("./useDB.js");
const db = mongoose.connection;

// ChatGPT Q&A
async function askGPT(question) {
  const apiEndpoint =
    "https://api.openai.com/v1/engines/text-davinci-003/completions";
  const accessToken = "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";

  async function askQuestion(question) {
    try {
      const response = await axios.post(
        apiEndpoint,
        {
          prompt: `Q: ${question}\nA:`,
          max_tokens: 50,
          n: 1,
          stop: "\n",
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].text.trim();
    } catch (error) {
      console.error(`Error asking question: ${question}`, error.response.data);
    }
  }

  const answer = await askQuestion(question).then((res) => res);

  /*
      if (answer) {
          console.log(`Q: ${question}\nA: ${answer}`);
      }
      */
  if (answer) {
    return `A: ${answer}`;
  } else {
    return "Error!";
  }
}

// Bot Prompts
async function response(msg, ...sender_psid) {
  let response;

  if (msg === "get started") {
    // Send subscribe button
    response = {
      text: "Press Subscribe:",
      quick_replies: [
        {
          content_type: "text",
          title: "Subscribe",
          payload: "subscribe",
          image_url: img_url,
        },
      ],
    };
  } else if (msg === "unsubscribe") {
    response = {
      text: "Unsubscribe:",
      quick_replies: [
        {
          content_type: "text",
          title: "Unsubscribe",
          payload: "unsubscribe",
          image_url: img_url,
        },
      ],
    };
  } else if (msg === "menu") {
    // Send Menu
    response = {
      text: "Menu:",
      quick_replies: [
        {
          content_type: "text",
          title: "Subscribe",
          payload: "subscribe",
          image_url: img_url,
        },
        {
          content_type: "text",
          title: "Unsubscribe",
          payload: "unsubscribe",
          image_url: img_url,
        },
        {
          content_type: "text",
          title: "Add VLE Account",
          payload: "add_vle_account",
          image_url: img_url,
        },
        {
          content_type: "text",
          title: "View Your Google Courses",
          payload: "view_google_courses",
          image_url: img_url,
        },
      ],
    };
  } else if (msg === "google classroom") {
    const oauth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    // Generate the authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      state: sender_psid,
      prompt: "consent",
    });

    // return a response to the user with the auth url
    response = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Sign in to Google Classroom",
          buttons: [
            {
              type: "web_url",
              url: authUrl,
              title: "Click to Sign In",
              webview_height_ratio: "full",
            },
          ],
        },
      },
    };
  } else if (msg === "prompt vle accounts") {
    console.log("VLE Triggered");

    response = {
      text: "Select VLE:",
      quick_replies: [
        {
          content_type: "text",
          title: "Google Classroom",
          payload: "google_classroom_signin",
          image_url:
            "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-classroom-icon.png",
        },
        {
          content_type: "text",
          title: "Schoology",
          payload: "schoology_signin",
          image_url:
            "https://play-lh.googleusercontent.com/H5eXed9UvaW7Jn6SCAm-_d4T0hExQ3xFoh1ml1mAgMWqw1CG0C8ltBBS7Cq99iSg4XAJ",
        },
      ],
    };
  }

  return response;
}

/** Bot Actions */

// Subscribe User
async function subscribe(sender_psid, db) {
  const name = await axios
    .get(
      `https://graph.facebook.com/${sender_psid}?fields=first_name,last_name&access_token=${process.env.PAGE_ACCESS_TOKEN}`
    )
    .then((response) => {
      // Extract the user's name from the response
      let firstName = response.data.first_name;
      let lastName = response.data.last_name;
      let fullName = `${firstName} ${lastName}`;

      return fullName;
    });

  let body = {
    name: name,
    psid: sender_psid,
  };

  return new Promise((resolve, reject) => {
    db.collection("noteyfi_users").findOne(body, async (err, result) => {
      if (result == null) {
        resolve(
          db.collection("noteyfi_users").insertOne(body, (err, result) => {})
        );
      } else {
        reject("Existing");
      }
    });
  });
}

// Unsubscribe User
async function unsubscribe(sender_psid, db) {
  const body = { psid: sender_psid };
  return new Promise((resolve, reject) => {
    db.collection("noteyfi_users").findOne(body, async (err, result) => {
      if (result == null) {
        reject("Already Not Existing");
      } else {
        resolve(db.collection("noteyfi_users").deleteOne(body));
      }
    });
  });
}

async function retrieveCourses(sender_psid) {
  let coursesReturn = [];

  const vle_tokens = await db
    .collection("noteyfi_users")
    .findOne({ psid: sender_psid }, (err, res) => {
      if (err) {
        console.log(err);
      } else {
        const vle_account_token = res.vle_accounts[0];
        console.log("RETRIEVED:");
        console.log(vle_account_token);

        const oauth2Client = new OAuth2Client(
          CLIENT_ID,
          CLIENT_SECRET,
          REDIRECT_URI
        );

        oauth2Client.setCredentials({
          access_token: vle_account_token.access_token,
          token_type: vle_account_token.token_type,
          expiry_date: vle_account_token.expiry_date,
        });

        const classroom = google.classroom({
          version: "v1",
          auth: oauth2Client,
        });

        classroom.courses.list({}, (err, res) => {
          if (err) {
            console.error(err);
            return;
          }
          const courses = res.data.courses;
          console.log("Courses:");
          if (courses.length) {
            courses.forEach((course) => {
              //console.log(`${course.name} (${course.id})`);
              coursesReturn.push(`${course.name} (${course.id})`);
            });
          } else {
            console.log("No courses found.");
          }
        });
    
    });
  
        const vle_account_token = res.vle_accounts[0];
        console.log("RETRIEVED:");
        console.log(vle_account_token);

        const oauth2Client = new OAuth2Client(
          CLIENT_ID,
          CLIENT_SECRET,
          REDIRECT_URI
        );

        oauth2Client.setCredentials({
          access_token: vle_account_token.access_token,
          token_type: vle_account_token.token_type,
          expiry_date: vle_account_token.expiry_date,
        });

        const classroom = google.classroom({
          version: "v1",
          auth: oauth2Client,
        });

        classroom.courses.list({}, (err, res) => {
          if (err) {
            console.error(err);
            return;
          }
          const courses = res.data.courses;
          console.log("Courses:");
          if (courses.length) {
            courses.forEach((course) => {
              //console.log(`${course.name} (${course.id})`);
              coursesReturn.push(`${course.name} (${course.id})`);
            });
          } else {
            console.log("No courses found.");
          }
        });

  console.log("RETURNED COURSES");
  console.log(coursesReturn);

  return coursesReturn;
}

module.exports = {
  askGPT,
  response,
  unsubscribe,
  subscribe,
  retrieveCourses,
};

// CODE TRASH BIN

// authorize google account
async function authorize(sender_psid, urlButtons) {
  const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  // Generate the authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state: this.participantID,
  });

  response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "Sign in to VLE Platform",
        buttons: urlButtons.map((btn) => {
          return {
            type: "web_url",
            url: btn.url,
            title: btn.name,
            webview_height_ratio: "full",
          };
        }),
      },
    },
  };
}
