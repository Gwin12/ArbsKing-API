const bcrypt = require("bcryptjs") //hashing password
const usersCollection = require('../db').db().collection("users") // mongo users collection
const adminsCollection = require('../db').db().collection("admins") // mongo admins collection
const subscriptionsCollection = require('../db').db().collection("subscriptions") // mongo subscription collection
const subscribedUsersCollection = require('../db').db().collection("subscribedUsers") // mongo subscribed Users collection
const scrappedDataCollection = require('../db').db().collection("scrappedData") // mongo scrapped data collection
const visitorWaitListCollection = require('../db').db().collection("visitorWaitList") // mongo visitor waitlist data collection
const validator = require("validator") //validate email
const ObjectId = require('mongodb').ObjectId
const jwt = require('jsonwebtoken')




//what is being exported
let User = function (data) {
   this.data = data
   this.errors = []

}



//cleaning up visitor contact information
User.cleanUpVisitorContactDetails = function(contactDetails) {
   return new Promise(async(resolve, reject) => {
      try {
         const visitorName = contactDetails.name.toLowerCase()
         const visitorMessage = contactDetails.message
         const validateEmail =  await User.validateEmail(contactDetails.email)

         if(validateEmail.result === "Valid Email" && typeof(visitorName) === "string" && typeof(visitorMessage) === "string") {
            resolve({status: 200, result: {name: visitorName, email: contactDetails.email, message: visitorMessage}})
         } else {
            reject({status: 400, error: "Please Provide Valid Contact Info!"})
         }

      } catch (error) {
         reject({status: 400, error: error})
      }
   })
}



