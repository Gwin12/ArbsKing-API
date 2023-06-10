const User = require('../models/User')
const Admin = require('../models/Admin')
const SendEmail = require('../models/SendEmail')
const Subscription = require('../models/Subscription')
const BroadCast = require('../models/BroadCast')
const bcrypt = require("bcryptjs")
const { Wallet } = require("ethers")
const {busdContract, usdtContract} = require('../contract_config/connection')
const { BigNumber } = require("ethers")



//VISITORS EXPORTS
exports.visitorContactUs = async function(req, res) {
    try {
        const contactDetails = req.body
        const cleanUpEmail = await User.validateEmail(contactDetails.email)

        if (cleanUpEmail.result === "Valid Email") {
            const cleanContactDetails = await User.cleanUpVisitorContactDetails(contactDetails)
            const visitorContactDetails =  cleanContactDetails.result
            const emailToBeSent = await SendEmail.returnVisitorEmailHTML(visitorContactDetails)


            //sending the link the user will use to setup a new password to user mail
            const userDetails = {
                userEmail: visitorContactDetails.email,
                subjectOfEmail: 'Message From Visitor',
                messageLocation: '.message_sent',
                emailHeaderLocation: '.email-header',
                emailHeader: `A Contact Message From Visitor`,
                emailToBeSent: emailToBeSent
            }



            let sendToUser = new SendEmail(userDetails)
            const sendEmailResut = await sendToUser.sendVisitorEmail()
            res.status(sendEmailResut.status).json({message: "Thank you for contacting us. We will get back to you shortly."})

        } else {
            res.status(400).json({message: "Invalid Email Address!. Please Provide a valid email address."})
        }

    } catch (error) {
        res.status(error.status).json({message: error.error, mongoError: error.mongoError})
    }
}

//adding visitors to waiting list
exports.addVisitorToWaitList = async function(req, res) {
    try {
        const visitorEmail = req.body.email
        const cleanUpEmail = await User.validateEmail(visitorEmail)

        if(cleanUpEmail.result === "Valid Email") {
            const addVisitor = await User.addVisitorToWaitList(visitorEmail)
            res.status(addVisitor.status).json({message: addVisitor.result})
        } else {
            res.status(400).json({message: "Invalid Email Address!. Please Provide a valid email address."})
        }

    } catch (error) {
        res.status(error.status).json({message: error.error, mongoError: error.mongoError})
    }
}



//SIGNED IN USERS EXPORTS


//checks if user has token or not; sends back the token if there's any.
exports.accessingToken = async function(req, res, next) {
    try {
        const property = "authorization"
        if (req.headers.hasOwnProperty(property)) {       //checking if the headers has auth 
            const bearerHeader = req.headers["authorization"]
            const bearer = bearerHeader.split(" ")
            const bearerToken = bearer[1]
            const apiUser = await User.verifyJWTToken(bearerToken, process.env.JWTSECRET) 
            const userId =  apiUser.userData._id
            const userStatus =  apiUser.userData.status



            //checking if user account was deactivated by Admin
            const user = await User.findUserFullDetailsById(userId)
            const userSavedSatus = user.result.status

            if(userStatus === userSavedSatus) {
                req.userToken = bearerToken
                next()
            } else {
                res.status(401).json({message: "Your Account was deactivated or Your Email have not been confirmed yet!. Please contact Customer Care."})
            }
        } else {
            next()     
        }
    } catch (error) {
        res.status(500).json({message: error, jwtError: error.jwtError})
    }
}



//checks if a user has token before they can accessing any route
exports.mustBeLoggedIn = async function(req, res, next) {
    try {
        const bearerHeader = req.headers["authorization"]
        const bearer = bearerHeader.split(" ")
        const bearerToken = bearer[1]
        const apiUser = await User.verifyJWTToken(bearerToken, process.env.JWTSECRET) //verifying the token generated when logging in
        const userId =  apiUser.userData._id
        const userStatus =  apiUser.userData.status

        //checking if user account was deactivated by Admin
        const user = await User.findUserFullDetailsById(userId)
        const userSavedSatus = user.result.status

        if(userStatus === userSavedSatus) {
            req.apiUser = apiUser
            req.jwtStatus = "Not Expired"
            next()
        } else {
            res.status(401).json({message: "Your Account was deactivated or Your Email have not been confirmed yet!. Please contact Customer Care."})
        }

    } catch (error){
        res.status(401).json({message: "You must be logged in to perform that action!", jwtError: error.jwtError})
    }
}



