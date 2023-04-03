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