const axios = require('axios');
const request = require('request')

function sendQuickReplies(targetPSID, qReps, qRepsText) {
    console.log('Triggered with ')
    let quick_replies = qReps.map(qRep => {
        return {
            const_type: "text",
            title: `${qRep.title}`,
            payload: `${qRep.payload}`,
            image_url: qRep.image_url ? qRep.image_url:''
        }
    })

    let qrBody = {
        recipient: {
            id: "" + targetPSID + "",
        },
        messaging_type: "RESPONSE",
        message: {
            text: qRepsText,
            quick_replies: quick_replies,
        },
    };

    new Promise((resolve, reject) => {
        request(
            {
                url: `https://graph.facebook.com/v15.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
                method: "POST",
                json: true,
                body: qrBody,
            },
            (err, res, body) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(body);
                }
            }
        );
    })
}

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

async function sendSubscribeBtn(targetPSID) {
    sendQuickReplies(targetPSID, [
        {
            title: 'Subscribe',
            payload: 'subscribe'
        }
    ])
    // then adds the user to the database
}


module.exports = {
  askGPT,
  sendSubscribeBtn
}