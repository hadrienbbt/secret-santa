/**
 * Created by hadrien on 22/11/2017.
 */

'use strict'

require('./response.js')

const https = require('https')
const nodemailerKey = require('./.keys/nodemailer.json')
const mongojs = require('mongojs')
const fs = require('fs')
const ObjectID = mongojs.ObjectID
const mongo = mongojs(process.env.MONGO_URL || `mongodb://localhost:27017/secret-santa`)
const groups = mongo.collection('groups')
const pending_groups = mongo.collection('pending_groups')
const nodemailer = require('nodemailer')
const transporter = nodemailer.createTransport({
    host: nodemailerKey.fedutia_smtp,
    port: nodemailerKey.fedutia_smtp_port,
    secure: false,
    tls: {
        rejectUnauthorized: false,
    },
    auth: {
        user: nodemailerKey.fedutia_user,
        pass: nodemailerKey.fedutia_pass,
    }
})

const mailOptions = ({ to, html }) => ({
    from: `"Santa 🎅" <${nodemailerKey.fedutia_email}>`,
    to: to,
    subject: `❄️ Secret Santa ${new Date().getFullYear()} ❄️`,
    html: html
})

// Functions dispatching
const getRandomInt = (min, max) => {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
}

const getGiversLeft = (users, assigned) => users
    .reduce((usersLeft, user) => assigned.includes(user._id) ? usersLeft : [
        ...usersLeft,
        user
    ], [])

const assignReceiver = (giver, users) => {
    let index_giver = users.findIndex(({ _id }) => giver._id === _id)
    do {
        var i = getRandomInt(0, users.length)
    } while (i === index_giver)
    return users[i]
}

const algoDispatching = users => {
    do {
        var assigned = [],
            lastIsAlone = false,
            result = users.map(user => {
                let giversLeft = getGiversLeft(users, assigned)

                // Case where the last to receive and the last to give are the same persons :(
                if (giversLeft.length === 1 && giversLeft[0]._id === users[users.length - 1]._id) {
                    lastIsAlone = true
                    return user
                } else {
                    let nextToAssign = assignReceiver(user, giversLeft)
                    assigned.push(nextToAssign._id)
                    return {
                        giver: user,
                        receiver: nextToAssign
                    }
                }
            })
    } while (lastIsAlone)
    return result
}

const userIsInPendingGroup = (email, group) => group.users
    .reduce((acc, user) =>
        acc ? acc : user.email === email
        , false)

// Route function
const RequestDispatch = (req, res, next) => {
    const _id = req.param('_id')
    pending_groups.find({ _id: new ObjectID(_id) }).toArray((err, group) => {
        if (err || !group[0]) res.respond(new Error('Pas de groupe à cette adresse...'))
        else if (group[0].users && group[0].users.length < 3) {
            res.respond({ results: "Pas assez de membres dans le groupe" }, 200)
        } else {
            req.body.users = group[0].users
            pending_groups.remove({ _id: new ObjectID(_id) }, () => next())
        }
    })
}

const DispatchGifters = (req, res, next) => {
    const { users } = req.body
    users.forEach(user => user._id = new ObjectID())

    var result = algoDispatching(users)

    groups.insert({ result }, () => {
        req.result = result
        next()
    })
}

const SendSecretSantaEmails = (req, res) => {
    const secret_santa = req.result.map(({ giver, receiver }) =>
        transporter.sendMail(mailOptions({
            to: giver.email,
            html: 'CACHE CET EMAIL <br /> ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄<br /><br />La personne à qui tu vas offrir un cadeau cette année est ... <b>' + receiver.name + '</b> !'
        }), (error, info) => error ? Promise.reject() : Promise.resolve())
    )

    Promise.all(secret_santa).then(() => res.respond({ results: true }, 200))
}

const CreatePendingGroup = (req, res, next) => {
    const { groupName, name, email } = req.body
    pending_groups.insert({
        name: groupName,
        users: [{ name, email }]
    }, (err, group) => {
        req.body._id = group._id
        next()
    })
}

