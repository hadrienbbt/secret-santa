
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

import respond from './response.js'

const port = process.env.PORT || 8080
import http from 'http'
import https from 'https'
import fs from 'fs'
import express from 'express'
import bodyParser from 'body-parser'
import nodemailer from 'nodemailer'

import admin from 'firebase-admin'
const serviceAccount = JSON.parse(fs.readFileSync('./.keys/secret-santa-6a7a9-firebase-adminsdk-5frzt-91d5931925.json'))

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})
const firestore = admin.firestore()
const { FieldValue } = admin.firestore

const nodemailerKey = JSON.parse(fs.readFileSync('./.keys/nodemailer.json'))
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

transporter.verify(function (error, success) {
    if (error) {
        console.log("Error: " + error);
    } else {
        console.log("SMTP Server ready to send emails");
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
    .reduce((usersLeft, user) => assigned.includes(user.id) ? usersLeft : [
        ...usersLeft,
        user
    ], [])

const assignReceiver = (giver, users) => {
    let index_giver = users.findIndex(({ id }) => giver.id === id)
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
                if (giversLeft.length === 1 && giversLeft[0].id === users[users.length - 1].id) {
                    lastIsAlone = true
                    return user
                } else {
                    let nextToAssign = assignReceiver(user, giversLeft)
                    assigned.push(nextToAssign.id)
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
    const id = req.query.id
    firestore
        .collection('pendings')
        .doc(id)
        .get()
        .then(doc => {
            if (!doc.exists) {
                respond(res, new Error('Pas de groupe à cette adresse...'))
                return
            }
            const group = doc.data()
            req.body.users = group.users.map(user => {
                const id = firestore.collection('pendings').doc().id
                return Object.assign(user, { id })
            })
            next()
            firestore
                .collection('pendings')
                .doc(id)
                .delete()
        })
        .catch(error => console.log(error))
}

const DispatchGifters = (req, res, next) => {
    const { users } = req.body
    const result = algoDispatching(users)
    firestore
        .collection('groups')
        .doc()
        .set({ dispatch: result })
        .then(() => {
            req.result = result
            next()
        })
        .catch(error => console.log(error))
}

const SendSecretSantaEmails = (req, res) => {
    const secret_santa = req.result.map(({ giver, receiver }) =>
        transporter.sendMail(mailOptions({
            to: giver.email,
            html: 'CACHE CET EMAIL <br /> ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄<br /><br />La personne à qui tu vas offrir un cadeau cette année est ... <b>' + receiver.name + '</b> !'
        }), (error, info) => error ? Promise.reject() : Promise.resolve()))

    Promise
        .all(secret_santa)
        .then(() => respond(res, { results: true }, 200))
        .catch(error => console.log(error))
}

const CreatePendingGroup = (req, res, next) => {
    const { groupName, name, email } = req.body
    console.log('Saving pending group...')
    const doc = firestore
        .collection('pendings')
        .doc()
    doc
        .set({
            id: doc.id,
            name: groupName,
            users: [{ name, email }]
        })
        .then(() => {
            console.log('Pending group saved')
            req.body.id = doc.id
            next()
        })
        .catch(error => console.log(error))
}

const getLink = (id) => {
    if (!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
        `http://localhost:${port}/dispatch?id=${id}`
    }
    return `https://${nodemailerKey.domain}/dispatch?id=${id}`
}

const SendGroupCreatedEmail = (req, res) => {
    const { id, groupName, name, email } = req.body
    const link = getLink(id)
    transporter.sendMail(mailOptions({
        to: email,
        html: `Bonjour ${name},<br /><br />Ton groupe ${groupName} a été créé. Tu recevras un mail dès qu'une nouvelle personne rejoindra ce groupe. Lorsque vous serez assez nombreux tu pourras cliquer sur <a href="${link}">ce lien</a> pour que tout le monde reçoive le nom de la personne à qui faire un cadeau.<br />À bientôt !`
    }), (err, result) => {
        if (err) {
            console.log(err)
            respond(res, { results: false }, 500)
        } else {
            respond(res, { results: true }, 200)
        }
    })
}

const SearchPendingGroups = (req, res) => {
    const { text, email } = req.query
    firestore
        .collection('pendings')
        .get()
        .then(snap => {
            const groups = snap
                .docs
                .map(doc => doc.data())
                .filter(group => filterGroup(group, text, email))
            respond(res, { results: groups }, 200)
        })
        .catch(error => console.log(error))
}

const filterGroup = (group, text, email) => {
    const isIncluded = group.name.toLowerCase().includes(text.toLowerCase())
    return isIncluded && !userIsInPendingGroup(email, group)
}

const JoinPendingGroup = (req, res, next) => {
    const { id, name, email } = req.body
    console.log('Joining pending group...')
    firestore
        .collection('pendings')
        .doc(id)
        .set({
            users: FieldValue.arrayUnion({ name, email })
        }, { merge: true })
        .then(() => {
            console.log('Pending group joined')
            next()
        })
        .catch(error => console.log(error))
}

const SendNewGifterEmail = (req, res) => {
    const { id, name, email } = req.body
    firestore
        .collection('pendings')
        .doc(id)
        .get()
        .then(doc => {
            const group = doc.data()
            const owner = group.users[0]
            const proms = [
                transporter.sendMail(mailOptions({
                    to: owner.email,
                    html: `Bonjour ${owner.name},<br /><br />${name} a bien rejoint le groupe ${group.name}.`
                }), Promise.resolve),
                transporter.sendMail(mailOptions({
                    to: email,
                    html: `Bonjour ${name},<br /><br />Tu as bien rejoint le groupe ${group.name}. Tu recevras un email avec le nom de la personne à qui faire un cadeau prochainement.`
                }), Promise.resolve)
            ]
            Promise
                .all(proms)
                .then(() => respond(res, { results: true }, 200))
                .catch(error => console.log(error))
        })
        .catch(error => console.log(error))
}

// Front-end router

const ServeHome = (req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" })

    fs.createReadStream(__dirname + '/build/index.html')
        .pipe(res)
}

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
    .get('/group', secretSanta.SearchPendingGroups)
    .post('/group', [secretSanta.DispatchGifters, secretSanta.SendSecretSantaEmails])
    .post('/join', [secretSanta.JoinPendingGroup, secretSanta.SendNewGifterEmail])
    .post('/pending-group', [secretSanta.CreatePendingGroup, secretSanta.SendGroupCreatedEmail])
    .get('/dispatch', [secretSanta.RequestDispatch, secretSanta.DispatchGifters, secretSanta.SendSecretSantaEmails])

if (!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
    http
        .createServer(app)
        .listen(port, _ => console.log('Listening http on port ' + port))
} else {
    const options = {
        cert: fs.readFileSync(nodemailerKey.cert),
        key: fs.readFileSync(nodemailerKey.privkey)
    }
    https
        .createServer(options, app)
        .listen(port, _ => console.log('Listening https on port ' + port))
}
