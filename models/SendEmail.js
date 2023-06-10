const usersCollection = require('../db').db().collection("users") // mongo users collection
const ObjectId = require('mongodb').ObjectId
const nodemailer = require('nodemailer');
const fs = require('fs');
const cheerio = require('cheerio');
const { send } = require('express/lib/response');



// Create a transporter object using SMTP transport for our private email
const transporter = nodemailer.createTransport({
    service: 'Smtp',
    host: "mail.privateemail.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
    user: process.env.ARBKINGEMAIL,
    pass: process.env.ARBKINGEMAILPASSWORD,
  },
});




// Create a transporter object using SMTP transport for our visitor email
const visitorTransporter = nodemailer.createTransport({
    service: 'Gmail',
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
    user: process.env.ARBSKINGVISITORSEMAIL,
    pass: process.env.ARBSKINGVISITORSPASSWORD,
  },
});




const emailDesign = fs.readFileSync('email-design.html', 'utf-8');  //the HTML design of our Email
const $ = cheerio.load(emailDesign);                                //Load the HTML content into Cheerio

const visitorEmailDesign = fs.readFileSync('visitorContact.html', 'utf-8');  //the HTML design of our Email
const $$ = cheerio.load(visitorEmailDesign);                                //Load the HTML content into Cheerio



//recieves data to be sent to user
let SendEmail = function (data) {
    const emailBody = $(data.messageLocation);              // Finding the element containing the email body to replace
    emailBody.html(data.emailToBeSent)                      // Replacing the html within the element
    const emailHeader = $(data.emailHeaderLocation)        //finding the element containing the email header to replace
    emailHeader.text(data.emailHeader)                     //replacing the text within the element
    const modifiedEmailDesign = $.html();                   // Get the modified HTML content



    //VISITOR PART
    const visitorEmailBody = $$(data.messageLocation);              // Finding the element containing the visitor email body to replace
    visitorEmailBody.html(data.emailToBeSent)                      // Replacing the html within the element
    const visitorEmailHeader = $$(data.emailHeaderLocation)        //finding the element containing the email header to replace
    visitorEmailHeader.text(data.emailHeader)                     //replacing the text within the element
    const modifiedVisitorEmailDesign = $$.html();               // Get the modified visitor HTML content



    this.data = {
        arbKingEmail: process.env.ARBKINGEMAIL,
        userEmail: data.userEmail,
        emailToBeSent: data.emailToBeSent,
        subjectOfEmail: data.subjectOfEmail,
        ourEmailHTML: modifiedEmailDesign,



        visitorEmailToBeSent: data.visitorEmailToBeSent,
        visitorEmail: process.env.ARBSKINGVISITORSEMAIL,
        visitorHTML: modifiedVisitorEmailDesign
    }

    this.errors = []
}



//sends email to user
SendEmail.prototype.sendEmailToUser = function() {
    return new Promise(async(resolve, reject) => {
        const mailOptions = {
            from: `"Arbsking" <${this.data.arbKingEmail}>`,
            to: this.data.userEmail,
            subject: this.data.subjectOfEmail,
            html: this.data.ourEmailHTML
        }
    
    
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject({status: 500, error: {message: "Email Failed To Send!", nodeMailerStatus: error}})
                console.error({message:"Email Failed To Send!", status: error});
            } else {
                resolve({status: 200, result: {sendResult: "Email Sent Sucessfully.", nodeMailerStatus: info.response}})
            }
        });    
    })
}


