nse) {
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
                    db.collection("noteyfi_users").insertOne(body, (err, result) => { })
                );
            } else {
                reject("Existing");
            }
        });
    });
}

module.exports = {
    askGPT,
    response,
    subscribe,
};