//adding visitors to wait list
User.addVisitorToWaitList = function(visitorEmail) {
   return new Promise(async(resolve, reject) => {
      try {
         const isVisitorOnWaitList = await visitorWaitListCollection.findOne({email: visitorEmail})

         if (isVisitorOnWaitList) {
            reject({status: 400, error: "You have already been added to our WAITLIST!"})
         } else {
            visitorWaitListCollection.insertOne({email: visitorEmail}).then(() => {
               resolve({status: 200, result: "You've been added to our WAITLIST. We will get back to you."})
            }).catch((err) => {
               reject({status: 500, error: "An error has occured. Try again later.", mongoError: err})
            })
         }

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}

//clean up user registration details
User.prototype.cleanUp = function () {
   if (typeof (this.data.firstname) !== "string") { this.data.firstname = "" }
   if (typeof (this.data.lastname) !== "string") { this.data.lastname = "" }
   if (typeof (this.data.username) !== "string") { this.data.username = "" }
   if (typeof (this.data.email) !== "string") { this.data.email = "" }
   if (typeof (this.data.password) !== "string") { this.data.password = "" }

   //get rid of unwanted properties
   this.data = {
      firstname: this.data.firstname.trim().toLowerCase(),
      lastname: this.data.lastname.trim().toLowerCase(),
      username: this.data.username.trim().toLowerCase(),
      email: this.data.email.trim().toLowerCase(),
      password: this.data.password,
      status: "deactivated",
      balance: 0,
      arbsKingId: "",
      paymentAddress: "",
      privateKey: "",
      referredBy: "",
      emailVerified: false,
      createdAccountDate: new Date(),
      balanceSpent: 0
   }
}


//validate user registration details
User.prototype.validate = function () {
   return new Promise(async (resolve, reject) => {
      if (this.data.firstname == "") { this.errors.push("You must provide a first name.") }
      if (this.data.firstname !== "" && !validator.isAlphanumeric(this.data.firstname)) { this.errors.push("First name can only contain letters.") }
      if (this.data.lastname == "") { this.errors.push("You must provide a last name.") }
      if (this.data.lastname !== "" && !validator.isAlphanumeric(this.data.lastname)) { this.errors.push("Last name can only contain letters.") }
      if (this.data.username == "") { this.errors.push("You must provide a username.") }
      if (this.data.username !== "" && !validator.isAlphanumeric(this.data.username)) { this.errors.push("Username can only contain letters and numbers.") }
      if (!validator.isEmail(this.data.email)) { this.errors.push("You must provide a valid email address.") }
      if (this.data.password == "") { this.errors.push("You must provide a password.") }
      if (this.data.password.length > 0 && this.data.password.length < 8) { this.errors.push("Password must be at least 8 characters.") }
      if (this.data.password.length > 50) { this.errors.push("Password cannot exceed 50 characters") }
      if (this.data.username.length > 0 && this.data.username.length < 3) { this.errors.push("username must be at least 3 characters.") }
      if (this.data.username.length > 30) { this.errors.push("username cannot exceed 30 characters.") }


      //only if username is valid check to see if it's already taken 
      if (this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)) {
         let usernameExists = await usersCollection.findOne({ username: this.data.username })
         if (usernameExists) { this.errors.push('That username is already taken.') }
      }

      //only if email is valid check to see if it's already taken 
      if ((this.data.email)) {
         let emailExists = await usersCollection.findOne({ email: this.data.email })
         if (emailExists) { this.errors.push('That email is already being used.') }
      }
      resolve()
   })
}

//validating user Id in the token sent back
User.validateMongoId = function (mongoId, mongoId2) {
   return new Promise(async(resolve, reject) => {
      try {
         const errors = []
         //console.log(mongoId2)
         if (mongoId2 === undefined) {
            if (typeof (mongoId) !== "string" || !ObjectId.isValid(mongoId)) { errors.push("Invalid MongoDB Id.") }
         } else {
            if (typeof (mongoId || mongoId2) !== "string" || !ObjectId.isValid(mongoId) || !ObjectId.isValid(mongoId2)) { 
               errors.push("Invalid MongoDB Id.") 
            }
         }
      
      
         if (!errors.length) {
            resolve()
         } else {
            reject(errors)
         }

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//sigining new token for users
User.signJWTToken = function(payload, secret, duration) {
   return new Promise(async(resolve, reject) => {
      try {
         const signedToken =  jwt.sign(payload, secret, {expiresIn: duration})
         resolve(signedToken)
      } catch (error) {
         reject({status: 401, error: error})
      }
   })
}

//verifying JWT token
User.verifyJWTToken = function (token, secret) {
   return new Promise(async(resolve, reject) => {
      try {
         const verifiedUser =  jwt.verify(token, secret)
         resolve(verifiedUser)
      } catch (error) {
         reject({status: 401, error:"Invalid Token", jwtError: error.message})
      }
   })
}

//creating a new user ArbsKing personal ID
User.createArbsKingId = function(userRawId) {
   return new Promise(async(resolve, reject) => {
      try {
         const userId = userRawId.toString()
         const lastSixDigits = userId.slice(-6)
         const arbsKingId = "arbsKing-"+ lastSixDigits


         await usersCollection.findOneAndUpdate({_id: new ObjectId(userId)}, {$set: {arbsKingId: arbsKingId}})
         resolve({status: 200, result: "User ArbsKing ID created succesfully.", UserArbsKingId: arbsKingId})

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}

//cleaning up inputed arbsking id
User.cleanUpArbsKingId = function(userArbsKingId) {
   return new Promise(async(resolve, reject) => {
      try {

         if(typeof(userArbsKingId) !== "string" || userArbsKingId === "") {
            reject({status: 401, error: "Invalid ArbsKing ID. Please Provide a valid ID."})
         }

         const cleanId = userArbsKingId.trim()

         resolve(cleanId)

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//finding user by the arbsaKing Id giving on registration
User.findUserByArbsKingID = function (userArbsKingId) {
   return new Promise(async(resolve, reject) => {
      try {
         const cleanID = await User.cleanUpArbsKingId(userArbsKingId)

         const user = await usersCollection.findOne({arbsKingId: cleanID})

         if (user) {
            delete user.password
            delete user.privateKey
            resolve({status: 200, result: user})
         } else {
            reject({status: 404, error: "User with that ArbsKing Id not found!"})
         }

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}

//updating who reffered the user on the user object
User.updateReferredFrom = function(rawNewUserId, rawReferredFromId) {
   return new Promise(async(resolve, reject) => {
      try {
         const newUserId = rawNewUserId.toString()
         const referredFromId = rawReferredFromId.toString()

         await User.validateMongoId(newUserId, referredFromId)

         await usersCollection.findOneAndUpdate({_id: new ObjectId(newUserId)}, {$set: {referredBy: referredFromId}})
         resolve({status: 200, result: "Referred from Id Updated."})

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//changing user's status
User.changeUserStatus = function (userId) {
   return new Promise(async(resolve, reject) => {
      try {

         await User.validateMongoId(userId)

         await usersCollection.findOneAndUpdate({_id: new ObjectId(userId)}, {$set: {status: "activated"}})
         .then(() => {
            resolve({status: 200, result: "Status Change Successfully"})
         }).catch((err) => {
            reject({status: 500, error: err} )
         })

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//updating user's balance spent after purchasing a subscription
User.updateBalanceSpent = async function (userId, subCost, isAdded) {
   return new Promise(async(resolve, reject) => {
      try {

         const multiplier = isAdded ? 1 : -1;
         const userDetails = await User.findUserById(userId);
      
         await usersCollection.findOneAndUpdate({ _id: new ObjectId(userId) }, {
            $set: {
               balanceSpent: userDetails.result.balanceSpent + (subCost * multiplier)
            }
         }).then(() => {
            resolve({status: 200, result: "User balance Spent updated succesfully."})
         }).catch((error) => {
            reject({status: 500, error: error})
         })

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//updating user's balance in database
User.updateUserBalance  = async function(userId, userCurrentBalance) {
   return new Promise(async (resolve, reject) => {
      try {
         await User.validateMongoId(userId)

         usersCollection.findOneAndUpdate({_id: new ObjectId(userId)}, 
         {$set: {balance: userCurrentBalance}}).then(() => {
            resolve({status: 200, result: "Successfully updated user's balance"})
         }).catch(() => {
            reject({status: 500, result: "User's balance was not updated!"})
         })
      } catch (error) {
         reject({status: 401, error: error})
      }
   })
}


//reseting user's balance spent
User.resetUserBalanceSpent = function(userId) {
   return new Promise(async (resolve, reject) => {
      try {
         await User.validateMongoId(userId)

         usersCollection.findOneAndUpdate({_id: new ObjectId(userId)}, 
         {$set: {balanceSpent: 0}}).then(() => {
            resolve({status: 200, result: "Successfully updated user's balance Spent"})
         }).catch(() => {
            reject({status: 500, error: "User's balance Spent was not updated!"})
         })
      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//extracting the id only from mongodb object style
User.extractIdFromMongoId = function(mongoId) {
   try {
      const objectIdString = JSON.stringify(mongoId);
      const regex = /"([a-fA-F0-9]+)"/; // Match hexadecimal values inside quotes
      const match = regex.exec(objectIdString);
   
   
      if (match) {
         let objectId = match[1]; // Extract the hexadecimal value
         return(objectId)
      }

   } catch (error) {
      return({status: 500, error: 'Extracting Id failed!'})
   }
}


//validating users email
User.validateEmail = function (email) {
   return new Promise(async(resolve, reject) => {
      try {
         const errors = []
         if (typeof (email) !== "string") { email = "" }
         if (!validator.isEmail(email)) { errors.push("You must provide a valid email address.") }
      
         //checking if there's no errors
         if (!errors.length) {
            resolve ({status: 200, result: "Valid Email", validEmail: email})
         } else {
            reject ({status: 400, error: errors})
         }
      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//users login
User.prototype.login = function () {
   return new Promise(async (resolve, reject) => {
      try {
         this.cleanUp()
         const attemptedUser =  await usersCollection.findOne({ username: this.data.username })
   
         if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
            delete attemptedUser.password
            delete attemptedUser.privateKey
            resolve({status: 200, result: attemptedUser})
         } else {
            reject({status: 400, error: 'Invalid Username or Password!'})
         }

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//registration for users
User.prototype.register = function () {
   try {
      return new Promise(async (resolve, reject) => {
         //validating and clean user 
         this.cleanUp()
         await this.validate()
   
   
         //saving user to database
         if (!this.errors.length) {
            
            let salt = bcrypt.genSaltSync(10)   //hashing user password
            this.data.password = bcrypt.hashSync(this.data.password, salt)
            await usersCollection.insertOne(this.data)   //inserting user details into database
   
            await usersCollection.findOne({ username: this.data.username }).then((newUser) => {
               resolve({status: 200, result: newUser})
            }).catch((e) => {
               reject({status: 404, error: "Could Not Find User", mongoError: e})
               console.log(e)
            })
   
         } else {
            reject({status: 400, error: this.errors})  // if there is any error when signing up, it rejects with the error
         }
      })

   } catch (error) {
      reject({status: 500, error: error})
   }
}



//inserting user payment address
User.insertUserPaymentAddress = function (newUserId, newUserEmail, userPaymentAddress, userPrivateKey) {
   return new Promise((resolve, reject) => {
      usersCollection.findOneAndUpdate({ _id: new ObjectId(newUserId) }, { $set: { paymentAddress: userPaymentAddress, privateKey: userPrivateKey } }).then(() => {
         
         resolve({status: 200, result: `Registration Successful. A Confirmation Email as been sent to ${newUserEmail}.`})
      }).catch((e) => {
         reject({status: 500, error: "Sorry, payment address can not be added at the moment. Please contact Customer Care.", momgoError: e})
      })
   })
}


//confirming user email after link as been sent to user's email
User.confirmUserEmail = function(userId) {
   return new Promise(async(resolve, reject) => {
      try {
         await User.validateMongoId(userId)

         usersCollection.findOneAndUpdate({_id: new ObjectId(userId)}, {$set: {emailVerified: true}})  //replacing user's email verified from false to true
         .then(() => {
            resolve({status: 200, result: "Email Verification Successful."})
         }).catch((err) => {
            reject({status: 500, error: "Email Verification Failed!", mongoError: err})
         })

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//checks if user's email is verified
User.checkIfUserEmailIsVerified = function(userId) {
   return new Promise(async(resolve, reject) => {
      try {
         await User.validateMongoId(userId)

         const user = await usersCollection.findOne({_id: new ObjectId(userId)})
         if (user.emailVerified === true) {
            resolve({status: 200, result: "Verified"})
         } else {
            resolve({status: 400, result: "Not Verified"})
         }
         
      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}



//finds all details of user
User.findUserFullDetailsById = function (userId) {
   return new Promise(async (resolve, reject) => {
      try {
         await User.validateMongoId(userId)
         const user = await usersCollection.findOne({ _id: new ObjectId(userId) }) 
         
         if (user) {
            resolve({status: 200, result: user})
         } else {
            reject({status: 404, error: "User Not Found"})
         }
         
      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//finds user in database and returns only needed details
User.findUserById = function (userId) {
   return new Promise(async (resolve, reject) => {
      try {
         await User.validateMongoId(userId)

         const user = await usersCollection.findOne({ _id: new ObjectId(userId) })        //checking database to see if admin has any post & storing it into "user"
         if (user) {
            delete user.password 
            delete user.privateKey
            resolve({status: 200, result: user})
         } else {
            reject({status: 404, error: "User Does Not Exist!"})
         }
      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//checks if the email exist and returning needed user's details 
User.findUserByEmail = function (emailToAuth) {
   return new Promise(async (resolve, reject) => {
      try {
         const inputEmail = await User.validateEmail(emailToAuth)
         const userEmailExist = await usersCollection.findOne({ email: inputEmail.validEmail })     // finds email in database
         
         if (userEmailExist) {
            resolve({status: 200, result: userEmailExist})
         } else {
            reject({status: 404, error: "Email does not exist"})
         }

      } catch (error) {
         reject({status: 500,  error: error})
      }
   })
}

//finding user by username
User.findUserByUsername = function (username) {
   return new Promise(async(resolve, reject) => {
      try {
         if(typeof(username) === "string") {
            const user = await usersCollection.findOne({username: username})
   
            if (user) {
               resolve({status: 200, result: user})
            } else {
               reject({status: 404, error: "User Not Found"})
            }

         } else {
            reject({status: 400, error: "Username can only be a string!"})
         }

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}

//validate new password from user
User.validatePassword = function (newPassword) {
   return new Promise((resolve, reject) => {
      try {
         let errors = []
         if (typeof (newPassword) !== "string") { newPassword = "" }
         if (newPassword == "") { errors.push("You must provide a Password.") }
         if (newPassword.length < 8) { errors.push("Password must be at least 8 characters.") }
         if (newPassword.length > 50) { errors.push("Password cannot exceed 50 characters") }
   
   
         //checking if there's no errors
         if (!errors.length) {
            resolve({status: 200, result: newPassword})
         } else {
            reject({status: 400, error: errors})
         }

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}

// finds user by Id and resets the password
User.resetUserPassword = function (userId, userNewPassword) {
   return new Promise(async (resolve, reject) => {
      try {
         await User.validateMongoId(userId)

         let salt = bcrypt.genSaltSync(10)
         userNewPassword = bcrypt.hashSync(userNewPassword, salt)  //hashing the new password
         await usersCollection.findOneAndUpdate({ _id: new ObjectId(userId) }, { $set: { password: userNewPassword } })
         resolve({status: 200, result: "Password has been reset"})

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//password change for logged in user
User.changeUserPassword = function (userId, newPassword) {
   return new Promise(async (resolve, reject) => {
      try {
         await User.validateMongoId(userId)

         //changing the password in database
         await usersCollection.findOneAndUpdate({ _id: new ObjectId(userId) }, { $set: { password: newPassword } })
         resolve({status: 200, result: "Password changed sucessfully."}) 

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//email change for logged in user
User.changeUserEmail = function (userId, emailToChange) {
   return new Promise(async (resolve, reject) => {
      try {
         await User.validateMongoId(userId)
         const emailExist = await usersCollection.findOne({ email: emailToChange })    //checking if the email is already taken
         
         if (!emailExist) {
            await usersCollection.findOneAndUpdate({ _id: new ObjectId(userId) }, { $set: { email: emailToChange } })
            resolve({status: 200, result: "Email changed successfully."})
         } else {
            reject({status: 400, error: "That email is already been used!"})
         }

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}


//returning all arbs opportunities to subscribed users.
User.displayAllArbs = function (userId) {
   return new Promise(async (resolve, reject) => {
      try {
         await User.validateMongoId(userId)
         const allArbs = await scrappedDataCollection.find().toArray()     //finding all arbs saved in database
   
         if (allArbs.length) {
            resolve({status: 200, result: allArbs})
         } else {
            reject({status: 500, result: "Arbitrage opportunities can not be loaded at the moment. Try again later."})
         }

      } catch (error) {
         reject({status: 500, error: error})
      }
   })
}



module.exports = User