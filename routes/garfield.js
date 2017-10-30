const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const config = require('../config/config');
const router = express.Router();
const needsGroup = require('./../middlewares/needGroups');
const Task = mongoose.model('Task');
const MyExcel = mongoose.model('Excel');
const ExcelRaw = require('exceljs');
const fileUpload = require('express-fileupload');
/* GET users listing. */
router.post('/addFiles', needsGroup('user'), fileUpload(), function (req, res) {
    if (!req.files.drive_path || !req.files.orders) {
        return res.status(400).send('Bad request');
    }
    const dir = config.UPLOAD_DIR(req.user);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    const task = new Task({_id: new mongoose.Types.ObjectId()});
    const fileDir = `${dir}/${task._id}`;
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir);
    }

    const promises = [];
    promises.push(new Promise(function(resolve, reject) {
        req.files.drive_path.mv(`${fileDir}/${req.files.drive_path.name}`, function (err, res) {
            if (err) {
                reject(err);
            }
            resolve(`${fileDir}/${req.files.drive_path.name}`);
        })
    }));
    promises.push(new Promise(function(resolve, reject) {
        req.files.orders.mv(`${fileDir}/${req.files.orders.name}`, function (err, res) {
            if (err) {
                reject(err);
            }
            resolve(`${fileDir}/${req.files.orders.name}`);
        })
    }));

    Promise.all(promises).then(files => {
        const Excel = mongoose.model('Excel');
        const promises = [];
        const wrksheet0 = Excel.getWorkbook(files[0]);
        const sheetIds0 = [];
        const sheetIdCuriers = [0];
        const wrksheet1 = Excel.getWorkbook(files[1]);
        for(let i = 0; i < wrksheet0.SheetNames.length; i++) {
            if(i) {
                sheetIds0.push(i);
            }
        }
        promises.push(Excel.parse(files[0], sheetIdCuriers));
        promises.push(Excel.parse(files[0], sheetIds0));
        promises.push(Excel.parse(files[1], [wrksheet1.SheetNames.length -1]));
        Promise.all(promises).then(arrays => {
            const excelCuriers = new Excel({records: arrays[0]});
            const excelDrivePath = new Excel({records: arrays[1]});
            const excelOrders = new Excel({records: arrays[2]});
            const promises = [];
            promises.push(new Promise(function (resolve, reject) {
                excelCuriers.save(function(err, result) {
                    if(err) {
                        reject(err);
                    }
                    resolve(result);
                });
            }));
            promises.push(new Promise(function (resolve, reject) {
                excelDrivePath.save(function(err, result) {
                    if(err) {
                        reject(err);
                    }
                    resolve(result);
                });
            }));
            promises.push(new Promise(function (resolve, reject) {
                excelOrders.save(function(err, result) {
                    if(err) {
                        reject(err);
                    }
                    resolve(result);
                });
            }));
            Promise.all(promises).then(excels => {
                task.curiers = excels[0];
                task.drivePath = excels[1];
                task.orders = excels[2];
                const filePath = `${fileDir}/result.xlsx`;
                task.process(filePath).then(function () {
                    task.save();
                    const stat = fs.statSync(filePath);
                    res.download(filePath, 'result.xlsx');
                });
            })
        });

    });

});

router.get('/tasks', needsGroup('user'), function (req, res, next) {
    Task.find({}, function (err, tasks) {
        console.log(err, tasks);
        res.json(tasks);
    })
});
router.get('/sms/:taskId', needsGroup('user'), function (req, res, next) {
    const result = [];

    const tpl = '{Name}, Ваш заказ у курьера, его привезет {Kurer} с 18:30 до 22:00, тел. {numberKurer}. Сумма к оплате: {Summ} руб. С уважением, зоомагазин Garfield.by';
    const tplNN = 'Ваш заказ у курьера, его привезет {Kurer} с 18:30 до 22:00, тел. {numberKurer}. Сумма к оплате: {Summ} руб. С уважением, зоомагазин Garfield.by';
    const tplNNNKN = 'Ваш заказ у курьера, его привезет {Kurer} с 18:30 до 22:00. Сумма к оплате: {Summ} руб. С уважением, зоомагазин Garfield.by';
    const tplNKN = '{Name}, Ваш заказ у курьера, его привезет {Kurer} с 18:30 до 22:00. Сумма к оплате: {Summ} руб. С уважением, зоомагазин Garfield.by';
    try {
        const oid = new mongoose.Types.ObjectId(req.params.taskId);
        Task.findById(oid, function (err, task) {
            if(task && task.result) {
                MyExcel.findById(task.result, function (err, excel) {
                    if(excel && excel.records) {
                        const curiersSheet = excel.records.shift();
                        const curiers = [];
                        for(let i = 1; i < curiersSheet.length; i++) {
                            const row = curiersSheet[i];
                            curiers.push({name:row[1], phone:row[3]});
                        }
                        var workbook = new ExcelRaw.Workbook();
                        var sheet = workbook.addWorksheet('My Sheet');
                        for(let i = 0; i < excel.records.length; i++) {
                            const curier = curiers[i];
                            if(!curier) {
                                return res.send("Wrong excel file");
                            }
                            let order;
                            excel.records[i].forEach(function (row) {
                                if(row[2] !== null && row[2].trim().length > 0) {
                                    row[1] = row[1] ? row[1] : '';
                                    let utpl;
                                    if(row[1]) {
                                        if(curier.phone) {
                                            utpl = tpl;
                                        } else {
                                            utpl = tplNKN;
                                        }
                                    } else {
                                        if(curier.phone) {
                                            utpl = tplNN;
                                        } else {
                                            utpl = tplNNNKN;
                                        }
                                    }
                                    order = [row[1].trim(),row[2].trim(),curier.name.trim(),0,curier.phone.trim(),utpl];
                                }
                                if(row[6] === 'итого') {
                                    order[3] = row[7];
                                    result.push(order);
                                    sheet.addRow(order)
                                }
                            });
                        }
                        const dir = config.UPLOAD_DIR(req.user);
                        const fileDir = `${dir}/${task._id}`;
                        if (!fs.existsSync(fileDir)) {
                            fs.mkdirSync(fileDir);
                        }
                        const filePath = `${fileDir}/resultSms.xlsx`;
                        workbook.xlsx.writeFile(filePath)
                            .then(function() {
                                res.download(filePath);
                            });


                    } else {
                        res.json(err);
                    }
                })
            } else {
                res.json(err);
            }
        })
    } catch (e) {
        res.status(404).send('not found');
    }

});
router.get('/', needsGroup('user'), function (req, res, next) {
    Task.paginate({}, { page: 1, limit: 10, sort: { date: -1 } }, function(err, result) {
        console.log(result.docs);
        res.render('garfield/index', { title: 'Garfield', arrSms: result.docs });
    });

});

module.exports = router;