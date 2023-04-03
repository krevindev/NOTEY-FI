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

async function subscribe(){
  sendText(this.participantID, 'Please wait...')
            .then(async res => {
                let body = {
                    name: this.storedLastMsg.from.name,
                    psid: this.participantID
                }
                return new Promise((resolve, reject) => {
                    db.collection("noteyfi_users").findOne(
                        body, async (err, result) => {

                            if (result == null) {
                                resolve(db.collection("noteyfi_users").insertOne(body, (err, result) => { }))
                            } else {
                                reject('Existing')
                            }
                        });
                })
            })
            .then(res => sendText(this.participantID, 'Successfully Added'))
            .catch(err => sendText(this.participantID, 'You have already subscribed'))
            .finally(res => this.sendMenu())
}

module.exports = {
  askGPT,
  response,
};
