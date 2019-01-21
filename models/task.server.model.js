const mongoose = require('mongoose');
const moment = require('moment');
require('moment/locale/ru');
const Schema = mongoose.Schema;
const fs = require('fs');
const Excel = mongoose.model('Excel');
const MyHelper = require('./helper');
const config = require('../config/config');
const ExcelJs = require('exceljs');
const mongoosePaginate = require('mongoose-paginate');
const PhoneOrderD = 2;
const ItogOrderD = 6;
const ItogOrderValueD = 7;
const PhoneResultD = 3;
const ItogResultD = 7;
const ItogOrderText = 'итого';
const ResultFname = 'result.xlsx';
const allOrdersSheetName = 'все';
const allCuriersSheetName = 'общий';
const TaskSchema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'Account'},
    curiers: {type: Schema.Types.ObjectId, ref: 'Excel'},
    drivePath: {type: Schema.Types.ObjectId, ref: 'Excel'},
    orders: {type: Schema.Types.ObjectId, ref: 'Excel'},
    result: {type: Schema.Types.ObjectId, ref: 'Excel'},
    sms: {type: Schema.Types.ObjectId, ref: 'Sms'},
    created: {type: Date, default: Date.now}
});
TaskSchema.plugin(mongoosePaginate);

TaskSchema.statics.uploadFiles = function (fileDir, drive_path, orders) {
    return new Promise(function (resolve, reject) {
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir);
        }
        const promises = [];
        promises.push(new Promise(function (resolve, reject) {
            drive_path.mv(`${fileDir}/${drive_path.name}`, function (err, res) {
                if (err) {
                    return reject(err);
                }
                return resolve(`${fileDir}/${drive_path.name}`);
            })
        }));
        promises.push(new Promise(function (resolve, reject) {
            orders.mv(`${fileDir}/${orders.name}`, function (err, res) {
                if (err) {
                    return reject(err);
                }
                return resolve(`${fileDir}/${orders.name}`);
            })
        }));

        Promise.all(promises).then(files => {
            resolve(files);
        }, err => {
            reject(err);
        });
    });
}
TaskSchema.statics.getWorksheetsArrays = function (AntWorkbook, files) {

    const promises = [];
    const sheetNames = [];
    const allCuriersSheetNames = [];
    AntWorkbook.eachSheet(function (worksheet, sheetId) {
        if (worksheet.name.trim().toLowerCase() !== allCuriersSheetName) {
            sheetNames.push(worksheet.name);
        } else {
            allCuriersSheetNames.push(worksheet.name);
        }
    });
    promises.push(Excel.parse(files[0], allCuriersSheetNames));
    promises.push(Excel.parse(files[0], sheetNames));
    promises.push(Excel.parse(files[1], [allOrdersSheetName]));
    return Promise.all(promises);
}
TaskSchema.statics.saveArrays = function (arrays) {
    const excelCuriers = new Excel({records: arrays[0]});
    const excelDrivePath = new Excel({records: arrays[1]});
    const excelOrders = new Excel({records: arrays[2]});
    const promises = [];
    promises.push(new Promise(function (resolve, reject) {
        excelCuriers.save(function (err, result) {
            if (err) {
                return reject(err);
            }
            return resolve(result);
        });
    }));
    promises.push(new Promise(function (resolve, reject) {
        excelDrivePath.save(function (err, result) {
            if (err) {
                return reject(err);
            }
            return resolve(result);
        });
    }));
    promises.push(new Promise(function (resolve, reject) {
        excelOrders.save(function (err, result) {
            if (err) {
                return reject(err);
            }
            return resolve(result);
        });
    }));
    return Promise.all(promises);
}
TaskSchema.statics.getWorkBooks = function (files) {
    const promises = [];
    promises.push(Excel.getWorkbook(files[0]));
    promises.push(Excel.getWorkbook(files[1]));
    return Promise.all(promises);
};

TaskSchema.statics.checkOrdersFormat = function (orders) {
    let orderStarted = false;
    for (const i in orders.records[0]) {
        let n = orders.records[0][i][PhoneOrderD];
        let itog = orders.records[0][i][ItogOrderD];
        let itogValue = orders.records[0][i][ItogOrderValueD];
        let numI = parseInt(i);
        if (numI > 0 && typeof n !== 'undefined' && n.trim().length) {
            if (orderStarted) {
                throw new Error('Ошибка в файле заказов, не нашёл итоговой суммы заказа на строке ' + (numI - 1));
            }
            orderStarted = true;
        }
        if (itog !== null && typeof itog === 'string'
            && itog.toLowerCase().trim() === ItogOrderText) {
            if (!MyHelper.isEmpty(itogValue)) {
                itogValue = itogValue.trim().toLowerCase();
                if (itogValue !== 'оплачено' && itogValue !== 'на выбор') {
                    if (MyHelper.numberize(itogValue) === '') {
                        throw new Error('Ошибка в файле заказов в ячейке суммы заказа на строке ' + numI)
                    }
                }
            }
            orderStarted = false;
        }
    }
};

