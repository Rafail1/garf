var express = require('express');
var mongoose = require('mongoose');
var passport = require('passport');
var Account = require('../models/account.server.model');
var router = express.Router();
var session = require('express-session');
const needsGroup = require('./../middlewares/needGroups');


router.get('/', needsGroup('user', 'login'), function (req, res) {
    res.render('index');
});

router.get('/register', function(req, res) {
    res.render('register', { });
});

router.post('/register', function(req, res) {
    Account.register(new Account({ username : req.body.username }), req.body.password, function(err, account) {
        if (err) {
            return res.render('register', { account : account });
        }

        passport.authenticate('local')(req, res, function () {
            res.redirect('/');
        });
    });
});

router.get('/login', function(req, res) {
    res.render('login');
});

router.post('/login', passport.authenticate('local'), function(req, res) {
    mongoose.model('Sms').getBalance().then(function (balance) {
        req.session.balance = balance;
        res.redirect('/');
    })
});

router.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

module.exports = router;
