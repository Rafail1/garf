const XLSX = require('xlsx');
const mongoose = require('mongoose'), Schema = mongoose.Schema;
const excelSchema = new Schema({
    records: Array
});
excelSchema.statics.getWorkbook = function(filePath) {
    return XLSX.readFile(filePath);
};
excelSchema.statics.sheet2arr = function(sheet){
    const result = [];
    let row;
    let rowNum;
    let colNum;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for(rowNum = range.s.r; rowNum <= range.e.r; rowNum++){
        row = [];
        for(colNum=range.s.c; colNum<=range.e.c; colNum++){
            let nextCell = sheet[
                XLSX.utils.encode_cell({r: rowNum, c: colNum})
                ];
            if( typeof nextCell === 'undefined' ){
                row.push(void 0);
            } else row.push(nextCell.w);
        }
        result.push(row);
    }
    return result;
};
excelSchema.statics.parse = function(filePath, worksheetIds) {
    worksheetIds = worksheetIds ? worksheetIds : [0];
    return new Promise(function (resolve, reject) {
        const workbook = XLSX.readFile(filePath, {cellStyles: true});
        const res = [];
        for(const i in worksheetIds) {
            const sheet_name = workbook.SheetNames[worksheetIds[i]];
            const worksheet = workbook.Sheets[sheet_name];
            res.push(mongoose.model('Excel').sheet2arr(worksheet));
        }
        resolve(res);
    })
};
module.exports = mongoose.model('Excel', excelSchema);
