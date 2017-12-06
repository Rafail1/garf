module.exports = {
    numberize: function numberize(str) {
        if (str === null) {
            str = '';
        }
        return str.trim().replace(new RegExp(/[^\d]*/, 'g'), '');
    },
    isEmpty:function(str) {
        return !(str !== null && typeof str !== 'undefined' && str.trim() !== '');
    }
}