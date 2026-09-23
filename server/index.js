import 'dotenv/config'

import http from 'http'
import https from 'https'
import fs from 'fs'
import crypto from 'crypto'
import express from 'express'
import bodyParser from 'body-parser'
import nodemailer from 'nodemailer'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import path from 'path'

import respond from './response.js'
import serviceAccount from '../.keys/secret-santa-6a7a9-firebase-adminsdk-5frzt-91d5931925.json' with { type: 'json' }
initializeApp({
    credential: cert(serviceAccount)
})

const domain = process.env.DOMAIN || 'localhost'
const port = process.env.PORT || 8888
const smtpHost = process.env.SMTP_HOST || 'localhost'
const smtpPort = process.env.SMTP_PORT || 25
const smtpUser = process.env.SMTP_USER || 'user'
const smtpPwd = process.env.SMTP_PWD || 'pwd'
const senderEmail = process.env.SENDER_EMAIL || 'user@example.com'

const firestore = getFirestore()

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SSL_CERT && process.env.SSL_KEY,
    tls: {
        rejectUnauthorized: false,
    },
    auth: {
        user: smtpUser,
        pass: smtpPwd,
    }
})

transporter.verify(function (error, success) {
    if (error) {
        console.error(error);
    } else {
        console.log("SMTP Server ready to send emails");
    }
})

// Names and group names come from the public API, so they are escaped before
// being put in an HTML email.
const escapeHtml = value => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const mailOptions = ({ to, html }) => ({
    from: `"Santa 🎅" <${senderEmail}>`,
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

// Answers 503 instead of leaving the request hanging when Firestore or
// another dependency fails, and never answers twice.
const fail = (res, error) => {
    console.log(error)
    if (!res.headersSent) respond(res, 'Service unavailable', 503)
}

const groupNotFound = res => respond(res, 'Pas de groupe à cette adresse...', 404)

// Compares a token from a link with the stored one in constant time.
const sameToken = (given, expected) => {
    if (typeof given !== 'string') return false
    const a = Buffer.from(given)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Route function
const RequestDispatch = (req, res, next) => {
    const id = req.query.id
    if (typeof id !== 'string' || !id) return groupNotFound(res)
    firestore
        .collection('pendings')
        .doc(id)
        .get()
        .then(doc => {
            if (!doc.exists) {
                groupNotFound(res)
                return
            }
            const group = doc.data()
            // Group ids are public (the join screen lists them), so a draw
            // needs the secret token from the owner's email. Groups created
            // before tokens existed have none; their owners' links only carry
            // the id, so the id alone still works for them.
            if (group.dispatchToken && !sameToken(req.query.token, group.dispatchToken)) {
                groupNotFound(res)
                return
            }
            req.body.users = group.users.map(user => {
                const id = firestore.collection('pendings').doc().id
                return Object.assign(user, { id })
            })
            next()
            firestore
                .collection('pendings')
                .doc(id)
                .delete()
                .catch(error => console.log(error))
        })
        .catch(error => fail(res, error))
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
        .catch(error => fail(res, error))
}

const SendSecretSantaEmails = (req, res) => {
    const secret_santa = req.result.map(({ giver, receiver }) =>
        transporter.sendMail(mailOptions({
            to: giver.email,
            html: '<html>CACHE CET EMAIL <br /> ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄ ❄<br /><br />La personne à qui tu vas offrir un cadeau cette année est ... <b>' + escapeHtml(receiver.name) + '</b> !</html>'
        }), (error, info) => error ? Promise.reject() : Promise.resolve()))

    Promise
        .all(secret_santa)
        .then(() => respond(res, { results: true }, 200))
        .catch(error => fail(res, error))
}

const CreatePendingGroup = (req, res, next) => {
    const { groupName, name, email } = req.body
    console.log('Saving pending group...')
    const doc = firestore
        .collection('pendings')
        .doc()
    const dispatchToken = crypto.randomBytes(24).toString('hex')
    doc
        .set({
            id: doc.id,
            name: groupName,
            users: [{ name, email }],
            dispatchToken
        })
        .then(() => {
            console.log('Pending group saved')
            req.createdGroup = { id: doc.id, dispatchToken }
            next()
        })
        .catch(error => fail(res, error))
}

const getLink = (id, token) => {
    if (!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
        `http://${domain}:${port}/dispatch?id=${id}&token=${token}`
    }
    return `https://${domain}/dispatch?id=${id}&token=${token}`
}

const SendGroupCreatedEmail = (req, res) => {
    const { groupName, name, email } = req.body
    const { id, dispatchToken } = req.createdGroup
    const link = getLink(id, dispatchToken)
    transporter.sendMail(mailOptions({
        to: email,
        html: `<html>Bonjour ${escapeHtml(name)},<br /><br />Ton groupe ${escapeHtml(groupName)} a été créé. Tu recevras un mail dès qu'une nouvelle personne rejoindra ce groupe. Lorsque vous serez assez nombreux tu pourras cliquer sur <a href="${link}">ce lien</a> pour que tout le monde reçoive le nom de la personne à qui faire un cadeau.<br />À bientôt !</html>`
    }), (err, result) => {
        if (err) {
            console.log(err)
            respond(res, { results: false }, 500)
        } else {
            respond(res, { results: true }, 200)
        }
    })
}

// Returns only what the web app shows: each group's id and name. Members'
// names and email addresses stay on the server.
const SearchPendingGroups = (req, res) => {
    const { text = '', email = '' } = req.query
    firestore
        .collection('pendings')
        .get()
        .then(snap => {
            const groups = snap
                .docs
                .map(doc => doc.data())
                .filter(group => filterGroup(group, text, email))
                .map(group => ({ id: group.id, name: group.name }))
            respond(res, { results: groups }, 200)
        })
        .catch(error => fail(res, error))
}

const filterGroup = (group, text, email) => {
    if (typeof group.name !== 'string' || !Array.isArray(group.users)) return false
    const isIncluded = group.name.toLowerCase().includes(String(text).toLowerCase())
    return isIncluded && !userIsInPendingGroup(email, group)
}

const JoinPendingGroup = (req, res, next) => {
    const { id, name, email } = req.body
    if (typeof id !== 'string' || !id) return groupNotFound(res)
    console.log('Joining pending group...')
    // update() fails with NOT_FOUND (gRPC code 5) instead of creating an
    // empty group when the id does not exist.
    firestore
        .collection('pendings')
        .doc(id)
        .update({
            users: FieldValue.arrayUnion({ name, email })
        })
        .then(() => {
            console.log('Pending group joined')
            next()
        })
        .catch(error => error.code === 5 ? groupNotFound(res) : fail(res, error))
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
                    html: `<html>Bonjour ${escapeHtml(owner.name)},<br /><br />${escapeHtml(name)} a bien rejoint le groupe ${escapeHtml(group.name)}.</html>`
                }), Promise.resolve),
                transporter.sendMail(mailOptions({
                    to: email,
                    html: `<html>Bonjour ${escapeHtml(name)},<br /><br />Tu as bien rejoint le groupe ${escapeHtml(group.name)}. Tu recevras un email avec le nom de la personne à qui faire un cadeau prochainement.</html>`
                }), Promise.resolve)
            ]
            Promise
                .all(proms)
                .then(() => respond(res, { results: true }, 200))
                .catch(error => fail(res, error))
        })
        .catch(error => fail(res, error))
}

