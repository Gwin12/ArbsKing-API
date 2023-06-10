const dotenv = require('dotenv')
dotenv.config()
const {MongoClient} = require('mongodb')



const client =  new MongoClient(process.env.CONNECTIONSTRING)

async function start() {
    try {
        await client.connect()
        console.log("Connected")
        module.exports = client
        const app = require('./app')
        app.listen(process.env.PORT)
    } catch (error) {
        console.error(error)
    }
    
}
start()

