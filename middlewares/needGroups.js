module.exports = function(group, redirect) {
    return function(req, res, next) {
        if (req.user && req.user.group === group)
            next();
        else if(redirect) {
            res.status(401).redirect(redirect);

        } else {
            res.status(401).send('Unauthorized');
        }
    };
};