const axios = require('axios'),
  request = require('request')
const img_url =
  'https://cdn.pixabay.com/photo/2016/02/25/05/36/button-1221338_1280.png'
const subscribeIconUrl = 'https://cdn.glitch.global/df116b28-1bf9-459e-9b76-9696e80b6334/bell-icon.png?v=1682700610750';
const viewDeadlinesIconUrl = 'https://static-00.iconduck.com/assets.00/deadline-icon-512x444-z2o6fd9d.png';
const cancelIconUrl = 'https://img.freepik.com/free-icon/x-button_318-391115.jpg';
const backIconUrl = 'https://www.vhv.rs/dpng/d/276-2767433_back-button-white-png-transparent-png.png';
const unsubscribeIconUrl = 'https://cdn.glitch.global/df116b28-1bf9-459e-9b76-9696e80b6334/unsubscribe_bell.PNG?v=1682700782587';
const callback_url = `https://hollow-iodized-beanie.glitch.me/`;

const { OAuth2Client, JWT } = require('google-auth-library')
const { google } = require('googleapis')

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URI = process.env.REDIRECT_URI
const SCOPES = process.env.SCOPE_STRING

const mongoose = require('./useDB.js')
const db = mongoose.connection
const moment = require('moment')

const cachingFunctions = require('./cachingFunctions.js');


// Chat  Q&A
async function askGPT(question) {
  const apiEndpoint =
    'https://api.openai.com/v1/engines/text-davinci-003/completions'
  const accessToken = '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'

  async function askQuestion(question) {
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

async function axiosReq(method, data) {
  const config = {
    method: method,
    url: `https://hollow-iodized-beanie.glitch.me/set_reminder`,
    headers: {
      'Content-Type': 'application/json'
    },
    data: data
  }

  const successResponse = {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text: `You have successfully set a reminder!`,
        buttons: [
          {
            type: 'postback',
            title: `Return to Menu`,
            webview_height_ratio: 'full',
            payload: 'menu'
          }
        ]
      }
    }
  }

  return new Promise((resolve, reject) => {
    axios(config)
      .then(response => {
        console.log('Accepted!!!')
        resolve(response)
      })
      .catch(error => {
        reject(error)
      })
  })
}

