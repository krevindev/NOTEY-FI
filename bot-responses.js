const axios = require("axios");
const request = require("request");

const img_url =
  "https://cdn.pixabay.com/photo/2016/02/25/05/36/button-1221338_1280.png";

const { OAuth2Client } = require("google-auth-library");

const CLIENT_ID =
  "231696863119-lhr8odkfv58eir2l6m9bvdt8grnlnu4k.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
var REDIRECT_URI = "https://hollow-iodized-beanie.glitch.me/oauth2callback";
const SCOPES = ["https://www.googleapis.com/auth/classroom.courses.readonly"];

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
    });

    response = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Sign in to VLE Platform",
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

module.exports = {
  askGPT,
  response,
  unsubscribe,
  subscribe,
};
