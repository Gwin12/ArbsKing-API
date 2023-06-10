const bcrypt = require("bcryptjs") //hashing password
const usersCollection = require('../db').db().collection("users") // mongo users collection
const adminsCollection = require('../db').db().collection("admins") // mongo admins collection
const subscriptionsCollection = require('../db').db().collection("subscriptions") // mongo subscription collection
const subscribedUsersCollection = require('../db').db().collection("subscribedUsers") // mongo subscribed Users collection
const userTransactionsCollection= require('../db').db().collection("userTransactionDetails") // mongo Users transactions collection
const validator = require("validator") //validate email
const User = require("./User")
const ObjectId = require('mongodb').ObjectId




let Admin = function(data) {
    this.data = data,
    this.errors = []
}


//clean up
Admin.prototype.cleanUp = function() {
    if(typeof(this.data.username) !== "string") {this.data.username = ""}
    if(typeof(this.data.email) !== "string") {this.data.email = ""}
    if(typeof(this.data.password) !== "string") {this.data.password = ""}
 
    //get rid of unwanted properties
    this.data = {
       username: this.data.username.trim().toLowerCase(),
       email: this.data.email.trim().toLowerCase(),
       password: this.data.password,
       role: "admin"
    }
}
 


//validate prototype
Admin.prototype.validate = function() {
    return new Promise(async (resolve, reject) => {
       if(this.data.username == "") {this.errors.push("You must provide a username.")}
       if(this.data.username !== "" && !validator.isAlphanumeric(this.data.username)) {this.errors.push("username can only contain letters and numbers.")}
       if(!validator.isEmail(this.data.email)) {this.errors.push("You must provide a valid email address.")}
       if(this.data.password == "") {this.errors.push("You must provide a password.")}
       if(this.data.password.length > 0 && this.data.password.length < 8){this.errors.push("Password must be at least 8 characters.")}
       if(this.data.password.length > 50){this.errors.push("Password cannot exceed 50 characters")}
       if(this.data.username.length > 0 && this.data.username.length < 3){this.errors.push("username must be at least 3 characters.")}
       if(this.data.username.length > 30){this.errors.push("username cannot exceed 30 characters.")}
 
       
       //only if username is valid check to see if it's already taken 
       if(this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)) {
          let usernameExists =  await adminsCollection.findOne({username: this.data.username})
          if(usernameExists){this.errors.push('That username is already taken.')}
         }
    
       //only if email is valid check to see if it's already taken 
       if((this.data.email)) {
          let emailExists =  await adminsCollection.findOne({email: this.data.email})
          if(emailExists){this.errors.push('That email is already being used.')}
        }
        resolve()
    })
}
 


//admin login
Admin.prototype.login = function() {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await adminsCollection.findOne({username: this.data.username}).then((attemptedAdmin) => {

           if(attemptedAdmin && bcrypt.compareSync(this.data.password, attemptedAdmin.password)) {            
               resolve({status: 200, result: attemptedAdmin})
           } else{
              reject({status: 401, result: 'Invalid username or password.'})
           }

        }).catch(function(err) {
           reject({status: 500, error: "Please try again.", mongoError: err})
        })
    })
}



