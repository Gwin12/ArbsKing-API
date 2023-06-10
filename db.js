const dotenv = require('dotenv')
dotenv.config()
const {MongoClient} = require('mongodb')
const PORT = process.env.PORT || 3000



const client =  new MongoClient(process.env.CONNECTIONSTRING, { useUnifiedTopology: true })

async function start() {
    try {
        await client.connect()
        console.log("Connected")
        module.exports = client
        const app = require('./app')
        app.listen(PORT)

    } catch (error) {
        console.error(error)
    }
    
}
start()