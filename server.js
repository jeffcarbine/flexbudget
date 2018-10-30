// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = 8000;
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');
var readDirFiles = require('read-dir-files');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');
var multer       = require('multer');
var flash        = require('connect-flash');

var configDB = require('./config/database.js');

// configuration ===============================================================
mongoose.connect(configDB.url, { useNewUrlParser: true }); // connect to our database mongodb://localhost/myDB

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({ extended: true })); // get information from html forms
app.use(flash());

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
  secret: "tepuedesequivocarperonuncaedemalaonda",
  resave: true,
  saveUninitialized: true
})); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// set up asset paths
app.use('/css', express.static(__dirname + '/css'))
app.use('/bootstrap', express.static(__dirname + '/node_modules/bootstrap/dist/css'));
app.use('/jquery', express.static(__dirname + '/node_modules/jquery/dist/'));
app.use('/fontawesome', express.static(__dirname + '/node_modules/@fortawesome/fontawesome-free/css/'));
app.use('/webfonts', express.static(__dirname + '/node_modules/@fortawesome/fontawesome-free/webfonts/'));
app.use('/assets', express.static(__dirname + '/assets'));
// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);
