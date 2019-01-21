const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const config = require('../config/config');
const router = express.Router();
const needsGroup = require('./../middlewares/needGroups');
const Task = mongoose.model('Task');
const Sms = mongoose.model('Sms');
const Orders = mongoose.model('Orders');
const fileUpload = require('express-fileupload');
/* GET users listing. */
router.post('/addFiles', needsGroup('user'), fileUpload(), function (req, res) {
   
});


router.get('/', needsGroup('user'), function (req, res, next) {
    return res.render('compare/index', { title: 'Compare'});
});

module.exports = router;