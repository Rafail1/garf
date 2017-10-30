const Handlebars = require("hbs");
const moment = require("moment");
module.exports = {
    /**
     * @return {string}
     */
    UPLOAD_DIR: function (user) {
        return __dirname + `/../uploads/${user._id}`;
    },
    mongodb: {
        uri: "mongodb://localhost:27017/test"
    },
    session: {
        secret:'rafa'
    }
};

const DateFormats = {
    short: "DD MMMM - YYYY",
    long: "dddd DD.MM.YYYY HH:mm"
};
Handlebars.registerHelper('formatDate', function (date, format) {
    const mmnt = moment(date);
    return mmnt.format(DateFormats[format]);
});