const secretSanta = {
    SearchPendingGroups,
    JoinPendingGroup,
    SendNewGifterEmail,
    CreatePendingGroup,
    SendGroupCreatedEmail,
    RequestDispatch,
    SendSecretSantaEmails,
    DispatchGifters
}

const publicUrl = process.env.PUBLIC_URL || path.join(import.meta.dirname, '../app/build')

const app = express()
app.disable('x-powered-by')
app.use(bodyParser.json())
    .use((req, res, next) => {
        res.header("X-Content-Type-Options", "nosniff")
        res.header("Access-Control-Allow-Origin", "*")
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
        res.header("Access-Control-Allow-Methods", "DELETE,GET,HEAD,PATCH,POST,PUT,OPTIONS")
        next()
    })
    .use(express.static(publicUrl))
    .get('/', function (req, res) {
        res.sendFile(path.join(publicUrl, 'index.html'))
    })
    .get('/group', secretSanta.SearchPendingGroups)
    .post('/join', [secretSanta.JoinPendingGroup, secretSanta.SendNewGifterEmail])
    .post('/pending-group', [secretSanta.CreatePendingGroup, secretSanta.SendGroupCreatedEmail])
    .get('/dispatch', [secretSanta.RequestDispatch, secretSanta.DispatchGifters, secretSanta.SendSecretSantaEmails])

if (!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
    http
        .createServer(app)
        .listen(port, _ => console.log('Listening http on port ' + port))
} else {
    const cert = process.env.SSL_CERT
    const key = process.env.SSL_KEY
    const options = {
        cert: fs.readFileSync(cert),
        key: fs.readFileSync(key)
    }
    https
        .createServer(options, app)
        .listen(port, _ => console.log('Listening https on port ' + port))
}