//sends visitors message from the lanfing page to arbsking email
SendEmail.prototype.sendVisitorEmail = function() {
    return new Promise(async(resolve, reject) => {
        const mailOptions = {
            from: `"Visitor" <${this.data.visitorEmail}>`,
            to: this.data.arbKingEmail,
            subject: this.data.subjectOfEmail,
            html: this.data.visitorHTML
        }
    
    
        visitorTransporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject({status: 500, error: {message: "Email Failed To Send!", nodeMailerStatus: error}})
                console.error({message:"Email Failed To Send!", status: error});
            } else {
                resolve({status: 200, result: {sendResult: "Email Sent Sucessfully.", nodeMailerStatus: info.response}})
            }
        });    
    })
}






  
//returns the reset password html
SendEmail.returnResetPasswordHTML = function (forgottenUser, userResetPasswordLink) {
    return `
        <div  style="text-align: left; border: 1px solid #cdcdcd; padding: 1rem">
        <div style="display:flex; align-items: center; width:100%">
            <p style="margin:0 5px 0 0">Hi</p>
            <b style="color: #000; text-transform: capitalize;"> ${forgottenUser.firstname} ${forgottenUser.lastname},</b>
        </div>
        <p style="color: #000">
        Click on the button below to reset your password, the reset link expires in 1 hour. 
        If you did not request password reset, Please contact customer care.
        </p>
        <a class=""
        href="${userResetPasswordLink}"
        style="
            background-color: #e44401;
            padding: 10px 1.5rem;
            color: #fff;
            border-radius: 4px;
            margin: 20px 0;
            display: inline-block;
            text-decoration:none;
        "
        >Reset your password</a
        >
        <p style="color: #000">Thanks</p>
        <p style="color: #000">ArbsKing Team</p>
        </div>
    `
}

//returns the confirm password html
SendEmail.returnConfirmEmailHTML = function (user, userConfirmEmailLink) {
    return `
        <div  style="text-align: left; border: 1px solid #cdcdcd; padding: 1rem">
        <div style="display:flex; align-items: center; width:100%">
            <p style="margin:0 5px 0 0">Hi</p>
            <p style="color: #000; text-transform: capitalize; font-weight: bold;"> ${user.firstname} ${user.lastname},</p>
        </div>
        <p style="color: #000">
        Welcome to ArbsKing, Please click on the confirmation button below to confirm your email.
        The confirmation link expires in 24 hours.
        </p>
        <a class=""
        href="${userConfirmEmailLink}"
        style="
            background-color: #e44401;
            padding: 10px 1.5rem;
            color: #fff;
            border-radius: 4px;
            margin: 20px 0;
            display: inline-block;
            text-decoration:none;
        "
        >Confirm Email</a
        >
        <p style="color: #000">Thanks</p>
        <p style="color: #000">ArbsKing Team</p>
        </div>
    `
}


//returns the email visitor contact us will use to send us mail
SendEmail.returnVisitorEmailHTML = function(visitor) {
    return `
        <div style="text-align: left; border: 1px solid #cdcdcd; padding: 1rem">
        <p style="color: #000; text-transform: capitalize; font-weight: bold;">I'm ${visitor.name},</p>
        <i style="font-weight: bold;"> ${visitor.email},</i>
    
        <p style="color: #000">
            ${visitor.message}
        </p>
        <p style="color: #000">Thanks,</p>
        <p style="color: #000; text-transform: capitalize; font-weight: bold" >${visitor.name}</p>
        </div>
    `
}

//returns email sent to user with their referral code
SendEmail.returnReferralEmail = function(userDetails, referralLink) {
    return `
        <div style="text-align: left; border: 1px solid #cdcdcd; padding: 1rem">
        <p style="color: #000;">Hello, <b style="text-transform: capitalize;">${userDetails.firstname} ${userDetails.lastname}</b>,</p>
        
    
        <p style="color: #000">
            <b style="color: green;"> Congratulations, </b> You have been selected for our referral program. Here is your referral link, ${referralLink}. 
            You can send this to as many referrals as you wish. 
        </p>

        <p style="color: #000">
            The referred person is to use this link to register and is required to complete their registration for it to take effect. 
            Whenever the referred person purchase a subscription, your referral bonus will reflect on your balance.
        </p>
        <p style="color: #000">Thanks,</p>
        <p style="color: #000; text-transform: capitalize; font-weight: bold"> ArbsKing Team </p>
        </div>
    `
}


SendEmail.subscriptionPurchaseEmail = function (userDetails, subCost, subDuration) {
    return `
        <div style="text-align: left; border: 1px solid #cdcdcd; padding: 1rem">
        <p style="color: #000;">Hello <b style="text-transform: capitalize;">${userDetails.firstname} ${userDetails.lastname}</b>,</p>
        

        <p style="color: #000">
            Your $${subCost} for ${subDuration} subscription purchase was successful, you can now start earning.
        </p>

        <p style="color: #000">
            If you have any questions or complaints, You can contact our team for assistance.
        </p>

        <p style="color: #000">Thanks,</p>
        <p style="color: #000; text-transform: capitalize; font-weight: bold"> ArbsKing Team </p>
        </div>
    `
}
 
module.exports = SendEmail