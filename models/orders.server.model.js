const ExcelJs = require('exceljs');
const mongoosePaginate = require('mongoose-paginate');

const mongoose = require('mongoose'), Schema = mongoose.Schema;
const ordersSchema = new Schema({
    taskId: Schema.Types.ObjectId,
    records: Array,
    file:String
});
ordersSchema.plugin(mongoosePaginate);

ordersSchema.statics.addOrders = function(orders) {

}
module.exports = mongoose.model('Orders', ordersSchema);
