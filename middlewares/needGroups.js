module.exports = function(group) {
    return function(req, res, next) {
        if (req.user && req.user.group === group)
            next();
        else
            res.status(401).send('Unauthorized');
    };
};