const express = require('express');
const mongoose = require('mongoose');
const config = require('../config/config');
const router = express.Router();
const needsGroup = require('./../middlewares/needGroups');
const Task = mongoose.model('Task');
const Sms = mongoose.model('Sms');
const Orders = mongoose.model('Orders');
const fileUpload = require('express-fileupload');
/* GET users listing. */
router.post('/addFiles', needsGroup('user'), fileUpload(), function (req, res) {
    try {
        if (!req.files.drive_path || !req.files.orders) {
            return res.status(400).send('Bad request');
        }
        const dir = config.USER_UPLOAD_DIR(req.user);
        Task.add(dir, req.files.drive_path, req.files.orders, req.user).then(function (task) {
            return res.json(task);
        }, function (error) {
            return res.status(400).json({error: error.message});
        });
    } catch (e) {
        return res.status(400).send('<h1>Формат не тот</h1>');
    }

});


router.get('/sms/:taskId/send', needsGroup('user'), function (req, res, next) {
    try {
        const oid = new mongoose.Types.ObjectId(req.params.taskId);
        Task.findById(oid, function (err, task) {
            if(err || !task.sms) {
                return res.status(404).send('not found');
            }
            Sms.findById(task.sms, function (err, sms) {
                if(err || sms.sended) {
                    if(sms.sended) {
                        return res.status(500).send('early sended');
                    }
                    return res.status(404).send('not found');
                }
                sms.send();
                res.send("OK");
            })
        });
    } catch (e) {
        res.status(404).send('not found');
    }

});
router.get('/orders/:ordersId', needsGroup('user'), function (req, res, next) {
    const oid = new mongoose.Types.ObjectId(req.params.ordersId);
    Orders.findById(oid, function (err, orders) {
        if(err) {
            return res.status(404).send('not found');
        }
        res.json(orders);
    });
});
router.get('/sms/:smsId', needsGroup('user'), function (req, res, next) {
    const oid = new mongoose.Types.ObjectId(req.params.smsId);
    Sms.generateSmsExcel(oid).then(function (fpath) {
        res.download(fpath);
    });
});
router.get('/tasks/:taskId', needsGroup('user'), function (req, res, next) {
    const oid = new mongoose.Types.ObjectId(req.params.taskId);
    Task.findById(oid, function (err, task) {
        res.json(task);
    })
});
router.get('/', needsGroup('user'), function (req, res, next) {
    const promises = [];
    promises.push(new Promise(function (resolve, reject) {
        Sms.paginate({}, { page: 1, limit: 10, sort: { _id: -1 } }, function(err, result) {
            if(err) {
                reject(err);
            }
            resolve(result.docs);
        });
    }));
    promises.push(new Promise(function (resolve, reject) {
        Orders.paginate({}, { page: 1, limit: 10, sort: { _id: -1 } }, function(err, result) {
            if(err) {
                reject(err);
            }
            resolve(result.docs);
        });
    }));
    promises.push(new Promise(function (resolve, reject) {
        Task.paginate({}, { page: 1, limit: 10, sort: { _id: -1 } }, function(err, result) {
            if(err) {
                reject(err);
            }
            resolve(result.docs);
        });
    }));
    Promise.all(promises).then(function (arRes) {
        const results = [];
        arRes[0].forEach(function (item, key) {
            results.push({sms:item, order:arRes[1][key], task:arRes[2][key]});
        });
        res.render('garfield/index', { title: 'Garfield', results : results });
    })

});

module.exports = router;