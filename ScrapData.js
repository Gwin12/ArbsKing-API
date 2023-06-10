const scrappedDataCollection = require('./db').db().collection("scrappedData") // mongo scrapped data collection
const ObjectId = require('mongodb').ObjectId
const User = require("./models/User")
const cron = require('node-cron')
const { chromium } = require('playwright')
const { expect } = require('@playwright/test');
const SendEmail = require('./models/SendEmail');


let ScrapData = function(data) {
    this.data = data
}

//the scrapper function that scraps data from the site 
async function scrapper ()  {
    try {
        console.log("Data Scrapping Started.")
        const capabilities = {
            'browserName': 'Chrome', // Browsers allowed: `Chrome`, `MicrosoftEdge`, `pw-chromium`, `pw-firefox` and `pw-webkit`
            'browserVersion': 'latest',
            'LT:Options': {
              'platform': 'Windows 10',
              'build': 'ArbKing Data Build',
              'name': 'ArbKing Data Test',
              'user': process.env.LT_USERNAME,
              'accessKey': process.env.LT_ACCESS_KEY,
              'network': true,
              'video': true,
              'console': true
            }
        }
        
        const browser = await chromium.connect({
        wsEndpoint: `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(JSON.stringify(capabilities))}`
        })
        

        // const browser = await chromium.launch({headless: false})

        const page = await browser.newPage()
        await page.goto(process.env.SCRAPEDATALINK)   //goes to the link in the env to scrape the data

    
        
        
        //GOING TO THE SITE AND AUTO LOGINING IN
        
        //selecting the login 
        await page.waitForSelector(".nav-link") //wait for an element with the class="nav-link" to load before clicking the a link in it
        const LoginLink = await page.$('.navbar-nav.login-part a:first-child')  //getting the login link
        
        const loggedInSign = await page.$('.navbar-nav.login-part')  //getting the login text
        const loggedText = await loggedInSign.textContent()
        const loggedCondition = loggedText.trim()

        
        
        if (loggedCondition === "Log in or Sign up") {
            console.log("Signed Out")

            await LoginLink.click()     // Click on the link

            //the login details for a subscribed surebet account
            const surebetUsername = process.env.SUREBETUSERNAME
            const surebetPassword = process.env.SUREBETPASSWORD

            //typing in username and password 
            await page.waitForSelector("#user_email")  //wait for an element with the id="username" to load before putting input
            await page.type("#user_email", surebetUsername, { delay: 100 })              //inserting the values in it
            await page.type("#user_password", surebetPassword, { delay: 100 })              //inserting the values in it
            await page.click("#sign_in_user")
        
        }

        
        
    
        

        //SCRAPPING THE DATA AND ADDING TO AN ARRAY OF OBJECTS
        await page.waitForSelector(".surebet_record")
        const parentElements = await page.$$('.surebet_record');   //the parent class
        const arbs = [];

        
        //gets textcontent of the child elements and push to the data array
        for (const parentElement of parentElements) {
            const odds = await parentElement.$$('.value');
            const age = await parentElement.$$('.age');
            const profit = await parentElement.$$('.profit');
            const markets = await parentElement.$$('.coeff');
            const bookmakers = await parentElement.$$('.booker a');
            const teams = await parentElement.$$('.event a');



            
            const childData = {
                odds: '',
                age: '',
                profit: '',
                markets: '',
                bookmakers: '',
                teams: ''
            };
          

            //GETTING INDIVIDUAL CHILD ELEMENT OF A CLASS IN THE PARENT CLASS AND SEPERATING WITH A ','
            for (const childElement of odds) {
            const textContent = await childElement.textContent();
            childData.odds += (textContent + ', ');
            }
            for (const childElement of age) {
            const textContent = await childElement.textContent();
            childData.age += (textContent );
            }
            for (const childElement of profit) {
            const textContent = await childElement.textContent();
            childData.profit += (textContent );
            }
            for (const childElement of markets) {
            const textContent = await childElement.textContent();
            childData.markets += (textContent + ', ');
            }
            for (const childElement of bookmakers) {
            const textContent = await childElement.textContent();
            childData.bookmakers += (textContent + ', ');
            }
            for (const childElement of teams) {
            const textContent = await childElement.textContent();
            childData.teams += (textContent + ', ');
            }
          




            // Remove the trailing comma
            childData.odds = childData.odds.slice(0, -1);
            
            //slicing the '%' at the back and changing to number
            childData.profit = childData.profit.slice(0, -1);
            childData.profit = Number(childData.profit)

            childData.markets = childData.markets.slice(0, -1);
            childData.bookmakers = childData.bookmakers.slice(0, -1);

            //spliting and collecting just the first team
            childData.teams = childData.teams.split(', ');
            childData.teams = childData.teams[0]

              
            arbs.push(childData);
        }

        //console.log(arbs);


        //DELETING PREVIOUS SCRAPPED DATA AND ADDING NEWLY SCRAPPED DATA
        
        // deleting previous data stored
        await scrappedDataCollection.deleteMany().then(async() => {

            //inserting the newly scrapped data
            await scrappedDataCollection.insertMany(arbs).then(() => {
                console.log('New Data Updated Successfully.')
            }).catch(() => {
                console.error('The New data was not added!')
            })
        }).catch(() => {
            console.error('The Previous data was not deleted!')
        })




        //returning success or failure if there's details in the arb array
        async function checkArb() {
            if(arbs.length) {
                return("success")
            } else {
                return("failure")
            }
        }


        // //sending passed or failure to the lambda site
        try {
            const result = await checkArb()
            expect(result).toEqual("success")
            // Mark the test as completed or failed
            await page.evaluate(_ => {}, `lambdatest_action: ${JSON.stringify({ action: 'setTestStatus', arguments: { status: 'passed', remark: 'Data Uploaded Successfully.' } })}`)
        } catch {
            await page.evaluate(_ => {}, `lambdatest_action: ${JSON.stringify({ action: 'setTestStatus', arguments: { status: 'failed', remark: 'Data Upload Failed!' } })}`)
        }
        
        await browser.close()
        console.log("Data Scrapping Finished.")
    } catch (error) {
        console.log(error)
    }
}




//scrapping the site every 6hrs
cron.schedule('0 */6 * * *', async () => {     
    try {
        console.log("Cron Job Started.")
        await scrapper()
        console.log("Cron Job Completed.")
    } catch (error) {
        console.log(error)
    }
})



//function that allows admin to manually scrape data
ScrapData.prototype.getScrappedData = function(adminId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(adminId)

            await scrapper()
            resolve({status: 200, result: "New Data Updated Successfully And Test Passed."})
        } catch (error) {
            console.log(error)
            reject({status: 500, error: 'Test Failed!. The New data was not added!', serverError: error})
        }
    })
}



module.exports = ScrapData