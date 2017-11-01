const express = require('express');
const path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
require('./config/db');
var config = require('./config/config');
var index = require('./routes/index');
var garfield = require('./routes/garfield');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var redis   = require("redis");
var session = require('express-session');
var redisStore = require('connect-redis')(session);
const client = redis.createClient();

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(session({
    secret: config.session.secret,
    // create new redis store.
    store: new redisStore({ host: 'localhost', port: 6379, client: client, disableTTL: true}),
    saveUninitialized: false,
    resave: true,
    cookie: { maxAge: 60000 * 3600 }
}));


app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));
app.use(function(req, res, next) {
    res.locals.user = req.user;
    next();
});
app.use('/', index);
app.use('/garfield', garfield);

var Account = require('./models/account.server.model');
passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