const SendGroupCreatedEmail = (req, res) => {
    const { _id, groupName, name, email } = req.body,
        link = `https://${nodemailerKey.domain}:${nodemailerKey.port}/dispatch?_id=${_id}`
    transporter.sendMail(mailOptions({
        to: email,
        html: `Bonjour ${name},<br /><br />Ton groupe ${groupName} a été créé. Tu recevras un mail dès qu'une nouvelle personne rejoindra ce groupe. Lorsque vous serez assez nombreux tu pourras cliquer sur <a href="${link}">ce lien</a> pour que tout le monde reçoive le nom de la personne à qui faire un cadeau.<br />À bientôt !`
    }), (err, result) => {
        if (err) {
            console.log(err)
            res.respond({ results: false }, 500)
        } else {
            res.respond({ results: true }, 200)
        }
    })
}

const SearchPendingGroups = (req, res) => {
    const { text, email } = req.body
    console.log(text, email)
    pending_groups.find().toArray((err, groups) => res.respond({
        results: groups.filter(g => g.name.toLocaleLowerCase().includes(text.toLowerCase()) && !userIsInPendingGroup(email, g))
    }, 200))
}

const JoinPendingGroup = (req, res, next) => {
    const { _id, name, email } = req.body
    pending_groups.findAndModify({
        query: { _id: new ObjectID(_id) }, update: {
            $push: {
                users: { name, email }
            }
        }, new: true
    }, (err, resp) => {
        req.goup = resp
        next()
    })
}

const SendNewGifterEmail = (req, res) => {
    const { _id, name, email } = req.body
    pending_groups.find({ _id: new ObjectID(_id) }).toArray((err, groups) => {
        const { users } = groups[0],
            groupName = groups[0].name,
            creator = users[0],
            promises_emails = [
                transporter.sendMail(mailOptions({
                    to: creator.email,
                    html: `Bonjour ${creator.name},<br /><br />${name} a bien rejoint le groupe ${groupName}.`
                }), () => Promise.resolve()),
                transporter.sendMail(mailOptions({
                    to: email,
                    html: `Bonjour ${name},<br /><br />Tu as bien rejoint le groupe ${groupName}. Tu recevras un email avec le nom de la personne à qui faire un cadeau prochainement.`
                }), () => Promise.resolve())
            ]
        Promise.all(promises_emails).then(() => res.respond({ results: true }, 200))
    })
}

// Front-end router

const ServeHome = (req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" })

    fs.createReadStream(__dirname + '/build/index.html')
        .pipe(res)
}

transporter.verify(function (error, success) {
    if (error) {
        console.log("Error: " + error);
    } else {
        console.log("Server is ready to take our messages");
    }
})

const secretSanta = {
    ServeHome,
    SearchPendingGroups,
    JoinPendingGroup,
    SendNewGifterEmail,
    CreatePendingGroup,
    SendGroupCreatedEmail,
    RequestDispatch,
    SendSecretSantaEmails,
    DispatchGifters
}

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json({ limit: '50mb' }))
  .use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    res.header("Access-Control-Allow-Methods", "DELETE,GET,HEAD,PATCH,POST,PUT,OPTIONS")
    next()
  })
  .use(express.static(__dirname + '/build/'))
  .get('/', secretSanta.ServeHome)
  .post('/group', secretSanta.SearchPendingGroups)
  .put('/group', [secretSanta.DispatchGifters, secretSanta.SendSecretSantaEmails])
  .post('/join', [secretSanta.JoinPendingGroup, secretSanta.SendNewGifterEmail])
  .put('/pending-group', [secretSanta.CreatePendingGroup, secretSanta.SendGroupCreatedEmail])
  .get('/dispatch', [secretSanta.RequestDispatch, secretSanta.DispatchGifters, secretSanta.SendSecretSantaEmails])

const options = {
    cert: fs.readFileSync(nodemailerKey.cert),
    key: fs.readFileSync(nodemailerKey.privkey)
}

https
    .createServer(options, app)
    .listen(nodemailerKey.port, _ => console.log('Listening https on port ' + nodemailerKey.port))