//function to log user in
exports.apiLogin = async function(req, res) {
    try {
        let user = new User(req.body)
        const rememberMe = req.body.remember_me
        const userDetails = await user.login()
        const emailVerifiedCheck = userDetails.result.emailVerified
        const userActivatedCheck = userDetails.result.status

        if (emailVerifiedCheck === true && userActivatedCheck === "activated") {

            const userRawId = userDetails.result._id
            const userData = {
                _id: userRawId,
                active: true,
                status: "activated"
            }
            
            const userId = User.extractIdFromMongoId(userRawId)    //extracting the id from mongodb object style
            const userSubStatus = await Subscription.returnUserSubStatus(userId)
            //console.log(userSubStatus)


            const userFirstName = userDetails.result.firstname
            const userLastName = userDetails.result.lastname

            userDetails.result.firstname = userFirstName.charAt(0).toUpperCase() + userFirstName.slice(1)   //capitalizing firstName
            userDetails.result.lastname= userLastName.charAt(0).toUpperCase() + userLastName.slice(1)       //capitalizing lastName

            

            if(rememberMe === "yes") {
                const token = await User.signJWTToken({userData}, process.env.JWTSECRET, '30d') //asigns logged in user a token that lasts longer
                res.status(userDetails.status).json({token: token, userDetails: userDetails.result, userSubscription: userSubStatus.result}) 
            } else {
                const token = await User.signJWTToken({userData}, process.env.JWTSECRET, '24h') //asigns logged in user a token
                res.status(userDetails.status).json({token: token, userDetails: userDetails.result, userSubscription: userSubStatus.result})

            }   

            const loginDetails = {
                loginTime: new Date(),
                loginLocation : ""
            }
            

            await Admin.updateUserTransaction(userId, "login", loginDetails)
            console.log("User Login History Updated")

        } else {
            res.status(401).json({message: "Your Email Address has not been verified or Your Account has been deactivated. Please Contact Customer Care for assistance."})
        }


    } catch(error) {
        console.error(error)
        res.status(error.status).json({message: error.error})
    }
}

