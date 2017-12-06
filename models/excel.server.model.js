const ExcelJs = require('exceljs');

const mongoose = require('mongoose'), Schema = mongoose.Schema;
const excelSchema = new Schema({
    records: Array
});
excelSchema.statics.getWorkbook = function (filePath) {
    const workbook = new ExcelJs.Workbook();
    return new Promise(function (resolve, reject) {
        workbook.xlsx.readFile(filePath).then(function () {
            resolve(workbook);
        });
    });
};
excelSchema.statics.sheet2arr = function (worksheet) {
    const result = [];
    worksheet.eachRow({includeEmpty: true}, function (row, rowNumber) {
        const r = [];

        row.eachCell({includeEmpty: true}, function (cell, colNumber) {
            r[colNumber - 1] = cell.text;
        });
        result.push(r);
    });
    return result;
};
excelSchema.statics.parse = function (filePath, worksheetNames) {
    const workbook = new ExcelJs.Workbook();
    return new Promise(function (resolve, reject) {
        workbook.xlsx.readFile(filePath)
            .then(function () {
                const res = [];
                for (const i in worksheetNames) {
                    const ws = workbook.getWorksheet(worksheetNames[i]);
                    if (typeof ws === 'undefined') {
                        return reject(new Error('не нашел лист "' + worksheetNames[i]+'"'));
                        // throw new Error('не нашел лист ' + worksheetNames[i]);
                    }
                    res.push(mongoose.model('Excel').sheet2arr(workbook.getWorksheet(worksheetNames[i])));
                }
                return resolve(res);
            });
    })
};
module.exports = mongoose.model('Excel', excelSchema);