async function multiResponse(msg, ...sender_psid) {
  // select a course MULTI RESPONSE
  if (msg === 'send_reminder_options[course]') {
    let passedString = ''

    let responses = []

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

    let filteredCourses = await Promise.all(
      courses.map(async course => {
        const activities = await classroom.courses.courseWork.list({
          courseId: course.id
        })

        const courseWork = (activities.data && activities.data.courseWork) || [] // Add a nullish coalescing operator to handle undefined

        const filteredActs = courseWork
          .map(cw => cw.dueDate)
          .filter(c => c !== undefined)

        if (filteredActs.length !== 0) {
          return course
        }
      })
    )

    filteredCourses = await filteredCourses.filter(
      course => course !== undefined
    )

    await filteredCourses.forEach(async (fc, index) => {
      passedString += '\n\n' + (index + 1) + '.\n' + fc.name
    })

    responses.push({
      text: 'SELECT A COURSE:'
    })

    console.log('FILTERED COURSES:')
    console.log(filteredCourses.filter(course => course !== undefined))

    let quick_replies = filteredCourses
      .filter(course => course !== undefined)
      .map((course, index) => {
        return {
          content_type: 'text',
          title: `${String(index + 1)}. ${course.name.substring(0, 20)}`,
          payload: `rem_sc:${course.id}`
        }
      })
      .slice(0, 12)

    quick_replies.push({
      content_type: 'text',
      title: 'Cancel',
      payload: 'menu',
      image_url: cancelIconUrl
    })

    response = {
      text:
        '```\n' + passedString.substring(2, passedString.length + 1) + '\n```',
      quick_replies: quick_replies
    }

    responses.push(response)

    return await responses
  }

  //   MULTI RESPONSE
  else if (msg.split(':')[0] == 'rem_sc') {
    let passedString = ''

    const userCache = await cachingFunctions.getFromCache(String(sender_psid))
      .then(res => res)
      .catch(err => undefined)



    let responses = [
      {
        text: 'Select Activity:\n'
      }
    ]

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

    let course = await classroom.courses.get({
      id: courseID
    })
    course = course.data

    let courseActivities = await classroom.courses.courseWork.list({
      courseId: courseID,
      orderBy: 'updateTime asc'
    });

    console.log("COURSE ACTIVITIES")
    console.log(courseActivities.data.courseWork)

    courseActivities = courseActivities.data.courseWork
      ? courseActivities.data.courseWork
      : []
    courseActivities = courseActivities.filter(
      courseAct => courseAct.dueDate && courseAct.dueTime
    )

    courseActivities.forEach((ca, index) => {
      passedString += `\n${String(index + 1)}. ${ca.title}\n`
    })

    //responses.push({ text: '```\n' + passedString + '\n```' })
    let quick_replies = courseActivities
      .filter(ca => ca !== undefined)
      .map((ca, index) => {
        console.log(ca)
        return {
          content_type: 'text',
          title: `${String(index + 1)}. ${ca.title}`,
          payload: `rem_sa:${courseID}:${ca.id}`
        }
      })
      .slice(0, 12)
    quick_replies.push({
      content_type: 'text',
      title: 'Return',
      payload: 'set_reminder',
      image_url: backIconUrl
    })

    qr_res = {
      text: '```\n' + passedString + '\n```',
      quick_replies: quick_replies
    }

    responses.push(qr_res)

    return responses
  } else if (msg.split(':')[0] == 'dead_sc') {
    let responses = [
      {
        text: 'Select Activity:\n'
      }
    ]

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

    let course = await classroom.courses.get({
      id: courseID
    })
    course = course.data

    let courseActivities = await classroom.courses.courseWork.list({
      courseId: courseID,
      orderBy: 'dueDate asc'
    })

    courseActivities = courseActivities.data.courseWork
      ? courseActivities.data.courseWork
      : []
    courseActivities = courseActivities.filter(
      courseAct => courseAct.dueDate && courseAct.dueTime
    )

    let passedString = ''

    await courseActivities.forEach(async (ca, index) => {
      const dueDate = new Date(
        ca.dueDate.year,
        ca.dueDate.month - 1, // Subtract 1 from the month value
        ca.dueDate.day,
        ca.dueTime.hours !== undefined ? ca.dueTime.hours + 8 : 11,
        ca.dueTime.minutes !== undefined ? ca.dueTime.minutes : 59
      )

      const formattedDueDate = moment(dueDate).format(
        'dddd, MMMM Do YYYY, h:mm:ss a'
      )

      passedString += `\n${index + 1}. ${ca.title}\n${formattedDueDate}\n`
    })

    //responses.push({ text: '```\n' + passedString + '\n```' })

    let quick_replies = courseActivities
      .filter(ca => ca !== undefined)
      .map((ca, index) => {
        return {
          content_type: 'text',
          title: `${String(index + 1)}. ${ca.title}`,
          payload: `rem_sa:${courseID}:${ca.id}`
        }
      })
      .slice(0, 12)
    quick_replies.push({
      content_type: 'text',
      title: 'Back',
      payload: 'view_deadlines',
      image_url: backIconUrl
    })


    console.log("Passed String:")
    console.log(passedString)
    qr_res = {
      text: "```" + passedString + "```",
      quick_replies: quick_replies
    }

    responses.push(await qr_res)

    return await responses
  }
}

//////////////////////////////////////////////////

