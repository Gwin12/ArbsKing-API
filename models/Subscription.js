const bcrypt = require("bcryptjs") //hashing password
const usersCollection = require('../db').db().collection("users") // mongo users collection
const adminsCollection = require('../db').db().collection("admins") // mongo admins collection
const subscriptionsCollection = require('../db').db().collection("subscriptions") // mongo subscription collection
const subscribedUsersCollection = require('../db').db().collection("subscribedUsers") // mongo subscribed Users collection
const ObjectId = require('mongodb').ObjectId
const User = require('../models/User')


//what is being exported
let Subscription = function(data) {
   this.data = data
   this.errors = []
}




//finds the subscriptions saved by admin
Subscription.findSubById = function(subId) {
    return new Promise(async (resolve, reject) => {
        try {
            await User.validateMongoId(subId)

            await subscriptionsCollection.findOne({_id: new ObjectId(subId)}).then(function(subscription) {          //checking database to see if admin has any post & storing it into "user"
                if(subscription) {   
                    resolve({status: 200, result: subscription})
                } else {
                    reject({status: 404, result: "Subcription Not Found!"})
                }
                }).catch(function(err) {
                    reject({status: 500, error: err})
            })

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}
 


//finding subscription made by user
Subscription.findUserSub = function(userId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(userId)
    
            subscribedUsersCollection.findOne({userId: userId}).then((userSub) => {
                resolve({saatus: 200, result: userSub})
            }).catch(() => {
                reject({status: 404, error: "User Does not have an Active Subscription."})
            })

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}



//checking if the subscription has expired
Subscription.checkSubExpiringDate = function(subDate) {
    return new Promise(async(resolve, reject) => {
        const currentDate = new Date()
        const subExpiringDate =  new Date(subDate)
        
        try {
            
            if(currentDate > subExpiringDate) {
                resolve({status: 200, result: "Expired"})
            } else if(currentDate < subExpiringDate) {
                resolve({status: 200, result: "Not Expired"})
            } else {
                resolve({status: 200, result: "Sub expires today"})
            }

        } catch(error) {
            reject({status: 500, error: error})
        }
        
    })
}



// returning user subscription and status of their subscription
Subscription.returnUserSubStatus = function(userId) {
    return new Promise(async (resolve, reject) => {
        try {
            const userSubResult = await Subscription.findUserSub(userId)
            const userSub = userSubResult.result
    
            if(userSub !== null) {
                const subExpiringDate = userSub.expiringDate          
                const statusResult = await Subscription.checkSubExpiringDate(subExpiringDate) //checking expiring date of userSub
                resolve({status: statusResult.status, result: {userSub, statusResult: statusResult.result}})  //sending the user subscription and the status of the subscription        
            } else {
               resolve({status: 404, result: "No Subscription"})
           }   
    
        } catch (error) {
            reject({status: error.status, error: error.error})
        }
    })
}



//checks if user balance is up to sub cost
Subscription.checkIfUserBalanceIsUpTo = function(userBalance, balanceSpent, subCost) {
    const balanceAfterPaidAmount = userBalance - balanceSpent;
    if(balanceAfterPaidAmount >= subCost) {
        return({status: 200, result: "Success"});
    } else {
        return({status: 401, result: "You don't have sufficient balance."});
    }
}



//recieves subscription cost and returns the duration
Subscription.returnSubDuration = function(subCost) {
    if (subCost === 10) {
        return(1)
    } else if (subCost === 55) {
        return(6)
    } else if (subCost === 110) {
        return(12)
    } else {
        return(0)
    }
}



//adding a new subscription for user
Subscription.addNewSubscription = function(userId, subId, subCost) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(userId, subId)
            const subDuration =  Subscription.returnSubDuration(subCost)  //getting duration of subscription from the cost
    
            let createdDate = new Date()
            createdDate.setMonth(createdDate.getMonth() + subDuration)    //increasing user expiring date based on the sub purchased
    
            const newUserSub = {
                userId: userId,
                subACreatedAt: new Date(),
                expiringDate: createdDate.toISOString().slice(0, 10),
                subId: subId,
            } 
    
            //inserting user new subscription in database
            await subscribedUsersCollection.insertOne(newUserSub)
            resolve({status: 200, result: "Subscription purchased successfully."})


        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


//updating user subcription
Subscription.updateUserSub = function(userId, subCost) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(userId)
            const subDuration =  Subscription.returnSubDuration(subCost)  //getting duration of subscription from the cost
            
            let createdDate = new Date()
            createdDate.setMonth(createdDate.getMonth() + subDuration)    //increasing user expiring date based on the sub purchased
            const newExpiringDate = createdDate.toISOString().slice(0, 10)
            const currentDate = new Date()
    
    
            //updating user subscription in database
            await subscribedUsersCollection.findOneAndUpdate({userId: userId}, {$set: {expiringDate: newExpiringDate, subACreatedAt: currentDate}})
            resolve({status: 200, result: "Subscription purchased successfully."})
            
        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}

//crediting the person that reffered the user
Subscription.creditReferredBy = function(userId, refferedBy, subCost) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(userId, refferedBy)
            
            const creditAmount = 0.1 * subCost
            const findResult = await User.findUserById(refferedBy)
            const referringUserBalanceSpent = findResult.result.balanceSpent
            const userNewBalance = referringUserBalanceSpent - creditAmount


            await usersCollection.findOneAndUpdate({_id: new ObjectId(refferedBy)}, {$set: {balanceSpent: userNewBalance}})

            console.log("Reffering User Have Been Credited Their Bonus.")
            resolve({status: 200, result: "Reffering User Have Been Credited Their Bonus."})

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


module.exports = Subscription 