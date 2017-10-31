const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const XLSX = require('xlsx');
const Workbook = require('xlsx-workbook').Workbook;
const Excel = mongoose.model('Excel');
const ExcelRaw = require('exceljs');
const mongoosePaginate = require('mongoose-paginate');

const TaskSchema = new Schema({
    curiers: {type: Schema.Types.ObjectId, ref: 'Excel'},
    drivePath: {type: Schema.Types.ObjectId, ref: 'Excel'},
    orders: {type: Schema.Types.ObjectId, ref: 'Excel'},
    result: {type: Schema.Types.ObjectId, ref: 'Excel'},
    created: {type: Date, default: Date.now}
});
TaskSchema.plugin(mongoosePaginate);

TaskSchema.methods.process = function(filePath) {
    const _that = this;

    const resultWorkbook = new Workbook();
    let resultShared = resultWorkbook.add("Full");

    return new Promise(function (resolve, reject) {
        const PhoneOrderD = 2;
        const PhonesMap = {};
        for(const i in _that.orders.records[0]) {
            let n = _that.orders.records[0][i][PhoneOrderD];
            if(i > 0 && typeof n != 'undefined' && n.trim().length) {
                n = n.trim();
                if(!PhonesMap[n]) {
                    PhonesMap[n] = [];
                }
                PhonesMap[n].push(i);
            }
        }
        const NumberD = 0;
        const PhoneCurierD = 12;
        for(const i in _that.curiers.records[0]) {
            resultShared[i] = _that.curiers.records[0][i];
            if(i == 0) {
                continue;
            }
            const resSheet = resultWorkbook.add("№"+i);

            const curierSheet =_that.drivePath.records[_that.curiers.records[0][i][NumberD] - 1];
            for(const j in curierSheet) {
                if(j > 0 && curierSheet[j][PhoneCurierD] && curierSheet[j][PhoneCurierD].trim().length) {
                    const rowsFromOrder = PhonesMap[curierSheet[j][PhoneCurierD]];
                    if(rowsFromOrder && rowsFromOrder.length) {
                        rowsFromOrder.forEach(function (rowNum) {
                            do {
                                resSheet[resSheet.length] = _that.orders.records[0][rowNum];
                                rowNum++;
                                if(typeof _that.orders.records[0][rowNum] == 'undefined' ||
                                    (typeof _that.orders.records[0][rowNum][PhoneOrderD] != 'undefined' && _that.orders.records[0][rowNum][PhoneOrderD].trim().length)) {
                                    break;
                                }
                            } while(true)
                        })
                    };

                }
            }
        }

        let excelFile = resultWorkbook;
        const s = {patternType: 'solid',alignment: {wrapText: true}};
        for(const i in excelFile.SheetNames) {
            if(i == 0) {
                continue;
            }
            for(const j in excelFile.Sheets[excelFile.SheetNames[i]]) {
                if(j.indexOf('!') === -1) {
                    excelFile.Sheets[excelFile.SheetNames[i]][j].s = s;
                };
            }
            excelFile.Sheets[excelFile.SheetNames[i]]['!cols'] = wscols;

        }

        resultWorkbook.save(filePath);

        var workbook = new ExcelRaw.Workbook();
        const sheets = [];
        workbook.xlsx.readFile(filePath)
            .then(function() {
                workbook.eachSheet(function(worksheet, sheetId) {
                    sheets.push(sheetId - 1);
                    if(sheetId > 1) {
                        worksheet.columns = [
                            {width: 4},
                            {width: 12},
                            {width: 20},
                            {width: 25},
                            {width: 8},
                            {width: 8},
                            {width: 54},
                            {width: 8},
                            {width: 8}
                        ];
                        worksheet.eachRow(function (row, rowNumber) {
                            row.height = 29;
                            row.eachCell(function (cell, rowNumber) {
                                cell.alignment = {wrapText: true};
                            });
                        });
                    }
                });
                workbook.xlsx.writeFile(filePath)
                    .then(function() {
                        Excel.parse(filePath, sheets).then(function (records) {
                            result = new Excel({_id: new mongoose.Types.ObjectId()});
                            result.records = records;
                            result.save();
                            _that.result = result._id;
                            _that.save();
                            resolve();

                        });
                    });
            });


    })

};

module.exports = mongoose.model('Task', TaskSchema);
// mongoose.model('Task').collection.drop();