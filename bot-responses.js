const axios = require("axios");
const request = require("request");

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

async function response(msg) {
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
          image_url:
            "https://cdn4.iconfinder.com/data/icons/ionicons/512/icon-ios7-bell-512.png",
        },
      ],
    };
  }

  return response;
}


 async function subscribe(sender_psid, db) {
   
   let body = {
        name: getName(sender_psid),
        psid: sender_psid,
      };
   
      return new Promise((resolve, reject) => {
        db.collection("noteyfi_users").findOne(body, async (err, result) => {
          if (result == null) {
            resolve(
              db
                .collection("noteyfi_users")
                .insertOne(body, (err, result) => {})
            );
          } else {
            reject("Existing");
          }
        });
      });
    }


async function getName(targetPSID){
  axios.get(`https://graph.facebook.com/${targetPSID}?fields=first_name,last_name&access_token=${process.env.PAGE_ACCESS_TOKEN}`)
  .then(function(response) {
    // Extract the user's name from the response
    let firstName = response.data.first_name;
    let lastName = response.data.last_name;
    let fullName = `${firstName} ${lastName}`;

    return fullName
  })
  .catch(function(error) {
    console.error(`Error getting user's name: ${error}`);
  });
}


module.exports = {
  askGPT,
  response,
  getName,
  subscribe
};
