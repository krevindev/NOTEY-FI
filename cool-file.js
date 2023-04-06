{
      const vle_tokens = res.vle_accounts;

      let rCourses = [];

      // for each vle_token
      vle_tokens.forEach(async (token) => {
        const oauth2Client = new OAuth2Client(
          CLIENT_ID,
          CLIENT_SECRET,
          REDIRECT_URI
        );
        oauth2Client.setCredentials({
          access_token: token.access_token,
          token_type: token.token_type,
          expiry_date: token.expiry_date,
        });

        const classroom = google.classroom({
          version: "v1",
          auth: oauth2Client,
        });

        // List the courses
        await classroom.courses.list({}, (err, res) => {
          if (err) {
            console.error(err);
            return;
          }

          const courses = res.data.courses;
          console.log("Courses:");

          if (courses.length) {
            courses.forEach((course) => {
              //              console.log(`${course.name} (${course.id})`);
              rCourses.push(
                `Course Name: ${course.name} Course ID: ${course.id}`
              );
            });
          } else {
            console.log("No courses found.");
          }
          });
      });
      console.log("RCOURSES:");
      console.log(await rCourses);
      return await rCourses;
    }