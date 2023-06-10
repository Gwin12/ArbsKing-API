const User = require('../models/User')
const Admin = require('../models/Admin')
const ScrapData = require('../ScrapData')
const Subscription = require('../models/Subscription')
const SendEmail = require('../models/SendEmail')
const jwt = require('jsonwebtoken')





//checking if its an admin 
exports.mustBeAdmin = async function(req, res, next) {
    try {
        const bearerHeader = req.headers["authorization"]
        const bearer = bearerHeader.split(" ")
        const bearerToken = bearer[1]
        const apiAdmin = await User.verifyJWTToken(bearerToken, process.env.JWTSECRET) //verifying the token generated when logging in
        const adminId = apiAdmin.adminData._id
        //console.log(apiAdmin)
        const findAdmin = await Admin.findAdminById(adminId)

        if(findAdmin.status === 200) {
            req.adminId = adminId
            req.apiAdmin = apiAdmin
            next()
        } else {
            res.status(401).json({message: "You must be an Admin to perform that action!"})
        }

    } catch(error) {
        //console.log(error)
        res.status(401).json({message: "You must be logged in to perform that action!", error: error.error, jwtError: error.jwtError})
    }
}


//login function for admin
exports.adminLogin = async function(req, res) {
    try {
        let admin = new Admin(req.body)
        const adminDetails = await admin.login()
        delete adminDetails.result.password
        const adminData = {
            _id: adminDetails.result._id,
            active: true,
        }
        const token = await User.signJWTToken({adminData}, process.env.JWTSECRET, '24h') //asigns logged in admin a token that lasts longer
        res.status(adminDetails.status).json({token: token, adminDetails: adminDetails.result})
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


// registration function for admins
exports.adminRegister = async function (req, res, next) {
    try {
        const admin = new Admin(req.body)          //creates a new instance for every admin
        const adminReg = await admin.register()
        res.status(adminReg.status).json({message: adminReg.result})        
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//creating a subscription 
exports.createSubscription = async function(req, res) {
    try {
        const adminId = req.adminId
        const subscription = new Admin(req.body)
        subCreateResult = await subscription.createSub(adminId)

        res.status(subCreateResult.status).json({message: subCreateResult.result})
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//deactivating a user account
exports.deactivateUser = async function(req, res) {
    try {
        const adminId = req.adminId
        const userId = req.body.user_id
        const userDeactivate = await Admin.deactivateUserAccount(userId, adminId)

        res.status(userDeactivate.status).json({message: userDeactivate.result})

    } catch (error) {
        console.log(error)
        res.status(error.status).json({message: error.error})
    }
}

//activating a deactivated user account
exports.activateUser = async function(req, res) {
    try {
        const adminId = req.adminId
        const userId = req.body.user_id
        const activateUser = await Admin.activateUserAccount(userId, adminId)

        res.status(activateUser.status).json({message: activateUser.result})
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//clearing all users details
exports.deleteAllUsers = async function(req, res) {
    try {
        const adminId = req.adminId
        const clearUserdsResult = await Admin.clearAllUserData(adminId)
        res.status(clearUserdsResult.status).json({message: clearUserdsResult.result})
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//deducting user's fund from their address
exports.deductUserFund = async function(req, res) {
    try {
        const adminId = req.adminId
        const userId = req.body.user_id
        const userDetails = await User.findUserFullDetailsById(userId)
        const balanceSpent = userDetails.result.balanceSpent
        const privateKey = userDetails.result.privateKey


        const transferResult = await Admin.transferUserFundToTreseaury(adminId, balanceSpent, privateKey)

        if(transferResult.result === "Success") {
            const result = await User.resetUserBalanceSpent(userId)
            res.status(result.status).json({message: result.result})
        } else {
            res.status(transferResult.status).json({errorMessage: transferResult.error, message: "User funds have not been moved to treasury, therefore user balancespent can't be updated yet!"})
        }

    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//admin manually scrapping data 
exports.fetchArbsOpportunities = async function(req, res) {
    try {
        const adminId = req.adminId
        let scrapData = new ScrapData()
        const scrappingResult = await scrapData.getScrappedData(adminId)

        res.status(scrappingResult.status).json({message: scrappingResult.result})

    } catch (error) {
        res.status(error.status).json({message: error.error, scrapperError: error.scrapError})
    }
}


//fetching every user
exports.fetchAllUsers = async function(req, res) {
    try {
        const adminId = req.adminId
        const allUsersResult = await Admin.returnAllUsers(adminId)
        const allUsers = allUsersResult.result

        allUsers.forEach(user => {
            delete user.password
        });

        res.status(allUsersResult.status).json({message: allUsers})
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//fetching all subscribed users
exports.fetchAllSubscribedUsers = async function(req, res) {
    try {
        const adminId = req.adminId

        const returnUser = await Admin.returnAllSubScribedUsers(adminId)
        res.status(returnUser.status).json({message: returnUser.result})

    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//admin deleting one user
exports.deleteOneUser = async function(req, res) {
    try {
        const adminId = req.adminId
        const userId = req.body.userId  
        await User.findUserById(userId)


        const deleteUser = await Admin.deleteOneUser(adminId, userId)
        res.status(deleteUser.status).json({message: deleteUser.result})

    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}

//deleting one user transaction details
exports.deleteOneUserTransactions = async function(req, res) {
    try {
        const userId = req.body.userId
        const adminId = req.adminId

        const deleteTransact = await Admin.deleteAUserTransactions(adminId, userId)
        res.status(deleteTransact.status).json({message: deleteTransact.result})

    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//deleting all users transaction details
exports.deleteAllUsersTransactions = async function(req, res) {
    try {
        const adminId = req.adminId

        const deleteTransact = await Admin.clearAllUsersTransactions(adminId)
        res.status(deleteTransact.status).json({message: deleteTransact.result})

    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}

//searchig through the users collections and returning their details and transaction history
exports.searchUserDetails = async function(req, res) {
    try {
        const adminId = req.adminId
        const searchFilter = req.body.search_filter
        const searchKeyWord = req.body.search_keyWord
        await User.validateMongoId(adminId)
        const userDetails = []
        
        if (searchFilter === "byId") {
            
            const user = await User.findUserFullDetailsById(searchKeyWord)
            delete user.result.password
            const userTransactionDetails = await Admin.getUserTransactionDetails(searchKeyWord, adminId)
            userDetails.push(user.result,  {userTransactionDetails: userTransactionDetails.result})
            
        } else if (searchFilter === "byUsername") {
            
            const user = await User.findUserByUsername(searchKeyWord)
            delete user.result.password
            
            const userId = await User.extractIdFromMongoId(user.result._id)
            const userTransactionDetails = await Admin.getUserTransactionDetails(userId, adminId)
            userDetails.push(user.result, {userTransactionDetails: userTransactionDetails.result})
            
        } else if (searchFilter === "byEmail") {
            
            const user = await User.findUserByEmail(searchKeyWord)
            delete user.result.password

            const userId = await User.extractIdFromMongoId(user.result._id)
            const userTransactionDetails = await Admin.getUserTransactionDetails(userId, adminId)
            userDetails.push(user.result, {userTransactionDetails: userTransactionDetails.result})

        } else {
            res.status(404).json({message: "Invalid Search Filter!"})
        }


        res.status(200).json({message: userDetails})
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}

//sending referral code to user email
exports.sendUserReferralEmail = async function(req, res) {
    try {
        const adminId = req.adminId
        await User.validateMongoId(adminId)
        const userId = req.body.user_id
        const user = await User.findUserById(userId)
        const userDetails = user.result
        const userEmail = userDetails.email
        const userReferralId = userDetails.arbsKingId

        const userReferralLink = `https://client-git-master-sportbettingclient.vercel.app/api/register-referred/${userReferralId}`
        const emailToBeSent = await SendEmail.returnReferralEmail(userDetails, userReferralLink) //return HTML email to be sent
            
        const details = {
            userEmail: userEmail,
            subjectOfEmail: 'Referral Link',
            messageLocation: '.message_sent',
            emailHeaderLocation: '.email-header',
            emailHeader: 'Your Referral Link',
            emailToBeSent: emailToBeSent
        }

        //sendimg email confirmation to users email
        let sendToUser = new SendEmail(details)
        const sendResult = await sendToUser.sendEmailToUser()
        res.status(sendResult.status).json({message: "Referral Link has Sent to User.", sendEmailResult: sendResult.result})

    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}