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
    try {
        if (!req.files.drive_path || !req.files.orders) {
            return res.status(400).json({error: 'Bad request'});
        }
        const dir = config.USER_UPLOAD_DIR(req.user);
        Task.add(dir, req.files.drive_path, req.files.orders, req.user).then(function (task) {
            return res.json({task: {_id:task._id, created:task.created}});
        }, function (error) {
            return res.status(400).json({error: error.message});
        });
    } catch (e) {
        return res.status(400).json({error: e.message});
    }

});


router.get('/sms/:taskId/send', needsGroup('user'), function (req, res, next) {
    try {
        const oid = new mongoose.Types.ObjectId(req.params.taskId);
        Task.findById(oid, function (err, task) {
            if(err || !task.sms) {
                return res.status(404).json({error:'Не найдена задача'});
            }
            Sms.findById(task.sms, function (err, sms) {
                if(err || sms.sended) {
                    if(sms.sended) {
                        return res.status(500).json({error:'Уже отсылались'});
                    }
                    return res.status(404).json({error:'Не найдены смс'});
                }
               sms.send();
                return res.json({status:'ok'});
            })
        });
    } catch (e) {
        res.status(404).send('not found');
    }

});
router.get('/orders/:ordersId', needsGroup('user'), function (req, res, next) {
    const fpath =  Task.getResultOrdersFile(req, req.params.ordersId);
    if(fs.existsSync(fpath)) {
        res.download(fpath);
    } else {
        return res.status(404).send('not found');
    }
});
router.get('/sms/:taskId', needsGroup('user'), function (req, res, next) {
    const oid = new mongoose.Types.ObjectId(req.params.taskId);
    Sms.generateSmsExcel(req, oid).then(function (fpath) {
        res.download(fpath);
    });
});
router.get('/result/:taskId', needsGroup('user'), function (req, res, next) {
    const fpath =  Task.getResultFile(req, req.params.taskId);
    if(fs.existsSync(fpath)) {
        res.download(fpath);
    } else {
        return res.status(404).send('not found');
    }

})

router.get('/', needsGroup('user'), function (req, res, next) {
    const promises = [];
    mongoose.model('Sms').getBalance().then(function (balance) {
        req.session.balance = balance;
    });
    Task.paginate({}, { page: 1, limit: 10, sort: { _id: -1 },  populate: 'sms'}, function(err, result) {
        if(err) {
            return res.render('garfield/index', { title: 'Garfield', tasks : [] });
        }
        return res.render('garfield/index', { title: 'Garfield', tasks : JSON.stringify(result.docs.map(function (item) {
            return {_id:item._id, created:item.created, sms:{sended: item.sms && item.sms.sended}}
        })) });
    });

});

module.exports = router;