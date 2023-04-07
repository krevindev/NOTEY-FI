const axios = require("axios"),
  request = require("request");

const img_url =
  "https://cdn.pixabay.com/photo/2016/02/25/05/36/button-1221338_1280.png";

const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SCOPES = process.env.SCOPE_STRING;

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

    oauth2Client.getToken("authCode", (err, tokens) => {
      if (err) {
        console.error("Error getting access token:", err);
      } else {
        console.log("Access token:", tokens.access_token);
        console.log("Refresh token:", tokens.refresh_token);
        // Store the access token and refresh token in your database or other storage mechanism
      }
    });

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
  console.log("retrieving...");

  // retrieve user vle tokens
  const userData = await db
    .collection("noteyfi_users")
    .findOne({ psid: sender_psid })
    .then((res) => res);

  const vleTokens = await userData.vle_accounts;
  
  let coursesReturn = [];
  
  const mapMe = await Promise.all(
    
    vleTokens.map(async token => {
    const oauth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    
    await oauth2Client.setCredentials({
      access_token: token.access_token,
      token_type: token.token_type,
      expiry_date: token.expiry_date,
      refresh_token: token.refresh_token,
    });
    
    const classroom = await google.classroom({
      version: "v1",
      auth: oauth2Client,
    });

    // Call the refreshAccessToken method to refresh the access token
    await oauth2Client.refreshAccessToken((err, tokens) => {
      if (err) {
        console.error("Error refreshing access tokenzz:", err);
      } else {
        console.log("Access token refreshed:", tokens.access_token);
        // Store the new access token in your database or other storage mechanism
      }
    });
      
      const getCourses = async () => {
      return new Promise(async (resolve, reject) => {
        await classroom.courses.list({}, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res.data.courses);
          }
        });
      })}
        
  
   return await getCourses().then(res => {
     res.map(course => `Name: ${course.name} ID: ${course.id}`)
   })
  }));
  
  console.log(await mapMe)
  
  
  //console.log(oof)

  // for each vle_token
  /*
  vleTokens.forEach(async (token) => {

    /*
    oauth2Client.getToken('authCode', (err, tokens) => {
  if (err) {
    console.error('Error getting access token:', err);
  } else {
    console.log('Access token:', tokens.access_token);
    console.log('Refresh token:', tokens.refresh_token);
    // Store the access token and refresh token in your database or other storage mechanism
  }
});
    

    

    // List the courses
    const dFunc = () => {
      return new Promise(async (resolve, reject) => {
        await classroom.courses.list({}, async (err, res) => {
          if (err) {
            reject(err);
          } else {
            const courses = await res.data.courses;

            if (courses.length) {
              const ret = courses.map(
                (course) => `Name: ${course.name} \n ID: ${course.id}`
              );

              resolve(ret);
            } else {
              reject("No courses found");
            }
          }
        });
      });
    };
    //console.log(await dFunc().then((res) => res));
  })*/;
}



async function retrieveCourses1(sender_psid){
  
  // retrieve user vle tokens
  const userData = await db
    .collection("noteyfi_users")
    .findOne({ psid: sender_psid })
    .then((res) => res);

  const vleTokens = await userData.vle_accounts;
  const token1 = vleTokens[0];
  
  
  try {
    const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oAuth2Client.setCredentials({ refresh_token: token1.refresh_token });

    const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });

    
    const { data } = await classroom.courses.list({
      courseStates: 'ACTIVE' // Filter by unarchived courses
    });
  

    const courses = data.courses;
    
    let request = {
          courseId: courses[0],
          requestBody: {
            address: "https://hollow-iodized-beanie.glitch.me/register-webhook",
            expirationTimeMillis: "3600000", // 1 hour
            payload: "NONE",
            type: "ALL", // or 'ALL'
          }}
    
   const WEBHOOK_URL = 'https://hollow-iodized-beanie.glitch.me/notifications';
    
const registerWebhook = async () => {
  try {
    const response = await axios({
      method: 'post',
      url: 'https://classroom.googleapis.com/v1/registrations',
      headers: {
        'Authorization': `Bearer ${token1.access_token}`,
        'Content-Type': 'application/json',
      },
      data: {
        feed: {
          feedType: 'COURSE_WORK_CHANGES',
          notificationSettings: {
            courseWorkChangesInfo: {
              courseId: courses[0].id,
            },
          },
          deliveryMode: {
            webhook: {
              url: WEBHOOK_URL,
            },
          },
        },
      },
    });

    console.log(`Webhook registration successful with ID: ${response.data.id}`);
  } catch (error) {
    console.error('Failed to register webhook:', error.message);
  }
};

registerWebhook();

    
    
    return courses.map(course => `Name: ${course.name}`);
  } catch (err) {
    console.error(err);
  }
}
module.exports = {
  askGPT,
  response,
  unsubscribe,
  subscribe,
  retrieveCourses1,
};

// CODE TRASH BIN