//getting registration page from referral link
exports.getRegistrationPage = async function(req, res) {
    try {
        const referralId = req.params.id
        
        if (referralId) {
            const checkResult = await User.findUserByArbsKingID(referralId)

            res.status(checkResult.status).json({message: "User with that referral link confirmed"})

        } else {
            res.status(401).json({message: "Invalid Referral Link!"})
        }
        
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}

// registration function for users
exports.apiRegister = async function (req, res, next) {
    try {
        let user = new User(req.body)          //creates a new instance for every user
        const referralId = req.body.referral_id
        
        if (referralId) {
            const checkResult = await User.findUserByArbsKingID(referralId)
            const referringUser = checkResult.result

            const newUser = await user.register()
            await User.createArbsKingId(newUser.result._id)
            await User.updateReferredFrom(newUser.result._id, referringUser._id)

            req.newUser = newUser.result

        } else {

            const newUser = await user.register()
            await User.createArbsKingId(newUser.result._id)

            req.newUser = newUser.result
        }
             
        next()

    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//adding user payment address when they sign up
exports.addingNewPaymentAddress =  async function(req, res, next) {
    try {
        const newUserId = req.newUser._id
        let wallet;
        try {
            wallet = Wallet.createRandom()          //creating random address for new user
        } catch (error) {
            console.log(error)
            res.status(500).json({message: error})
        }
        const userPaymentAddress = wallet.address;   //getting the public address
        const userPrivateKey = wallet.privateKey;    // getting the private address
        const insertResult = await User.insertUserPaymentAddress(newUserId, req.newUser.email, userPaymentAddress, userPrivateKey) //checking user id before inserting address
        const userDetails = await User.findUserByEmail(req.newUser.email)   //getting user details

        const userData = {
            _id: newUserId,
            active: true,
            status: userDetails.result.status
        }

        
        const token = await User.signJWTToken({userData}, process.env.JWTSECRET, '24h') //asigns logged in customer a token
        const userId = User.extractIdFromMongoId(newUserId)    //extracting the id from mongodb object style
        const userSubStatus = await Subscription.returnUserSubStatus(userId)
        delete userDetails.result.password //removing the password property before sending
                
        req.userId = userId
        req.token = token
        req.subStatus = userSubStatus.result
        req.userDetails = userDetails.result
        req.insertResult = insertResult.result
        next()
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//sending email confirmation after registration
exports.sendEmailConfirmation = async function(req, res, next) {
    try {
        const userId = req.userId
        const token = req.token
        const userDetails = req.userDetails
        const insertResult = req.insertResult
        const userSubStatus = req.subStatus
        const userConfirmEmailLink = `https://client-git-master-sportbettingclient.vercel.app/api/email-confirmation/${userId}/${token}` //link to be sent
        const emailToBeSent = await SendEmail.returnConfirmEmailHTML(userDetails, userConfirmEmailLink) //return HTML email to be sent
            
        const details = {
            userEmail: req.newUser.email,
            subjectOfEmail: 'Confirm Email',
            messageLocation: '.message_sent',
            emailHeaderLocation: '.email-header',
            emailHeader: 'Confirm Your Email',
            emailToBeSent: emailToBeSent
        }

        //sendimg email confirmation to users email
        let sendToUser = new SendEmail(details)
        const sendResult = await sendToUser.sendEmailToUser()
        res.status(sendResult.status).json({message: insertResult, sendEmailResult: sendResult.result})
        
        await Admin.addUserTransactionDetails(userId)
        console.log("User transaction details created")
    } catch (error) {
        console.log(error)
        res.status(error.status).json({message: error.error, ArbsTeam: "Email Confirmation message was not sent. Please Contact customer care to complete sign up."})
    }
}


//checking if user has clicked on the link to verify email and verifying their email
exports.userConfirmEmail = async function(req, res) {
    try {
        const token = req.body.token
        let user = await User.verifyJWTToken(token, process.env.JWTSECRET)
        const userId = user.userData._id

        //checking if user's email is already confirmed
        const emailVerifiedCheck = await User.checkIfUserEmailIsVerified(userId)

        if(emailVerifiedCheck.result === "Verified") {
            res.status(emailVerifiedCheck.status).json({message: "Your Email address have already been Verified."})
        } else {
            //confirming user's Email
            const result = await User.confirmUserEmail(userId).
            res.status(result.status).json({message: result.result})
        }
        
    } catch (error) {
        res.status(error.status).json({message: error.error, jwtError: error.jwtError})
    }
}


//sends email to user to reset their password
exports.userForgotPassword = async function(req, res) {
    try {
        const userEmail = req.body.email
        const emailValid = await User.validateEmail(userEmail)

        if(emailValid.result === "Valid Email") {
            const rawForgottenUser = await User.findUserByEmail(userEmail)
            const forgottenUser = rawForgottenUser.result

            //creating token for user to change password
            const secret = process.env.JWTSECRET + forgottenUser.password
            const payload = {
                email: forgottenUser.email,
                _id: forgottenUser._id
            }
        
            
            //assigning token that expires in 1 hour
            const token = await User.signJWTToken(payload, secret, '1h')
            const userResetPasswordLink = `https://client-git-master-sportbettingclient.vercel.app/api/reset-password/${forgottenUser._id}/${token}`                //link sent to user to resent their password
            const emailToBeSent = await SendEmail.returnResetPasswordHTML(forgottenUser, userResetPasswordLink)


            //sending the link the user will use to setup a new password to user mail
            const userDetails = {
                userEmail: forgottenUser.email,
                subjectOfEmail: 'Reset Password',
                messageLocation: '.message_sent',
                emailHeaderLocation: '.email-header',
                emailHeader: 'Reset Your Password',
                emailToBeSent: emailToBeSent
            }


            let sendToUser = new SendEmail(userDetails)
            const sendEmailResut = await sendToUser.sendEmailToUser()
            res.status(sendEmailResut.status).json({message: sendEmailResut.result})
            
        } else {
            res.status(emailValid.status).json({message: emailValid.error})
        }
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//validating new password and token
exports.resetPassword = async function(req, res, next) { 
    try {
        const tokenToVerify = req.body.token 
        const newPassword = req.body.password
        const userIputId = req.body.id
        
    
        //returning the user's password to verify the token
        const userDetails = await User.findUserFullDetailsById(userIputId)
        userOldPassword = userDetails.result.password
        
        
        const secret = process.env.JWTSECRET + userOldPassword
        const forgottenUserToken = await User.verifyJWTToken(tokenToVerify, secret)
        
        const cleanNewPassword = await User.validatePassword(newPassword) //validating the new password inputed

        //reseting the user's password
        const userId = forgottenUserToken._id
        const resetResult = await User.resetUserPassword(userId, cleanNewPassword.result)
        res.status(resetResult.status).json({message: resetResult.result})
        

        const userTransactions = await Admin.getUserTransactionDetails(userId)
        const userpasswordResetHistory = userTransactions.result.resetPasswordHistory
        const userPasswordResetCount = userpasswordResetHistory.length + 1

        const resetPasswordDetails = {
            passwordResetCount: userPasswordResetCount,
            resetDate: new Date()
        }

        await Admin.updateUserTransaction(userId, 'resetPassword', resetPasswordDetails)      //updating user transaction in database for admin
        console.log("User password reset history updated.")

    } catch (error) {
        res.status(error.status).json({message: error.error, jwtError: error.jwtError})
    }
}


//password change for a logged in user
exports.changePassword = async function(req, res) {
    try {
        const userId = req.apiUser.userData._id
        const inputedOldPassword = req.body.oldpassword
        const newPassword = req.body.newpassword
        const userDetails = await User.findUserFullDetailsById(userId)  //finding the user old password from the token when user logged in.
        const userOldPassword = userDetails.result.password
        const cleanInputedOldPassword = await User.validatePassword(inputedOldPassword) //validating the old password inputed by user
        const cleanNewPassword = await User.validatePassword(newPassword)               //validating the new password inputed by user


        //comparing inputed old password to password in database then saving the new password.
        if (bcrypt.compareSync(cleanInputedOldPassword.result, userOldPassword)) {

            const salt = bcrypt.genSaltSync(10)
            const newPassword = bcrypt.hashSync(cleanNewPassword.result, salt)  //hashing the new password
            const changeResult = await User.changeUserPassword(userId, newPassword)  //changing user password
            
            res.status(changeResult.status).json({message: changeResult.result})

            const userTransactions = await Admin.getUserTransactionDetails(userId)
            const userpasswordChangeHistory = userTransactions.result.changePasswordHistory
            const userPasswordChangeCount = userpasswordChangeHistory.length + 1

            const changePasswordDetails = {
                passwordChangeCount : userPasswordChangeCount,
                changeDate: new Date()
            }

            await Admin.updateUserTransaction(userId, "changePassword", changePasswordDetails)     //updating user transaction in database for admin
            console.log("Password Change History updated.")

        } else {
            res.status(400).json({message: "Incorrect Old Password. If you don't remember your password, you can log out and reset your password."})
        }
        
    } catch(error) {
        res.status(error.status).json({message: error.error})
    }
}


//email change for logged in users
exports.changeEmail = async function(req, res) {
    try {
        const emailToChange = req.body.email
        const userId = req.apiUser.userData._id
        const emailValid = User.validateEmail(emailToChange)
    
    
        if (emailValid.result === "Valid Email") {
            const result =  await User.changeUserEmail(userId, emailToChange)
            res.status(result.status).json({message: result.result})
        } else {
            res.status(400).json({message: emailValid.error})
        }
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//opportunities dashboard for logged in user
exports.arbsOpportunities = async function(req, res) {
    try {
        const userId = req.apiUser.userData._id
        const subCheckResult = req.result
        
    
        //checking if user subscription has expired or if user has any subscription at all, then displaying the arb oppurtunities.
        if(subCheckResult === "Sub expires today" || subCheckResult === "Not Expired") {
            const allArbs = await User.displayAllArbs(userId)
            res.status(allArbs.status).json({arbs: allArbs.result})
        } else {
            res.status(401).json({message: "User doesn't have an active subscription"})
        }
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//getting users current balance displayed on dashboard
exports.getUserCurrentBalance = async function(req, res, next) {
    try {
        const userId = req.apiUser.userData._id
        const userDetails = await User.findUserById(userId)
        const userSpentBalance = userDetails.result.balanceSpent
        const userPaymentAddress = userDetails.result.paymentAddress
        const usdtDecimal = await usdtContract.decimals()
        const busdDecimal = await busdContract.decimals()

        let userBalance;
        const userUsdtBalance = await usdtContract.balanceOf(userPaymentAddress);
        const userBusdBalance = await busdContract.balanceOf(userPaymentAddress);
        const normalizedUsdtBalance = userUsdtBalance.div(BigNumber.from("10").pow(usdtDecimal));
        const normalizedBusdBalance = userBusdBalance.div(BigNumber.from("10").pow(busdDecimal));

        userBalance = normalizedBusdBalance.add(normalizedUsdtBalance)
        userBalance = userBalance.toNumber();


        const userCurrentBalance = userBalance - userSpentBalance  //deducting user balance in their addresss from balance spent



        //updating user balance to database
        await User.updateUserBalance(userId, userCurrentBalance)
        req.userCurrentBalance = userCurrentBalance
        next()


    } catch(error) {
        res.status(error.status).json({message: error.error})
    }
}


//returning user subscription, status and Balance
exports.returnUserSubStatusAndBalance = function(req, res) {
    try {
        const userSub = req.userSub
        const userSubStatus = req.result
        const userBalance = req.userCurrentBalance
        const jwtStatus = req.jwtStatus
    
        if(userSubStatus === "Expired"  || userSubStatus === "No Subscription") {
            const userSubscription = {
                userSub: userSub,
                userSubStatus: userSubStatus,
                subStatus: false,
                userBalance: userBalance,
                jwtStatus: jwtStatus
            }
            res.status(200).json(userSubscription)
        } else {
            const userSubscription = {
                userSub: userSub,
                userSubStatus: userSubStatus,
                subStatus: true,
                userBalance: userBalance,
                jwtStatus: jwtStatus
            }
            res.status(200).json(userSubscription)
        }
    } catch (error) {
        res.status(error).json({message: error})
    }
}


//to render reset page
exports.getResetPage = async function(req, res) {
    try {
        const id = req.params.id
        const token = req.params.token
        const checkUser = await User.findUserFullDetailsById(id)

        if(checkUser.result === "User Not Found") {
            res.status(checkUser.status).json({message: "User with that Id not found!"})
        } else {
            const secret = process.env.JWTSECRET + checkUser.result.password
            const resetUser = await User.verifyJWTToken(token, secret)
            res.status(200).json({message: resetUser})
        }

    } catch (error) {
        res.status(error.status).json({message: error.error, jwtError: error.jwtError})
    }
}


//to render email confrimed page
exports.getConfirmationPage = async function(req, res) {
    try {
        const id = req.params.id
        const token = req.params.token
        const checkUser = await User.findUserFullDetailsById(id)
        
        if (checkUser.result === "User Does Not Exist!") {
            res.status(checkUser.status).json({message: "User with that Id not found!"})
        } else {

            const newUser = await User.verifyJWTToken(token, process.env.JWTSECRET)
            const emailVerifiedCheck = await User.checkIfUserEmailIsVerified(newUser.userData._id)  //checking if user's email is already confirmed
            await User.changeUserStatus(newUser.userData._id)

            if(emailVerifiedCheck.result === "Verified") {
                res.status(400).json({message: "Your Email address have already been Verified."})
            } else {
                //confirming user's Email
                const result = await User.confirmUserEmail(newUser.userData._id)
                res.status(result.status).json({message: result.result})
            
            }
        }

    } catch (error) {
        res.status(error.status).json({message: error.error, jwtError: error.jwtError})
    }
}



// exports.testEmail = async function(req, res) {
//     const userEmail = req.body.email

//     const user = {
//         firstname: "godwin",
//         lastname: "nwafor"
//     }

//     //sending to user mail
//     const userResetPasswordLink = `https://client-git-master-sportbettingclient.vercel.app/api/reset-password/`                //link sent to user to resent their password
//     const emailToBeSent = await SendEmail.returnResetPasswordHTML(user, userResetPasswordLink)


//     //sending the link the user will use to setup a new password to user mail
//     const userDetails = {
//         userEmail: userEmail,
//         subjectOfEmail: 'Reset Password',
//         messageLocation: '.message_sent',
//         emailHeaderLocation: '.email-header',
//         emailHeader: 'Reset Your Password',
//         emailToBeSent: emailToBeSent
//     }

//     let sendToUser = new SendEmail(userDetails)

//     sendToUser.sendEmailToUser().then((result) => {
//         res.status(200).json({message: "Email Sent Sucessfully.", satus: result})
//     }).catch((err) => {
//         res.status(500).json({message: err})
//     })
// }
