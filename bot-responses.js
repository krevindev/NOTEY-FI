const axios = require('axios'),
  request = require('request')

const img_url =
  'https://cdn.pixabay.com/photo/2016/02/25/05/36/button-1221338_1280.png'

const callback_url = `https://hollow-iodized-beanie.glitch.me/`

const { OAuth2Client, JWT } = require('google-auth-library')
const { google } = require('googleapis')

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URI = process.env.REDIRECT_URI
const SCOPES = process.env.SCOPE_STRING

const mongoose = require('./useDB.js')
const db = mongoose.connection

// ChatGPT Q&A
async function askGPT (question) {
  const apiEndpoint =
    'https://api.openai.com/v1/engines/text-davinci-003/completions'
  const accessToken = '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'

  async function askQuestion (question) {
    try {
      const response = await axios.post(
        apiEndpoint,
        {
          prompt: `Q: ${question}\nA:`,
          max_tokens: 50,
          n: 1,
          stop: '\n'
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return response.data.choices[0].text.trim()
    } catch (error) {
      console.error(`Error asking question: ${question}`, error.response.data)
    }
  }

  const answer = await askQuestion(question).then(res => res)

  /*
      if (answer) {
          console.log(`Q: ${question}\nA: ${answer}`);
      }
      */
  if (answer) {
    return `A: ${answer}`
  } else {
    return 'Error!'
  }
}

/** BOT MAIN PROMPTS */

function axiosReq (method, data) {
  const config = {
    method: method,
    url: `https://hollow-iodized-beanie.glitch.me/set_reminder`,
    headers: {
      'Content-Type': 'application/json'
    },
    data: data
  }

  axios(config)
    .then(response => {
      // handle success here
    })
    .catch(error => {
      // handle error here
    })
}

async function response (msg, ...sender_psid) {
  let response

  //  1
  // if message is Get Started then send subscribe button
  if (msg === 'get started') {
    response = {
      text: 'Press Subscribe:',
      quick_replies: [
        {
          content_type: 'text',
          title: 'Subscribe',
          payload: 'subscribe',
          image_url: img_url
        }
      ]
    }
  }

  // rem_t
  else if (msg.split(':')[0] == 'rem_t') {
    const time = msg.split(':')[1];
    const courseID = msg.split(':')[2];
    const courseWorkID = msg.split(':')[3];

    return {
      text: `
        Time: ${time},
        CourseID: ${courseID},
        CourseWOrkID: ${courseWorkID}
      `
    }
  }

  // if the message is rem_sa, it means the user has selected an activity then prompt a reminder options for that activity
  else if (msg.split(':')[0] == 'rem_sa') {
    const courseWorkID = msg.split(':')[2]
    const courseID = msg.split(':')[1]

    const user = async () => {
      return new Promise(async (resolve, reject) => {
        await db
          .collection('noteyfi_users')
          .findOne({ psid: String(sender_psid) }, (err, result) => {
            if (err) {
              reject('Rejected')
            } else {
              resolve(result)
            }
          })
      })
    }
    const token = await user()
      .then(res => res.vle_accounts[0])
      .catch(err => console.log(err))

    const psid = await user()
      .then(res => res.psid)
      .catch(err => console.log(err))

    const auth = await new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    )

    await auth.setCredentials({
      // Replace the following with your own values
      access_token: await token.access_token,
      refresh_token: await token.refresh_token
    })

    const classroom = await google.classroom({
      version: 'v1',
      auth: auth
    })

    const selectedActivity = await classroom.courses.courseWork
      .get({
        courseId: courseID,
        id: courseWorkID
      })
      .then(res => res.data)

    const response = {
      text: `Set a Reminder for ${selectedActivity.title}`,
      quick_replies: [
        {
          content_type: 'text',
          title: '5s',
          payload: `rem_t:5s:${courseID}:${courseWorkID}`
        },
        {
          content_type: 'text',
          title: '10s',
          payload: `rem_t:10s:${courseID}:${courseWorkID}`
        }
      ]
    }

    return response
  }
  //  2
  // if the message is a selected course then send the courseWorks from that course
  else if (msg.split(':')[0] == 'rem_sc') {
    const courseID = msg.split(':')[1]

    const user = async () => {
      return new Promise(async (resolve, reject) => {
        await db
          .collection('noteyfi_users')
          .findOne({ psid: String(sender_psid) }, (err, result) => {
            if (err) {
              reject('Rejected')
            } else {
              resolve(result)
            }
          })
      })
    }
    const token = await user()
      .then(res => res.vle_accounts[0])
      .catch(err => console.log(err))

    const auth = await new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    )

    await auth.setCredentials({
      // Replace the following with your own values
      access_token: await token.access_token,
      refresh_token: await token.refresh_token
    })

    const classroom = await google.classroom({
      version: 'v1',
      auth: auth
    })

    let courses = await classroom.courses.list({
      courseStates: ['ACTIVE']
    })

    let courseActivities = await classroom.courses.courseWork.list({
      courseId: courseID,
      orderBy: 'updateTime desc',
      pageToken: null
    })

    courseActivities = courseActivities.data.courseWork
      ? courseActivities.data.courseWork
      : []
    courseActivities = courseActivities.filter(
      courseAct => courseAct.dueDate && courseAct.dueTime
    )

    let courseActivitiesBtn = courseActivities.map(courseAct => {
      return {
        type: 'postback',
        title: courseAct.title,
        payload: `rem_sa:${courseID}:${courseAct.id}`
      }
    })

    courseActivitiesBtn.push({
      type: 'postback',
      title: 'Cancel',
      payload: `menu`
    })

    response = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: 'Please select an activity',
          buttons: courseActivitiesBtn
        }
      }
    }

    return response
  }

  // 3
  // if the message is set reminder then return the courses to choose from
  else if (msg === 'send_reminder_options[course]') {
    const user = async () => {
      return new Promise(async (resolve, reject) => {
        await db
          .collection('noteyfi_users')
          .findOne({ psid: String(sender_psid) }, (err, result) => {
            if (err) {
              reject('Rejected')
            } else {
              resolve(result)
            }
          })
      })
    }
    const token = await user()
      .then(res => res.vle_accounts[0])
      .catch(err => console.log(err))

    const auth = await new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    )

    await auth.setCredentials({
      access_token: await token.access_token,
      refresh_token: await token.refresh_token
    })

    const classroom = await google.classroom({
      version: 'v1',
      auth: auth
    })

    let courses = await classroom.courses.list({
      courseStates: ['ACTIVE']
    })

    courses = courses.data.courses

    const attachment_url = `https://play-lh.googleusercontent.com/w0s3au7cWptVf648ChCUP7sW6uzdwGFTSTenE178Tz87K_w1P1sFwI6h1CLZUlC2Ug`

    //
    const filteredCourses = await courses.filter(async course => {
      // retrieve the activities inside that course
      let courseActivities = await classroom.courses.courseWork.list({
        courseId: course.id,
        orderBy: 'updateTime desc',
        pageToken: null
      })
      // if the courseActivities is null, assign an empty array to it instead
      courseActivities = (await courseActivities.data.courseWork)
        ? courseActivities.data.courseWork
        : []

      // filter the courseActivities with dueDate and dueTime
      courseActivities = courseActivities.filter(
        courseAct => courseAct.dueDate && courseAct.dueTime
      )

      // return only the courseActivities with one or more length
      return await courseActivities.length
    })

    console.log('Activities:')
    console.log(filteredCourses.map(ca => ca.title))

    /*
    
    const filteredCoursesBtns = await courses
        .filter(async (course) => {
          let courseActivities = await classroom.courses.courseWork.list({
            courseId: course.id,
            orderBy: "updateTime desc",
            pageToken: null,
          });
          courseActivities = await courseActivities.data.courseWork
            ? courseActivities.data.courseWork
            : [];
          courseActivities = courseActivities.filter(
            (courseAct) => courseAct.dueDate && courseAct.dueTime
          );

          console.log(courseActivities.map(ca => ca.title))
          // return only the courseActivities with one or more length
          return (await courseActivities.length >= 1);
        })
        .map((course) => {
          return {
            content_type: "text",
            title: course.name,
            payload: `reminder_selected_course:${course.id}`,
          };
        })
    
    */

    console.log('FILTERED:')
    console.log(filteredCourses.map(btn => btn.name))

    /* Buttons*/
    const message = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: 'From which course?',
          buttons: filteredCourses.map(course => {
            return {
              type: 'postback',
              title: course.name.substring(0, 20),
              payload: `rem_sc:${course.id}`
            }
          })
        }
      }
    }

    response = {
      text: 'From which course?',
      quick_replies: filteredCourses
        .filter(fCourse => fCourse !== undefined)
        .map(course => {
          return {
            content_type: 'text',
            title: course.name.substring(0, 20),
            payload: `rem_sc:${course.id}`
          }
        }) //filteredCoursesBtns
    }

    return response
  }

  // if the message is unsubscribe then remove the user from the database
  else if (msg === 'unsubscribe') {
    response = {
      text: 'Unsubscribe:',
      quick_replies: [
        {
          content_type: 'text',
          title: 'Unsubscribe',
          payload: 'unsubscribe',
          image_url: img_url
        }
      ]
    }
  } else if (msg === 'menu') {
    // Send Menu
    response = {
      text: 'Menu:',
      quick_replies: [
        {
          content_type: 'text',
          title: 'Subscribe',
          payload: 'subscribe',
          image_url: img_url
        },
        {
          content_type: 'text',
          title: 'Unsubscribe',
          payload: 'unsubscribe',
          image_url: img_url
        },
        {
          content_type: 'text',
          title: 'Add VLE Account',
          payload: 'add_vle_account',
          image_url: img_url
        },
        {
          content_type: 'text',
          title: 'View Your Google Courses',
          payload: 'view_google_courses',
          image_url: img_url
        },
        {
          content_type: 'text',
          title: 'Set Reminder',
          payload: 'set_reminder',
          image_url:
            'https://cdn1.iconfinder.com/data/icons/cloud-hosting/32/stopwatch-icon-512.png'
        }
      ]
    }
  }

  // if the message is google classroom then send a sign in link to the user
  else if (msg === 'google classroom') {
    const oauth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    )

    oauth2Client.getToken('authCode', (err, tokens) => {
      if (err) {
        console.error('Error getting access token:', err)
      } else {
        console.log('Access token:', tokens.access_token)
        console.log('Refresh token:', tokens.refresh_token)
        // Store the access token and refresh token in your database or other storage mechanism
      }
    })

    // Generate the authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: sender_psid,
      prompt: 'consent'
    })

    // return a response to the user with the auth url
    response = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: 'Sign in to Google Classroom',
          buttons: [
            {
              type: 'web_url',
              url: authUrl,
              title: 'Click to Sign In',
              webview_height_ratio: 'full'
            }
          ]
        }
      }
    }
  }

  // if message is prompt vle accounts then prompt which vle platform the user should select
  else if (msg === 'prompt vle accounts') {
    console.log('VLE Triggered')

    response = {
      text: 'Select VLE:',
      quick_replies: [
        {
          content_type: 'text',
          title: 'Google Classroom',
          payload: 'google_classroom_signin',
          image_url:
            'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-classroom-icon.png'
        },
        {
          content_type: 'text',
          title: 'Schoology',
          payload: 'schoology_signin',
          image_url:
            'https://play-lh.googleusercontent.com/H5eXed9UvaW7Jn6SCAm-_d4T0hExQ3xFoh1ml1mAgMWqw1CG0C8ltBBS7Cq99iSg4XAJ'
        }
      ]
    }
  }

  return await response
}

