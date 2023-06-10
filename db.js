const dotenv = require('dotenv')
dotenv.config()
const {MongoClient} = require('mongodb')



const client =  new MongoClient(process.env.CONNECTIONSTRING, { useUnifiedTopology: true })

async function start() {
    try {
        await client.connect()
        console.log("connected")
        module.exports = client
        const app = require('./app')
        app.listen(process.env.PORT)
    } catch (error) {
        console.error(error)
    }
    
}
start()