TaskSchema.statics.add = function (dir, drive_path, orders, user) {
    const _that = this;
    return new Promise(function (resolve, reject) {
        const task = new _that({_id: new mongoose.Types.ObjectId()});
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        const fileDir = `${dir}/${task._id}`;
        _that.uploadFiles(fileDir, drive_path, orders).then(files => {
            _that.getWorkBooks(files).then(function (workbooks) {
                _that.getWorksheetsArrays(workbooks[0], files)
                    .then(function (arrays) {
                        _that.saveArrays(arrays).then(function (excels) {
                            try {
                                _that.checkOrdersFormat(excels[2]);
                            } catch (e) {
                                return reject(e);
                            }

                            task.user = user;
                            task.curiers = excels[0];
                            task.drivePath = excels[1];
                            task.orders = excels[2];
                            const fname = ResultFname;
                            task.process(fileDir, fname).then(function () {
                                task.save();
                                resolve(task);
                            }, function (err) {
                                reject(err)
                            });
                        })
                    }, function (error) {
                        reject(error);
                    });
            })
        }, err => {
            reject(err);
        });
    });
}


TaskSchema.statics.getResultOrdersFile = function (req, id) {
    return `${config.USER_UPLOAD_DIR(req.user)}/${id}/${id}orders.xlsx`;
}
TaskSchema.statics.getResultFile = function (req, id) {
    return `${config.USER_UPLOAD_DIR(req.user)}/${id}/result.xlsx`;
}
TaskSchema.methods.process = function (fileDir, fname) {
    const _that = this;
    const filePath = `${fileDir}/${fname}`;
    const filePathOrders = `${fileDir}/${_that._id}orders.xlsx`;
    const resultWorkbook = new ExcelJs.Workbook();
    let resultShared = resultWorkbook.addWorksheet(allCuriersSheetName);

    return new Promise(function (resolve, reject) {

        const PhonesMap = {};
        for (const i in _that.orders.records[0]) {
            let n = _that.orders.records[0][i][PhoneOrderD];
            if (i > 0 && typeof n !== 'undefined' && n.trim().length) {
                n = MyHelper.numberize(n);
                if (!PhonesMap[n]) {
                    PhonesMap[n] = [];
                }
                PhonesMap[n].push(i);
            }
        }
        const NumberD = 0;
        const NumberO = 0;
        const PhoneCurierD = 16;
        for (const i in _that.curiers.records[0]) {
            let orderN = 1;
            resultShared.addRow(_that.curiers.records[0][i]);
            if (parseInt(i) === 0) {
                continue;
            }
            const resSheet = resultWorkbook.addWorksheet("№" + i);
            resSheet.getColumn(6).numFmt = 'h:mm';
            resSheet.getColumn(5).numFmt = 'h:mm';
            let addedRowNum = 0;
            const curierSheet = _that.drivePath.records[_that.curiers.records[0][i][NumberD] - 1];
            for (const j in curierSheet) {
                const digNumberPhone = MyHelper.numberize(curierSheet[j][PhoneCurierD]);
                if (j > 0 && digNumberPhone && digNumberPhone.length) {
                    const rowsFromOrder = PhonesMap[digNumberPhone];
                    if (rowsFromOrder && rowsFromOrder.length) {
                        rowsFromOrder.forEach(function (rowNum) {
                            _that.orders.records[0][rowNum][NumberO] = orderN++;
                            do {
                                resSheet.addRow(_that.orders.records[0][rowNum]);
                                const cell = resSheet.getCell(`C${addedRowNum++}`);
                                cell.font = { name: 'Calibri', family: 4, size: 16, bold: true };
                                rowNum++;
                                if (typeof _that.orders.records[0][rowNum] === 'undefined' ||
                                    (typeof _that.orders.records[0][rowNum][PhoneOrderD] !== 'undefined' &&
                                        MyHelper.numberize(_that.orders.records[0][rowNum][PhoneOrderD]).length)) {
                                    break;
                                }
                            } while (true)
                        })
                    }

                }
            }
        }

        const ordersWorkbook = new ExcelJs.Workbook();
        const defaultBorder = {  top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
        resultWorkbook.eachSheet(function (worksheet, sheetId) {
            let firstOrder = true;

            if (worksheet.name.trim().toLowerCase() !== allCuriersSheetName) {
                const ordersSheet = ordersWorkbook.addWorksheet(worksheet.name, {
                    pageSetup: {paperSize: 9, orientation: 'portrait', scale:80}
                });
                ordersSheet.pageSetup.printArea = 'A1:G20';
                ordersSheet.columns = [
                    {width: 18},
                    {width: 26},
                    {width: 31},
                    {width: 12}
                ];
                let pRow;
                worksheet.eachRow({includeEmpty: true}, function (row, rowNum) {
                    const phone = row.getCell(PhoneResultD);
                    if (!MyHelper.isEmpty(phone.text)) {
                        if (!firstOrder && pRow) {
                            pRow.addPageBreak();
                        }
                        tplRowsHead = [
                            ['ЗООМАГАЗИН  “GARFIELD”'],
                            ['', moment().format('DD MMMM YYYY')],
                            ['Адрес магазина: Минск, пр. Независимости, 44', '', 'ТЕЛЕФОНЫ'],
                            ['Время работы:     пн.-пт.: c 10-00 до 21-00     сб-вс. : с 10-00 до 20-00'],
                            ['Сайт:   www.garfield.by','','8 (033) 901-18-31'],
                            ['E-mail:   zoogarfield@gmail.com','','8 (044) 579-30-46'],
                            ['ТЕЛЕФОН', 'АДРЕС ДОСТАВКИ', 'НАИМЕНОВАНИЕ ТОВАРА', 'ЦЕНА']
                        ];
                        const rnTitle = ordersSheet.rowCount+1;
                        const rnDate = rnTitle + 1;
                        const rnAddressPhone = rnDate + 1;
                        const rnWorkTime = rnAddressPhone + 1;
                        const rnSitePhone = rnWorkTime + 1;
                        const rnEmailPhone = rnSitePhone + 1;
                        const rnThead = rnEmailPhone + 1;

                        ordersSheet.addRows(tplRowsHead);

                        ordersSheet.mergeCells(`A${rnTitle}:D${rnTitle}`);
                        const titleCell = ordersSheet.getCell(`A${rnTitle}`);
                        const titleRow = ordersSheet.getRow(rnTitle);
                        titleRow.height = 21;
                        titleCell.font = { name: 'Calibri', family: 4, size: 16, bold: true };
                        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

                        ordersSheet.mergeCells(`B${rnDate}:C${rnDate}`);
                        const dateCell = ordersSheet.getCell(`B${rnDate}`);
                        dateCell.font = { name: 'Calibri', family: 4, size: 11, bold: true };
                        dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
                        ordersSheet.mergeCells(`A${rnAddressPhone}:B${rnAddressPhone}`);
                        ordersSheet.mergeCells(`C${rnAddressPhone}:D${rnAddressPhone}`);
                        ordersSheet.getRow(rnAddressPhone).height = 20;
                        ordersSheet.getCell(`C${rnAddressPhone}`).alignment = { vertical: 'middle', horizontal: 'center' };
                        ordersSheet.mergeCells(`A${rnWorkTime}:D${rnWorkTime}`);
                        ordersSheet.mergeCells(`A${rnSitePhone}:B${rnSitePhone}`);
                        ordersSheet.mergeCells(`C${rnSitePhone}:D${rnSitePhone}`);
                        ordersSheet.getCell(`C${rnSitePhone}`).alignment = { vertical: 'middle', horizontal: 'center' };
                        ordersSheet.mergeCells(`A${rnEmailPhone}:B${rnEmailPhone}`);
                        ordersSheet.mergeCells(`C${rnEmailPhone}:D${rnEmailPhone}`);
                        ordersSheet.getCell(`C${rnEmailPhone}`).alignment = { vertical: 'middle', horizontal: 'center' };
                        ordersSheet.getCell(`C${rnEmailPhone}`).border = { bottom: {style:'medium'} };
                        ordersSheet.getCell(`A${rnEmailPhone}`).border = { bottom: {style:'medium'} };
                        const PhoneHeadCell = ordersSheet.getCell(`A${rnThead}`);
                        const AddressHeadCell = ordersSheet.getCell(`B${rnThead}`);
                        const ProductNameHeadCell = ordersSheet.getCell(`C${rnThead}`);

                        ordersSheet.getRow(rnThead).height = 21;

                        const PriceHeadCell = ordersSheet.getCell(`D${rnThead}`);
                        PhoneHeadCell.font = { name: 'Calibri', family: 4, size: 11, bold: true };
                        PhoneHeadCell.alignment = { vertical: 'middle', horizontal: 'center' };
                        PhoneHeadCell.border = defaultBorder;

                        AddressHeadCell.font = { name: 'Calibri', family: 4, size: 11, bold: true };
                        AddressHeadCell.alignment = { vertical: 'middle', horizontal: 'center' };
                        AddressHeadCell.border = defaultBorder;

                        ProductNameHeadCell.font = { name: 'Calibri', family: 4, size: 11, bold: true };
                        ProductNameHeadCell.alignment = { vertical: 'middle', horizontal: 'center' };
                        ProductNameHeadCell.border = defaultBorder;

                        PriceHeadCell.font = { name: 'Calibri', family: 4, size: 11, bold: true };
                        PriceHeadCell.alignment = { vertical: 'middle', horizontal: 'right' };
                        PriceHeadCell.border = JSON.parse(JSON.stringify(defaultBorder));
                        PriceHeadCell.border.right= { style:'medium' };
                        firstOrder = false;
                    }
                    const addingRow = [
                        {
                            value: row.values[3],
                            border: defaultBorder,
                            alignment: {wrapText: true, vertical: 'top'}
                        }, {
                            value:row.values[4],
                            border: defaultBorder,
                            alignment: {wrapText: true, vertical: 'top'}
                        }, {
                            value: row.values[7],
                            border: defaultBorder,
                            alignment: {wrapText: true, vertical: 'top'}
                        }, {
                            value: row.values[8],
                            border: defaultBorder,
                            alignment: { vertical: 'middle', horizontal: 'right' }
                        }
                    ];
                    pRow = ordersSheet.addRow(addingRow.map(function (item) {
                        return item.value;
                    }));
                    let maxheight = 1;
                    let rn;
                    for(const i in addingRow) {
                        const colNumber = parseInt(i)+1;
                        const cell = pRow.getCell(colNumber);
                        cell.border = addingRow[i]['border'];
                        cell.alignment = addingRow[i]['alignment'];
                        rn = Math.ceil(cell.text.length / ordersSheet.getColumn(colNumber).width);
                        if(rn > maxheight) {
                            maxheight = rn;
                        }

                        if (cell.text !== null && typeof cell.text !== 'undefined'
                            && cell.text.toLowerCase().trim() === ItogOrderText) {
                            const summCell = pRow.getCell(colNumber + 1);
                            summCell.font = {bold: true};
                            cell.font = {bold: true};
                        }
                    }

                    if(maxheight > 1) {
                        pRow.height = ordersSheet.properties.defaultRowHeight * maxheight
                    }
                })
            }

        });
        ordersWorkbook.xlsx.writeFile(filePathOrders);

        const sheets = [];
        resultWorkbook.eachSheet(function (worksheet, sheetId) {
            sheets.push(worksheet.name);
            if (worksheet.name.trim().toLowerCase() !== allCuriersSheetName) {
                worksheet.columns = [
                    {width: 4},
                    {width: 12},
                    {width: 20},
                    {width: 35},
                    {width: 8},
                    {width: 15},
                    {width: 75},
                    {width: 8},
                    {width: 8}
                ];
                worksheet.eachRow(function (row, rowNumber) {
                    row.height = 29;
                    row.eachCell(function (cell, colNumber) {
                        if (cell.text !== null && typeof cell.text !== 'undefined'
                            && cell.text.toLowerCase().trim() === ItogOrderText) {
                            row.getCell(colNumber + 1).font = {bold: true};
                            cell.font = {bold: true};
                        }
                        if(colNumber === 3) {
                            cell.font = { name: 'Calibri', family: 1, size: 12, bold: true };
                        }
                        if(colNumber === 6) {
                            cell.alignment = { vertical: 'middle', horizontal: 'center' , wrapText: true};
                        } else {
                            cell.alignment = {wrapText: true};
                        }
                    });
                });
            }
        });
        resultWorkbook.xlsx.writeFile(filePath)
            .then(function () {
                Excel.parse(filePath, sheets).then(function (records) {
                    const result = new Excel({_id: new mongoose.Types.ObjectId()});
                    result.records = records;
                    result.save();
                    _that.result = result;
                    mongoose.model('Sms').add(result).then(function (sms) {
                        _that.sms = sms;
                        _that.save();

                        return resolve();
                    }, function (err) {
                        return reject(err);
                    });
                });
            });
    });

};

module.exports = mongoose.model('Task', TaskSchema);
// mongoose.model('Task').collection.drop();
