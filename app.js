const express = require('express')
const app = express()
const server = require('http').createServer(app)
//const WebSocket = require('ws')
//const wss  = new WebSocket.Server({server: server})
const apiRouter = require('./apiRouter')
const scrapData = require('./ScrapData')


//boiler plate to access user input
app.use(express.urlencoded({extended: false}))
app.use(express.json())


app.use('/api', apiRouter)



module.exports = server