/** Bot Actions */

// Subscribe User
async function subscribe (sender_psid, db) {
  const name = await axios
    .get(
      `https://graph.facebook.com/${sender_psid}?fields=first_name,last_name&access_token=${process.env.PAGE_ACCESS_TOKEN}`
    )
    .then(response => {
      // Extract the user's name from the response
      let firstName = response.data.first_name
      let lastName = response.data.last_name
      let fullName = `${firstName} ${lastName}`

      return fullName
    })

  let body = {
    name: name,
    psid: sender_psid
  }

  return new Promise((resolve, reject) => {
    db.collection('noteyfi_users').findOne(body, async (err, result) => {
      if (result == null) {
        resolve(
          db.collection('noteyfi_users').insertOne(body, (err, result) => {})
        )
      } else {
        reject('Existing')
      }
    })
  })
}

// Unsubscribe User
async function unsubscribe (sender_psid, db) {
  const body = { psid: sender_psid }
  return new Promise((resolve, reject) => {
    db.collection('noteyfi_users').findOne(body, async (err, result) => {
      if (result == null) {
        reject('Already Not Existing')
      } else {
        resolve(db.collection('noteyfi_users').deleteOne(body))
      }
    })
  })
}

async function retrieveCourses (sender_psid) {
  console.log('retrieving...')

  // retrieve user vle tokens
  const userData = await db
    .collection('noteyfi_users')
    .findOne({ psid: sender_psid })
    .then(res => res)

  const vleTokens = await userData.vle_accounts

  let coursesReturn = []

  const mapMe = await Promise.all(
    vleTokens.map(async token => {
      const oauth2Client = new OAuth2Client(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
      )

      await oauth2Client.setCredentials({
        access_token: token.access_token,
        token_type: token.token_type,
        expiry_date: token.expiry_date,
        refresh_token: token.refresh_token
      })

      const classroom = await google.classroom({
        version: 'v1',
        auth: oauth2Client
      })

      // Call the refreshAccessToken method to refresh the access token
      await oauth2Client.refreshAccessToken((err, tokens) => {
        if (err) {
          console.error('Error refreshing access tokenzz:', err)
        } else {
          console.log('Access token refreshed:', tokens.access_token)
          // Store the new access token in your database or other storage mechanism
        }
      })

      const getCourses = async () => {
        return new Promise(async (resolve, reject) => {
          await classroom.courses.list({}, (err, res) => {
            if (err) {
              reject(err)
            } else {
              resolve(res.data.courses)
            }
          })
        })
      }

      return await getCourses().then(res => {
        res.map(course => `Name: ${course.name} ID: ${course.id}`)
      })
    })
  )

  console.log(await mapMe)
}