//admin registration
Admin.prototype.register = function() {
    return new Promise(async (resolve, reject) => {
        try {
            this.cleanUp()
            await this.validate()
            
            if (!this.errors.length) {
                let salt = bcrypt.genSaltSync(10)       //hashing admin password
                this.data.password = bcrypt.hashSync(this.data.password, salt)
                await adminsCollection.insertOne(this.data)   //inserting admin details into database
                resolve({status: 200, result: "Registration Succesfull."})
            } else {
                reject({status: 400, error: this.errors})  // if there is any error when signing up, it rejects with the error
            }

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}
 
//creating a transaction history for new users
Admin.addUserTransactionDetails = function(userId) {
    return new Promise(async(resolve, reject) => {
        try {
            const user =  {
                userId: userId,
                loginHistory: [],
                depositHistory: [],
                subscriptionHistory: [],
                changePasswordHistory: [],
                resetPasswordHistory: [],
            }
    
            const userTransact = await userTransactionsCollection.findOne({userId: userId})

            if (userTransact) {
                reject({status: 401, error: "User Already have a saved transaction details!"})
            } else {
                await userTransactionsCollection.insertOne(user)
                resolve({status: 200, result: "User transaction object have to added to database."})
            }

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}

//getting all user transactions in database
Admin.getUserTransactionDetails = function (userId, adminId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(userId, adminId)

            const userTrasactions = await userTransactionsCollection.findOne({userId: userId})
            resolve({status: 200, result: userTrasactions})

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


//updating any transaction done by user
Admin.updateUserTransaction = function(userId, updateLocation, updateDetails) {
    return new Promise(async(resolve, reject) => {
        try {

            await User.validateMongoId(userId)
            const userHistory = await userTransactionsCollection.findOne({userId: userId})

            const loginHistory = userHistory.loginHistory
            const depositHistory = userHistory.depositHistory
            const subscriptionHistory = userHistory.subscriptionHistory
            const changePasswordHistory = userHistory.changePasswordHistory
            const resetPasswordHistory = userHistory.resetPasswordHistory


            if (updateLocation === "subscription") {

                subscriptionHistory.push(updateDetails)
                await userTransactionsCollection.findOneAndUpdate({userId: userId}, {$set: {subscriptionHistory: subscriptionHistory}})

            } else if (updateLocation === "deposit") {

                depositHistory.push(updateDetails)
                await userTransactionsCollection.findOneAndUpdate({userId: userId}, {$set: {depositHistory: depositHistory}})

            } else if (updateLocation === "login") {
                
                loginHistory.push(updateDetails)
                await userTransactionsCollection.findOneAndUpdate({userId: userId}, {$set: {loginHistory: loginHistory}})

            } else if (updateLocation === "changePassword") {
                
                changePasswordHistory.push(updateDetails)
                await userTransactionsCollection.findOneAndUpdate({userId: userId}, {$set: {changePasswordHistory: changePasswordHistory}})

            } else if (updateLocation === "resetPassword") {
                
                resetPasswordHistory.push(updateDetails)
                await userTransactionsCollection.findOneAndUpdate({userId: userId}, {$set: {resetPasswordHistory: resetPasswordHistory}})

            } else {
                reject({status: 400, error: "Invalid update location!"})
            }

            resolve({status: 200, result: "User History Update Successfully."})

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


//finding admin by id
Admin.findAdminById = function(adminId) {
    return new Promise(async(resolve, reject) => {
        await User.validateMongoId(adminId)

        adminsCollection.findOne({_id: new ObjectId(adminId)}).then((adminDetails) => {
            if(adminDetails) {
                let admin;
                admin = {
                    _id: adminDetails._id,
                    username: adminDetails.username,
                    email: adminDetails.email,
                    role: adminDetails.role
                }
                resolve({status: 200, result: admin})
            } else {
                reject({status: 404, error: "Admin Not Found!"})
            }

        }).catch((error) => {
            reject({status: 500, error: error})
        })
    })
}



//cleaning up subscription info 
Admin.prototype.cleanUpSubInfo = function() {
    //if(typeof(this.data.sub_price) !== number) {this.data.sub_price = ""}
    if(typeof(this.data.sub_duration) !== "string") {this.data.sub_password = ""}
 
    //get rid of unwanted properties
    this.data = {
        sub_price: this.data.sub_price,
        sub_duration: this.data.sub_duration
    }
}


//validate sub input
Admin.prototype.validateSubInfo = function() {
    return new Promise(async (resolve, reject) => {
       try {
            if(this.data.sub_price == "") {this.errors.push("You must provide a subscription price.")}
            //if(this.data.sub_price !== "" && !validator.isAlphanumeric(this.data.sub_price)) {this.errors.push("Subscription price can only contain letters or numbers.")}
            if(this.data.sub_duration == "") {this.errors.push("You must provide a subscription duration.")}
            //if(this.data.sub_duration !== "" && !validator.isAlphanumeric(this.data.sub_duration)) {this.errors.push("Subscription duration can only contain letters or numbers.")}

            /* //only if sub already exist
            if(validator.isAlphanumeric(this.data.sub_name)) {
                let subExists =  await subscriptionsCollection.findOne({sub_name: this.data.sub_name})
                if(subExists){this.errors.push('That Subscription already exists.')}
            }*/
            resolve()
       } catch (error) {
            reject(error)
       }
    })
}
 

//admin creating a new subscription
Admin.prototype.createSub = function(adminId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(adminId)
            await this.cleanUpSubInfo()
            await this.validateSubInfo()
       
       
            //saving user to database
            if (!this.errors.length) { 
                subscriptionsCollection.insertOne(this.data).then(() => {
                    resolve({status: 200, result: "Subcription added"})
                }).catch((error) => {
                    reject({status: 500, error: "Subscription can not be added at the moment.", mongoError: error})
                })
            } else {
                reject({status: 400, error: this.errors})
            }

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


//deactivating user account
Admin.deactivateUserAccount = function(userId, adminId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(userId, adminId)

            await usersCollection.findOneAndUpdate({_id: new ObjectId(userId)}, {$set: {status: "deactivated"}})    //changing user status to deactivated
            resolve({status: 200, result: "User account deactivated successfully."})

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


//activating a deactivated user account
Admin.activateUserAccount = function(userId, adminId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(userId, adminId)

            await usersCollection.findOneAndUpdate({_id: new ObjectId(userId)}, {$set: {status: "activated"}})  //changing user status to activated
            resolve({status: 200, result: "User account activated successfully."})

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


//clearing all users details
Admin.clearAllUserData = function(adminId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(adminId)

            await usersCollection.deleteMany()
            resolve({status: 200, result: "All Users data have been deleted"})
        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}

//deleting one user from database
Admin.deleteOneUser = function(adminId, userId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(adminId, userId)

            await usersCollection.deleteOne({_id: new ObjectId(userId)})
            resolve({status: 200, result: "User have been deleted Successfully."})
        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}

//transfering user's funds from address to treasury
Admin.transferUserFundToTreseaury = function(adminId, balanceSpent, privateKey) {
    return new Promise(async(resolve, reject) => {
        try {
            resolve({status: 200, result: "Success"})
        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


//returning every registered users for the admin
Admin.returnAllUsers = function(adminId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(adminId)         //validating admin Id 
            const allUsers = await usersCollection.find().toArray()
    
            if(allUsers.length) {
                resolve({status: 200, result: allUsers})
            } else {
                reject({status: 404, error: "No user found at the moment."})
            }

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}

//returning all subscribed users for admin
Admin.returnAllSubScribedUsers = function(adminId) {
    return new Promise(async(resolve, reject) => {
        try {
            await User.validateMongoId(adminId)

            const subbedUsers = await subscribedUsersCollection.find().toArray()
            if (subbedUsers.length) {
                resolve({status: 200, result: subbedUsers})
            } else {
                reject({status: 404, error: "No subscribed users at the moment."})
            }

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}

//deleting a user transaction details from the database
Admin.deleteAUserTransactions = function(adminId, userId) {
    return new Promise(async(resolve, reject) =>{
        try {
            await User.validateMongoId(adminId, userId)
            await userTransactionsCollection.deleteOne({userId: userId})
            resolve({status: 200, result: "User Transaction details deleted successfully."})

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}


//deleting a user transaction details from the database
Admin.clearAllUsersTransactions = function(adminId) {
    return new Promise(async(resolve, reject) =>{
        try {
            await User.validateMongoId(adminId)
            await userTransactionsCollection.deleteMany()
            resolve({status: 200, result: "All Users Transaction details deleted successfully."})

        } catch (error) {
            reject({status: 500, error: error})
        }
    })
}

module.exports = Admin