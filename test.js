const XLSX = require('xlsx');
excelFile = XLSX.readFile('result2.xlsx', {
    cellStyles: true
});
for(const i in excelFile.SheetNames) {
console.log(excelFile.Sheets[excelFile.SheetNames[i]]);
    for(const j in excelFile.Sheets[excelFile.SheetNames[i]]) {
        // console.log(excelFile.Sheets[excelFile.SheetNames[i]]);
        break;
    }
    break;

}