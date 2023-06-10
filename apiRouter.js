const express = require('express')
const apiRouter = express.Router()
const userController = require('./controllers/userController')
const adminController = require('./controllers/adminController')
const subscriptionController = require('./controllers/subscriptionController')
const cors = require('cors')

apiRouter.use(cors({
    origin: '*'
}))



//Visitors Routes
apiRouter.post('/visitor/contact-us', userController.visitorContactUs)
apiRouter.post('/visitor/add/waitlist', userController.addVisitorToWaitList)







//Signed In User related routes
apiRouter.post('/login', userController.apiLogin)
apiRouter.post('/register', userController.apiRegister, userController.addingNewPaymentAddress, userController.sendEmailConfirmation)
apiRouter.get('/register-referred/:id', userController.getRegistrationPage)
apiRouter.post('/forgotpassword/email-auth', userController.userForgotPassword)
apiRouter.post('/forgotpassword/reset-password',  userController.resetPassword)
apiRouter.post('/changepassword', userController.mustBeLoggedIn, userController.changePassword)
apiRouter.post('/change-email', userController.mustBeLoggedIn, userController.changeEmail)
apiRouter.get('/account/arbs', userController.mustBeLoggedIn, subscriptionController.doesUserHaveSub, userController.arbsOpportunities)
apiRouter.get('/account/user/sub-status', userController.mustBeLoggedIn, subscriptionController.doesUserHaveSub, userController.getUserCurrentBalance, userController.returnUserSubStatusAndBalance)
apiRouter.post('/purchase/subscription', userController.mustBeLoggedIn,  subscriptionController.checkingUserSubBeforeSubPurschase,  subscriptionController.extractingUserBalance, subscriptionController.addSubscription)
apiRouter.post('/account/user/confirm-email', userController.userConfirmEmail)
apiRouter.get('/reset-password/:id/:token', userController.getResetPage)
apiRouter.get('/email-confirmation/:id/:token', userController.getConfirmationPage)
//apiRouter.post('/test-email-sending', userController.testEmail)




 






//admin related routes
apiRouter.post('/admin/login',  adminController.adminLogin)
apiRouter.post('/admin/register',  adminController.adminRegister)
apiRouter.post('/admin/create-subscription', adminController.mustBeAdmin, adminController.createSubscription)
apiRouter.post('/admin/deactivate-user', adminController.mustBeAdmin, adminController.deactivateUser)
apiRouter.post('/admin/activate-user', adminController.mustBeAdmin, adminController.activateUser)
apiRouter.post('/admin/deduct-funds', adminController.mustBeAdmin, adminController.deductUserFund)
apiRouter.post('/admin/fetch/arbs', adminController.mustBeAdmin, adminController.fetchArbsOpportunities)
apiRouter.post('/admin/fetch/all-users', adminController.mustBeAdmin, adminController.fetchAllUsers)
apiRouter.post('/admin/fetch/subscribed-users', adminController.mustBeAdmin, adminController.fetchAllSubscribedUsers)
apiRouter.post('/admin/delete/user', adminController.mustBeAdmin, adminController.deleteOneUser)
apiRouter.post('/admin/delete/user/transaction-details', adminController.mustBeAdmin, adminController.deleteOneUserTransactions)
apiRouter.post('/admin/delete/all-users/transaction-details', adminController.mustBeAdmin, adminController.deleteAllUsersTransactions)
apiRouter.post('/admin/search/user-details', adminController.mustBeAdmin, adminController.searchUserDetails)
apiRouter.post('/admin/send-email/referral-code', adminController.mustBeAdmin, adminController.sendUserReferralEmail)
//apiRouter.post('/admin/delete/all-users', adminController.mustBeAdmin, adminController.deleteAllUsers)




module.exports = apiRouter