async function retrieveCourses1 (sender_psid) {
  // retrieve user vle tokens
  const userData = await db
    .collection('noteyfi_users')
    .findOne({ psid: sender_psid })
    .then(res => res)

  const vleTokens = await userData.vle_accounts
  const token = vleTokens[0]

  const oauth2Client = await new OAuth2Client(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  )

  await oauth2Client.setCredentials({
    access_token: token.access_token,
    token_type: token.token_type,
    expiry_date: token.expiry_date,
    refresh_token: token.refresh_token
  })

  const classroom = await google.classroom({
    version: 'v1',
    auth: oauth2Client
  })

  // Call the refreshAccessToken method to refresh the access token
  await oauth2Client.refreshAccessToken((err, tokens) => {
    if (err) {
      console.error('Error refreshing access tokenzz:', err)
    } else {
      console.log('Access token refreshed:', tokens.access_token)
      // Store the new access token in your database or other storage mechanism
    }
  })

  //token1
  let previousCourseWorkList = []

  setInterval(async () => {
    const { data } = await classroom.courses.courseWork.list({
      courseId: 'COURSE_ID_HERE'
    })

    const currentCourseWorkList = data.courseWork || []

    if (
      JSON.stringify(previousCourseWorkList) !==
      JSON.stringify(currentCourseWorkList)
    ) {
      // Course work list has changed, emit event
      console.log('Course work list has changed!')

      // Code to send notification to webhook URL
    }

    previousCourseWorkList = currentCourseWorkList
  }, 5 * 60 * 1000) // Check every 5 minutes
}

module.exports = {
  askGPT,
  response,
  unsubscribe,
  subscribe,
  retrieveCourses1
}

// CODE TRASH BIN
