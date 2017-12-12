const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MyHelper = require('./helper');
const config = require('../config/config');
const fs = require('fs');
const mongoosePaginate = require('mongoose-paginate');
const Handlebars = require("hbs");
const ExcelJs = require('exceljs');
const Task = mongoose.model('Task');
const request = require('request');
const apiUrl = 'https://userarea.sms-assistent.by/api/v1/json';

const SmsSchema = new Schema({
    records: Array,
    sended: Boolean,
    created: {type: Date, default: Date.now}
});
SmsSchema.plugin(mongoosePaginate);
SmsSchema.statics.getBalance = function () {
    const _that = this;

    return new Promise(function (resolve, reject) {
        if (_that.sended) {
            reject();
        }
        const data = {
            login: "IvSetorg",
            password: "7d28LpYn"

        };
        request({
            url: `https://userarea.sms-assistent.by/api/v1/credits/plain?user=${data.login}&password=${data.password}`,
            method: "GET",
        }, function (err, answer) {
            if (err) {
                console.log(err)
            }
            return resolve(answer.body);
        });
    });
}
SmsSchema.methods.send = function () {
    const _that = this;

    return new Promise(function (resolve, reject) {
        if (_that.sended) {
            reject();
        }
        const data = {
            "login": "IvSetorg",
            "password": "7d28LpYn",
            "command": "sms_send",

        };
        const messages = [];
        let ph = 55555;
        _that.records.forEach(function (item) {
            // TODO: untest it
            item.phone = '3752940' + (ph++);
            messages.push({
                "recipient": item.phone,
                "sender": "Garfield.by",
                "validity_period": 24,
                "sms_text": item.message
            });

        });
        for (let i = 0; i <= Math.floor(messages.length / 25); i++) {
            data["message"] = {
                "msg": messages.slice(24 * i, 24 * i + 24)
            };
            request({
                url: apiUrl,
                method: "POST",
                json: data
            }, function (err, answer) {
                if (err) {
                    console.log(err)
                }
            });
        }
        mongoose.model('Sms').findByIdAndUpdate(_that._id, {$set: {sended: true}}, function (err, res) {
            console.log(err, res);
        });
        return resolve(answer);
    });
};

SmsSchema.statics.generateSmsExcel = function (req, taskId) {
    const _that = this;
    return new Promise(function (resolve, reject) {
        Task.findById(taskId).populate('sms').exec(function (err, task) {
            const sms = task.sms;
            const fileDir = `${config.USER_UPLOAD_DIR(req.user)}/${taskId}`;
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir);
            }
            const filePath = `${fileDir}/resultSms.xlsx`;
            if (fs.existsSync(filePath)) {
                return resolve(filePath);
            }
            const workbook = new ExcelJs.Workbook();
            const sheet = workbook.addWorksheet('My Sheet');
            for (let i = 0; i < sms.records.length; i++) {
                const row = sms.records[i];
                let order = [
                    row['name'].trim(),
                    row['phone'].trim(),
                    row['curierName'].trim(),
                    row['summ'],
                    row['curierPhone'].trim(),
                    row['message']
                ];
                sheet.addRow(order)
            }

            workbook.xlsx.writeFile(filePath)
                .then(function () {
                    return resolve(filePath);
                });
        })

    });
};
SmsSchema.statics.add = function (excel) {
    const records = [];
    const _that = this;
    const source = "{{#if name}}{{name}}, {{/if}}" +
        "Ваш заказ у курьера, его привезет {{curierName}} с 18:30 до 22:00{{#if curierPhone}}, тел. {{curierPhone}}{{/if}}. " +
        "{{#if summ}}Сумма к оплате: {{summ}} руб.{{/if}} С уважением, зоомагазин Garfield.by";
    const template = Handlebars.compile(source);

    return new Promise(function (resolve, reject) {
        try {
            if (!excel || !excel.records) {
                return reject();
            }
            const curiersSheet = excel.records.shift();
            const curiers = [];


            const CurierNameCell = 1;
            const CurierPhoneCell = 3;
            const PhoneNumberCell = 2;
            const NameCell = 1;
            const ItogCell = 6;
            const SummCell = 7;


            for (let i = 1; i < curiersSheet.length; i++) {
                const row = curiersSheet[i];
                curiers.push({name: row[CurierNameCell], phone: row[CurierPhoneCell]});
            }
            if (curiers.length !== excel.records.length) {
                return reject("Количество курьеров не равно количеству листов");
            }
            for (let i = 0; i < excel.records.length; i++) {
                const curier = curiers[i];
                let order;
                excel.records[i].forEach(function (row) {
                    const phoneNumber = row[PhoneNumberCell];
                    if (typeof phoneNumber !== 'undefined' && phoneNumber !== null && phoneNumber.trim().length > 0) {
                        const name = row[NameCell] ? row[NameCell] : '';
                        order = {
                            'name': name.trim(), 'phone': phoneNumber.trim(),
                            'curierName': curier.name.trim(), 'summ': 0, 'curierPhone': curier.phone.trim()
                        };
                    }

                    if (typeof row[ItogCell] === 'string' && row[ItogCell].trim().toLowerCase() === 'итого') {
                        const sumCellValue = row[SummCell];
                        if (MyHelper.numberize(sumCellValue).length) {
                            order['summ'] = sumCellValue;
                        }
                        order['message'] = template(order);
                        records.push(order);
                    }
                });
            }
            const sms = new _that({_id: new mongoose.Types.ObjectId(), records: records});
            sms.save(function (err, res) {
                if (err) {
                    return reject();
                }
                return resolve(sms);
            })
        } catch (e) {
            return reject(e);
        }
    });
};

module.exports = mongoose.model('Sms', SmsSchema);
// mongoose.model('Sms').collection.drop();
