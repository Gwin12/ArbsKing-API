const User = require('../models/User')
const Admin = require('../models/Admin')
const Subscription = require('../models/Subscription')
const jwt = require('jsonwebtoken')
const {busdContract, usdtContract} = require('../contract_config/connection')
const { BigNumber } = require("ethers")
const SendEmail = require('../models/SendEmail')



//checking if user has a sub or if it has expired
exports.doesUserHaveSub = async function(req, res, next) {
    try {
        const userId = req.apiUser.userData._id
        const rawUserSub = await Subscription.findUserSub(userId)
        const userSub = rawUserSub.result

        if(userSub !== null) {
            //checking expiring date of userSub
            const subExpiringDate = userSub.expiringDate          
            const subCheckResult = await Subscription.checkSubExpiringDate(subExpiringDate)
            //sending the user subscription and the status of the subscription                
            req.result = subCheckResult.result
            req.userSub = userSub
            next()   
        } else {
            //if user doesn't have a subscription
            req.result = "No Subscription"
            req.userSub = null
            next()
        }   

    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//checking if user already have a sub
exports.checkingUserSubBeforeSubPurschase =  async function(req, res, next) {
    try {
        const userId = req.apiUser.userData._id
        const rawUserSub = await Subscription.findUserSub(userId)
        const userSub = rawUserSub.result
        if(userSub !== null) {
            const subExpiringDate = userSub.expiringDate          
            const subCheckResult = await Subscription.checkSubExpiringDate(subExpiringDate)   //checking expiring date of userSub

            if(subCheckResult.result === "Expired") {
                req.result = subCheckResult.result
                next()
            } else {
                res.status(401).json({message: "You still have an active subscription."})
            }
            
        } else {
            //if user doesn't have a subscription
            req.result = "No Subscription"
            next()
        }   
        
    } catch (error) {
        res.status(error.status).json({message: error.error})
    }
}


//extracting the user payment address before 
exports.extractingUserBalance = async function(req, res, next) {
    try {
        //extract balance from address
        const userId = req.apiUser.userData._id
        const subId = req.body.subscription_id
        const userDetails = await User.findUserById(userId)
        const userPaymentAddress = userDetails.result.paymentAddress
        const subDetails = await Subscription.findSubById(subId) 
        const subCost = subDetails.result.sub_price
        const subDuration = subDetails.result.sub_duration
        const usdtDecimal = await usdtContract.decimals()
        const busdDecimal = await busdContract.decimals()
        let userBalance;

        
        try{
            const userUsdtBalance = await usdtContract.balanceOf(userPaymentAddress);
            const userBusdBalance = await busdContract.balanceOf(userPaymentAddress);
            const normalizedUsdtBalance = userUsdtBalance.div(BigNumber.from("10").pow(usdtDecimal));
            const normalizedBusdBalance = userBusdBalance.div(BigNumber.from("10").pow(busdDecimal));

            userBalance = normalizedBusdBalance.add(normalizedUsdtBalance)
            userBalance = userBalance.toNumber();

            //console.log({userBalance})
        }catch(e){
            console.log(e);
            userBalance = 0;
        }

        
        const balanceCheck = Subscription.checkIfUserBalanceIsUpTo(userBalance, userDetails.result.balanceSpent, subCost)  //checking if user balance if upto sub cost
        

        //checking user balance in user address is not zero
        if (balanceCheck.result === "Success") {

            req.sub = {
                subId: subId,
                subCost: subCost,
                subDuration: subDuration
            }
            req.userDetails = userDetails.result
            await User.updateBalanceSpent(userId, subCost, true);
            next()

        } else {
            res.status(401).json({message: balanceCheck.result})
        }

    } catch(error) {
        res.status(error.status).json({message: error.error})
    }  
}


//creating a new subscription for user
exports.addSubscription = async function(req, res) {
    try {
        const userDetails = req.userDetails
        const userId = req.apiUser.userData._id
        const userRefferedBy = userDetails.referredBy
        const subId = req.sub.subId
        const subCost = req.sub.subCost
        const subDuration = req.sub.subDuration
        const subCheckResult = req.result

        
        const emailToBeSent = await SendEmail.subscriptionPurchaseEmail(userDetails, subCost, subDuration) //return HTML email to be sent

        const details = {
            userEmail: userDetails.email,
            subjectOfEmail: 'Subscription Purchase Successful',
            messageLocation: '.message_sent',
            emailHeaderLocation: '.email-header',
            emailHeader: 'Subscription Purchase',
            emailToBeSent: emailToBeSent
        }

        let sendToUser = new SendEmail(details)
        
        
        const subDetailsForHistory = {
            subId: subId,
            subCost: subCost,
            datePurchased: new Date()
        }


        //if user subscription has expired
        if (subCheckResult === "Expired") {

            const updateResult = await Subscription.updateUserSub(userId, subCost)
            res.status(updateResult.status).json({message: updateResult.result})

            await Admin.updateUserTransaction(userId, "subscription", subDetailsForHistory)     //updating user transacton history for admin

            if (userRefferedBy) {
                await Subscription.creditReferredBy(userId, userRefferedBy, subCost)         //crediting the person that referrd the user
            }



            //SENDING EMAIL AFTER SUBSCRIPTON TO USERS
            const sendResult = await sendToUser.sendEmailToUser()
            console.log(sendResult.result)



            //if user don't have any subscription
        } else if (subCheckResult === "No Subscription") {       

            const addingResult = await Subscription.addNewSubscription(userId, subId, subCost)
            res.status(addingResult.status).json({message: addingResult.result})

            await Admin.updateUserTransaction(userId, "subscription", subDetailsForHistory)     //updating user transacton history for admin

            if (userRefferedBy) {
                await Subscription.creditReferredBy(userId, userRefferedBy, subCost)         //crediting the person that referrd the user
            }


            //SENDING EMAIL AFTER SUBSCRIPTON TO USERS
            const sendResult = await sendToUser.sendEmailToUser()
            console.log(sendResult.result)

        } else {
            res.status(400).json({message: "Invalid Subscription Status"})
        } 


    } catch (error) {
        res.status(error.status).json({message: error})
    }
}