async function response(msg, ...sender_psid) {
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
          image_url: subscribeIconUrl
        }
      ]
    }
  }

  else if (msg === 'view_deadlines') {
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

    const filteredCourses = await Promise.all(
      courses.map(async course => {
        const activities = await classroom.courses.courseWork.list({
          courseId: course.id
        })

        const courseWork = (activities.data && activities.data.courseWork) || [] // Add a nullish coalescing operator to handle undefined

        const filteredActs = courseWork
          .map(cw => cw.dueDate)
          .filter(c => c !== undefined)

        console.log('ITERATED')
        console.log(filteredActs.length)

        if (filteredActs.length !== 0) {
          return course
        }
      })
    )

    let quick_replies = filteredCourses
      .filter(course => course !== undefined)
      .map(course => {
        return {
          content_type: 'text',
          title: course.name.substring(0, 20),
          payload: `dead_sc:${course.id}`,
        }
      })
      .slice(0, 12)

    quick_replies.push({
      content_type: 'text',
      title: 'Return to Menu',
      payload: 'menu',
      image_url: cancelIconUrl
    })

    console.log('FILTERED COURSES:')
    console.log(filteredCourses.filter(course => course !== undefined))
    response = {
      text: 'SELECT A COURSE',
      quick_replies: quick_replies

    }

    return response
  }

  else if (msg === 'view_deadlines2') {
    const user = await getUser(sender_psid)
    const token = user['vle_accounts'][0]




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

    let filteredCourses = await Promise.all(
      courses.map(async course => {
        let activities = await classroom.courses.courseWork.list({
          courseId: course.id,
          orderBy: 'dueDate asc'
        })



        const courseWork = (activities.data && activities.data.courseWork) || [] // Add a nullish coalescing operator to handle undefined

        const filteredActs = courseWork
          .map(cw => cw.dueDate)
          .filter(c => c !== undefined)

        console.log('ITERATED')
        console.log(filteredActs.length)

        if (filteredActs.length !== 0) {
          return course
        }
      })
    )

    let passedString = '';
    console.log('REHASHED:')

    let passedArr = await Promise.all(filteredCourses.map(async fCourse => {

      if (fCourse) {
        let fCourseActs = await classroom.courses.courseWork.list({
          courseId: fCourse.id
        })

        fCourseActs = fCourseActs.data.courseWork.filter(act => act.dueDate !== undefined);

        async function isUserTeacher(courseId, userId) {
          const teachers = await classroom.courses.teachers.list({
            courseId,
            userId: userId
          });

          return teachers.data.teachers.some(teacher => teacher.userId === userId);
        }

        console.log("Is Teacher?")
        // Assuming you have the user's access token, you can use it to retrieve the ID token
        const tokenInfo = await auth.getTokenInfo(await token.access_token);
        const userId = tokenInfo.sub

        console.log(await isUserTeacher(fCourse.id, userId))

        return {
          course: fCourse.name,
          activities: fCourseActs.map(act => act)
        }
      }
    })).then(arr => arr.filter(item => item !== undefined))


    passedArr.forEach(arr => {
      passedString += '\n\n-----------------------------------'
      passedString += `\nCOURSE: ${arr.course} \n`
      passedString += '-----------------------------------\n'

      arr.activities.forEach((act, index) => {

        const dueDate = moment({
          year: act.dueDate.year,
          month: act.dueDate.month - 1,
          day: act.dueDate.day,
          hour: act.dueTime.hours !== undefined ? act.dueTime.hours + 8 : 11,
          minute: act.dueTime.minutes !== undefined ? act.dueTime.minutes : 59
        })

        const formattedDueDate = moment(dueDate).format(
          'dddd, MMMM Do YYYY, h:mm:ss a'
        )
        let status
        const timeDiff = moment.duration(dueDate.diff(moment()))

        if (dueDate < moment(new Date()).add(8, 'hours')) {
          status = `( Late ) ${timeDiff.humanize(true)} overdue`
        } else {
          status = `( Pending ) ${timeDiff.humanize(true)} left`
        }

        passedString += `${index + 1}: ${act.title}\n`;
        passedString += `Deadline: ${formattedDueDate} \n`;
        passedString += `Status: ${status}\n\n`;
      })
    })


    console.log('PASSED STRING:')
    console.log(passedString)

    return {
      text: "```\nREMAINING DEADLINES:\n\n" + passedString + "```",
      quick_replies: [
        {
          content_type: 'text',
          title: 'Set a Reminder',
          payload: 'set_reminder',
          image_url: 'https://cdn1.iconfinder.com/data/icons/cloud-hosting/32/stopwatch-icon-512.png'
        }
        , {
          content_type: 'text',
          title: 'Return to Menu',
          payload: 'menu',
          image_url: cancelIconUrl
        }
      ]
    }
  }

  // rem_t
  else if (msg.split(':')[0] == 'rem_t') {
    const time = msg.split(':')[1]
    const courseID = msg.split(':')[2]
    const courseWorkID = msg.split(':')[3]

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

    let course = await classroom.courses.get({ id: courseID })
    course = course.data
    let courseWork = await classroom.courses.courseWork.get({
      courseId: courseID,
      id: courseWorkID
    })

    courseWork = courseWork.data

    const data = {
      sender_psid: sender_psid,
      time: time,
      course: course,
      courseWork: courseWork
    }

    return await axiosReq('post', data)
      .then(res => res)
      .catch(err => console.log(err))
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
      text: `Set a Reminder for \n'${selectedActivity.title}'`,
      quick_replies: [
        {
          content_type: 'text',
          title: '1 minute test',
          payload: `rem_t:1m:${courseID}:${courseWorkID}`
        },
        {
          content_type: 'text',
          title: '3 minutes test',
          payload: `rem_t:3m:${courseID}:${courseWorkID}`
        },
        {
          content_type: 'text',
          title: '1 hour',
          payload: `rem_t:1h:${courseID}:${courseWorkID}`
        },
        {
          content_type: 'text',
          title: '1 day',
          payload: `rem_t:1d:${courseID}:${courseWorkID}`
        },
        {
          content_type: 'text',
          title: '7 days',
          payload: `rem_t:7d:${courseID}:${courseWorkID}`
        }, {
          content_type: 'text',
          title: 'Cancel',
          payload: 'menu',
          image_url: cancelIconUrl
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

    let course = await classroom.courses.get({
      id: courseID
    })
    course = course.data

    let courseActivities = await classroom.courses.courseWork.list({
      courseId: courseID,
      orderBy: 'dueDate asc'
      //pageToken: null
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
          text: `Please select an activity from \n ${course.name}`,
          buttons: courseActivitiesBtn.slice(0, 1)
        }
      }
    }

    return response
  }

  // 3
  // if the message is set reminder then return the courses to choose from
  else if (msg === 'send_reminder_options[course]') {

    const getResponse = async (courses) => {



      let passedString = '  SELECT A COURSE: \n'

      await courses.forEach(async (fc, index) => {
        passedString += '\n\n' + (index + 1) + '. ' + fc.name
      })

      let quick_replies = courses
        .filter(course => course !== undefined)
        .map((course, index) => {
          return {
            content_type: 'text',
            title: `${String(index + 1)}. ${course.name.substring(0, 20)}`,
            payload: `rem_sc:${course.id}`
          }
        })
        .slice(0, 12)

      quick_replies.push({
        content_type: 'text',
        title: 'Return to Menu',
        payload: 'menu',
        image_url: cancelIconUrl
      })

      response = {
        text:
          '```\n' + passedString.substring(2, passedString.length + 1) + '\n```',
        quick_replies: quick_replies
      }

      return response
    }
    //await cachingFunctions.removeACache(String(sender_psid)).then(res => res).catch(err => console.log(err.data))

    // user cache
    const userCache = await cachingFunctions.getFromCache(String(sender_psid))
      .then(res => res)
      .catch(err => undefined);

    // if the user is in cache
    if (await userCache && await userCache['courses'] !== undefined) {
      console.log("READING FROM CACHE")
      // if the user has courses
      return await getResponse(userCache['courses'])
    }
    // if the user isn't in the cache
    else {
      console.log("RETRIEVING COURSES")
      // WE DO THE OLD WAYS HERE
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

      let filteredCourses = await Promise.all(
        courses.map(async course => {
          const activities = await classroom.courses.courseWork.list({
            courseId: course.id
          })

          const courseWork = (activities.data && activities.data.courseWork) || [] // Add a nullish coalescing operator to handle undefined

          const filteredActs = courseWork
            .map(cw => cw.dueDate)
            .filter(c => c !== undefined)

          if (filteredActs.length !== 0) {
            return course
          }
        })
      )

      filteredCourses = await filteredCourses.filter(
        course => course !== undefined
      )

      try {
        await cachingFunctions.addToCache(String(sender_psid), await user().then(res => res).catch(err => console.log(err))
          .then(async res => await cachingFunctions.updateACache(String(sender_psid), { course: filteredCourses })))
      } catch (err) {
        console.log(err)
      }

      return await getResponse(filteredCourses);
    }

  }
  else if (msg === 'unsubscribe') {
    response = {
      text: 'Are you sure you want to unsubscribe?',
      quick_replies: [
        {
          content_type: 'text',
          title: `Yes, I want to unsubscribe`,
          payload: 'unsub_yes',
          image_url: 'https://cdn.glitch.global/df116b28-1bf9-459e-9b76-9696e80b6334/check_icon2.png?v=1682710016606'
        },
        {
          content_type: 'text',
          title: `No, return to menu`,
          payload: 'menu',
          image_url: 'https://cdn.glitch.global/df116b28-1bf9-459e-9b76-9696e80b6334/x_icon2.png?v=1682710328512'
        }
      ]
    }
  }
  // if the message is unsubscribe then remove the user from the database
  else if (msg === 'unsub_yes') {
    response = {
      text: 'Unsubscribe:',
      quick_replies: [
        {
          content_type: 'text',
          title: 'Unsubscribe',
          payload: 'unsubscribe',
          image_url: unsubscribeIconUrl
        }
      ]
    }
  } else if (msg === 'menu') {

    let isMuted = false;

    let btnsBank = [
      {
        content_type: 'text',
        title: 'Set Reminder',
        payload: 'set_reminder',
        image_url:
          'https://cdn1.iconfinder.com/data/icons/cloud-hosting/32/stopwatch-icon-512.png'
      },
      {
        content_type: 'text',
        title: 'View Deadlines',
        payload: 'view_deadlines2',
        image_url: viewDeadlinesIconUrl
      },
      {
        content_type: 'text',
        title: 'Subscribe',
        payload: 'subscribe',
        image_url: subscribeIconUrl
      },
      {
        content_type: 'text',
        title: 'Unsubscribe',
        payload: 'unsubscribe',
        image_url: unsubscribeIconUrl
      },
      {
        content_type: 'text',
        title: 'Add VLE Account',
        payload: 'add_vle_account',
        image_url: 'https://cdn.glitch.global/df116b28-1bf9-459e-9b76-9696e80b6334/add_icon.png?v=1682710584376'
      }, {
        content_type: 'text',
        title: 'Mute Notification',
        payload: 'mute_notif',
        image_url: img_url
      }, {
        content_type: 'text',
        title: 'Unmute Notification',
        payload: 'unmute_notif',
        image_url: img_url
      }
    ];
    let userStatus = '';

    let menuBtnsStatus = {
      subscribed_and_signedin: [btnsBank[0], btnsBank[1], btnsBank[4], btnsBank[5], btnsBank[3]],
      subscribed_only: [btnsBank[4], btnsBank[3]],
      unsubscribed: [btnsBank[2]],
      muted: [btnsBank[0], btnsBank[1], btnsBank[4], btnsBank[3]],
      unmuted: [btnsBank[0], btnsBank[1], btnsBank[4], btnsBank[3]]
    };

    let userData = async () => {
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

    userData = await userData().then(res => res).catch(err => null);

    if (await userData) {
      if (await userData['vle_accounts']) {
        //userStatus = 'subscribed_and_signedin';

        if (userData['muted']) {
          userStatus = 'muted';
        } else {
          userStatus = 'unmuted';
          await db.collection('noteyfi_users').updateOne({ psid: String(sender_psid) }, { $set: { muted: false } });
        }

      } else {
        userStatus = 'subscribed_only';
      }

    } else {
      userStatus = 'unsubscribed'
    }

    console.clear()
    console.log(userStatus)

    // Send Menu
    response = {
      text: (userStatus == 'unsubscribed') ? 'Press Subscribe:' : 'Menu:',
      quick_replies: menuBtnsStatus[userStatus]
    }
  }
  else if (msg === 'mute_notif') {

    await db.collection("noteyfi_users").updateOne(
      { psid: String(sender_psid) },
      { $set: { muted: true } }
    );

    return { text: 'You have muted the notifications' }
  }
  else if (msg == 'unmute_notif') {
    await db.collection('noteyfi_users').updateOne(
      { psid: String(sender_psid) },
      {
        $set: {
          muted: false
        }
      }
    )
    return { text: 'You have unmuted the notifications' }
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
        oauth2Client.setCredentials({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken
        });
        // Store the access token and refresh token in your database or other storage mechanism
      }
    })

    // Generate the authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: sender_psid,
      //      prompt: 'consent'
      prompt: 'select_account consent',

    })

    const user = await getUser(sender_psid).then(user => user).catch(err => null);

    const existing = user['vle_accounts'] ? true : false

    const text = existing ? "WARNING: We can only handle one account for now. If you sign in again, it will replace your current signed in account.\n\nSign in to Google Classroom: " :
      "Sign in to Google Classroom"

    // return a response to the user with the auth url
    response = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text,
          buttons: [
            {
              type: 'web_url',
              url: authUrl,
              title: 'Click to Sign In',
              webview_height_ratio: 'full'
            },
            {
              type: 'postback',
              title: `Cancel`,
              webview_height_ratio: 'full',
              payload: 'menu'
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
          image_url: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-classroom-icon.png'
        },
        {
          content_type: 'text',
          title: 'Schoology',
          payload: 'schoology_signin',
          image_url: 'https://play-lh.googleusercontent.com/H5eXed9UvaW7Jn6SCAm-_d4T0hExQ3xFoh1ml1mAgMWqw1CG0C8ltBBS7Cq99iSg4XAJ'
        },
        {
          content_type: 'text',
          title: 'Cancel',
          payload: 'menu',
          image_url: cancelIconUrl
        }
      ]
    }
  }

  return await response
}
// get the user's data from database
async function getUser(sender_psid) {
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


/** Bot Actions */

// Subscribe User
async function subscribe(sender_psid, db) {
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
          db.collection('noteyfi_users').insertOne(body, (err, result) => { })
        )
      } else {
        reject('Existing')
      }
    })
  })
}

// Unsubscribe User
async function unsubscribe(sender_psid, db) {
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

module.exports = {
  askGPT,
  response,
  unsubscribe,
  subscribe,
  multiResponse
}

// CODE TRASH BIN