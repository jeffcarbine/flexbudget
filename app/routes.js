// requirements and variables
var request = require('request');
var fs = require('fs');
var multer = require('multer');
var mongoose = require('mongoose');
var User = require('./models/user');
var Static = require('./models/static');
var Variables = require('./models/variables');
var rmdir = require('rimraf');
var mkdirp = require('mkdirp');
var nodemailer = require("nodemailer");
var async = require("async");
var bcrypt = require("bcrypt-nodejs");
var crypto = require("crypto");
var appDirectory = "uploads";
var Recaptcha = require('express-recaptcha').Recaptcha;
var recaptcha = new Recaptcha('6LfVknUUAAAAALmamq2UnBERRvP2Hzb4cByQ5vIB', '6LfVknUUAAAAAAc3Pe55zywuyd0B-rgRFh-cJLLK');


// recaptcha vaidator
function captchaVerification(req, res, next) {
    if (req.recaptcha.error) {
        req.flash('signupMessage','Sorry, there was a problem validating your submission. Please try again later.');
        res.redirect('/signup');
    } else {
        return next();
    }
}

// UPLOAD HANDLER
var storage = multer.diskStorage({
  // check if there are any conflicts with track or albumName
  destination: function (req, file, cb) {
    var filetype = file.mimetype;
    var ext = filetype.substring(filetype.indexOf('/')+1);
    var destination = appDirectory + '/audio/' + req.body.id;
    // if(ext == 'jpeg' || ext == 'jpg' || ext == 'tiff') {
    //   destination = appDirectory + '/art/';
    // } else if (ext == 'mp3' || ext == 'wav') {
    //   destination = appDirectory + '/audio/' + req.body.id;
    // }
    mkdirp(destination, function (err) { // folder must be created
      console.log(destination)
      if (err) return cb(err)
      cb(null, destination);
    });
  },
  filename: function (req, file, cb) {
    var filetype = file.mimetype;
    var ext = filetype.substring(filetype.indexOf('/')+1);
    cb(null, (req.newMongoId + '.' + ext));
    // if (ext == 'jpeg' || ext == 'jpg' || ext == 'tiff') {
    //   if(req.body.albumID) {
    //     console.log('AlbumID found!');
    //     cb(null, (req.body.albumID + '.jpeg'));
    //   } else if (req.newMongoId) {
    //     console.log('NewMongoId found!');
    //     console.log(req.newMongoId);
    //     cb(null, (req.newMongoId + '.jpeg'));
    //   }
    // } else if (ext == 'mp3' || ext == 'wav') {
    //   cb(null, (req.newMongoId + '.' + ext));
    // }
  }
});

var upload = multer({ storage: storage }); // save new storage to upload function



// ROUTES
module.exports = function(app, passport) {

    // INDEX
    app.get('/', function(req, res) {
        res.render('website/index.ejs', {
          user : req.user,
        });
    });



    // LOG IN
    app.get('/login', function(req, res) {
        // render the page and pass in any flash data if it exists
        res.render('app/login/index.ejs', { message: req.flash('loginMessage') });
    });

    app.post('/login', passport.authenticate('local-login', {
        successRedirect : '/', // redirect to the secure profile section
        failureRedirect : '/login', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));



    // LOG OUT
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });



    // SIGN UP
    app.get('/signup', recaptcha.middleware.render, function(req, res) {
      User
        .find()
        .exec()
        .then(function(data) {
          res.render('app/login/signup.ejs', {
            message: req.flash('signupMessage'),
            users: data,
            user : req.user, // get the user out of session and pass to template
            captcha : res.recaptcha
          });
        });
      });

    app.post('/signup', recaptcha.middleware.verify, captchaVerification, passport.authenticate('local-signup', {
        successRedirect : '/initialize', // redirect to the secure profile section
        failureRedirect : '/signup', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));



    // FORGOT PASSWORD
    app.get('/forgot', function(req, res) {
      res.render('app/login/forgot.ejs', {
        user: req.user
      });
    });

    app.post('/forgot', function(req, res, next) {
      async.waterfall([
        function(done) {
          crypto.randomBytes(20, function(err, buf) {
            var token = buf.toString('hex');
            done(err, token);
          });
        },
        function(token, done) {
          User.findOne({ 'local.email': req.body.email }, function(err, user) {
            if (!user) {
              req.flash('error', 'No account with that email address exists.');
              return res.redirect('/forgot');
            }

            user.resetToken = token;
            user.tokenExpiration = Date.now() + 3600000; // 1 hour

            user.save(function(err) {
              done(err, token, user);
            });
          });
        },
        function(token, user, done) {
          var smtpTransport = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: "ourmusichubemails@gmail.com",
                pass: "1234Hello!!"
            }
          });
          var mailOptions = {
            to: user.local.email,
            from: 'noreply@ourmusichub.com',
            subject: 'OurMusicHub Submissions Password Reset',
            text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
              'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
              'http://' + req.headers.host + '/reset/' + token + '\n\n' +
              'If you did not request this, please ignore this email and your password will remain unchanged.\n'
          };
          smtpTransport.sendMail(mailOptions, function(err) {
            req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
            done(err, 'done');
          });
        }
      ], function(err) {
        if (err) return next(err);
        res.redirect('/forgot');
      });
    });



    // RESET PASSWORD
    app.get('/reset/:token', function(req, res) {
      User.findOne({ resetToken: req.params.token, tokenExpiration: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          console.log("Can't find user!");
          //req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('/forgot');
        }
        res.render('app/login/reset.ejs', {
          user: req.user
        });
      });
    });

    app.post('/reset/:token', function(req, res) {
      async.waterfall([
        function(done) {
          User.findOne({ resetToken: req.params.token, tokenExpiration: { $gt: Date.now() } }, function(err, user) {
            if (!user) {
              //req.flash('error', 'Password reset token is invalid or has expired.');
              return res.redirect('back');
            }

            user.local.password = user.generateHash(req.body.password);
            user.passwordToken = undefined;
            user.tokenExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          });
        },
        function(user, done) {
          var smtpTransport = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: "ourmusichubemails@gmail.com",
                pass: "1234Hello!!"
            }
          });
          var mailOptions = {
            to: user.email,
            from: 'noreply@ourmusichub.com',
            subject: 'Your password has been changed',
            text: 'Hello,\n\n' +
              'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
          };
          smtpTransport.sendMail(mailOptions, function(err) {
            req.flash('success', 'Success! Your password has been changed.');
            done(err);
          });
        }
      ], function(err) {
        res.redirect('/');
      });
    });



    // DELETE USER
    app.post('/deleteUser',
    function(req, res, next) {
      console.log(req.body);
      Promise.all([
        User.find({'_id':req.body.userid}).remove().exec(),
      ]).then(function(data) {
        res.redirect('/signup');
      });
    });


    // INITIALIZATION WIZARD
    app.get("/initialize", isLoggedIn, function(req, res, next) {
      // if user is already initialized, send them to the dashboard
      if(req.user.initialized) {
        res.redirect("/dashboard");
      } else {
        res.render("app/wizard/index.ejs", {
          user: req.user
        });
      }
    });


    // SUBMIT INITIALIZATION wizard
    app.post("/submit/static", isLoggedIn, function(req, res, next) {
      req.newMongoId = mongoose.Types.ObjectId();
      next();
    },
    function(req, res, next) {
      // create static instance for user
      var newStatic = new Static({
        userId: req.body.userId
        accounts: [],
        creditCards: [],
        debts: [],
        income: [],
        transfers: []
      });
      newStatic.save(function(err, doc){
        if(err) {
          return next(err);
        } else {
          //res.redirect('/dashboard'); // refresh the page
          return next();
        }
      });
    },
    function(req, res, next) {
      // for each account passed

      // save accounts
      Static.findOneAndUpdate({
        userId: req.body.userId,
      },{
        $push: { // push another track entry onto the tracks array
          accounts:
            {
              _id: req.newMongoId,
              title: req.body.trackName,
              timing: req.body.timing,
              download: req.body.download,
            }
        }
      },{
        new: true
      })
      .exec(function(err, doc){
        if(err) {
          return next(err);
        } else {
          res.redirect('/submissions');
        }
      });
    }
  );



    // DASHBOARD
    app.get('/dashboard', isLoggedIn, function(req, res, next) {
      Promise.all([
        Submission.find({'owner':req.user.local.email}).exec(),
        Album.find({'owner':req.user.local.email}).exec(),
      ]).then(function(data) {
        var submissions = data[0];
        var albums = data[1];
        res.render('app/submissions/index.ejs', {
            submissions: submissions,
            albums: albums,
            user : req.user
        });
      });
    });



    // SUBMIT NEW ALBUM
    app.post('/addAlbum',
      function(req, res, next) {
        req.newMongoId = mongoose.Types.ObjectId();
        next();
      },
      function(req, res, next) {
        console.log(req.body);
        // create a new album
        var newSubmission = new Submission({
          _id: req.newMongoId,
          owner: req.body.userEmail,
          artistType: req.body.artistType,
          artistName: req.body.artistName,
          type: req.body.albumType,
          name: req.body.albumName,
          year: req.body.year,
          genre: req.body.genre,
          subgenre: req.body.subgenre,
          language: req.body.language,
          country: req.body.country,
          state: req.body.state,
          city: req.body.city,
        });
        newSubmission.save(function(err, doc){
          if(err) {
            return next(err);
          } else {
            res.redirect('/submissions'); // refresh the page
          }
        });
      }
    );




    // MODIFY ALBUM SUBMISSION
    app.post('/updateAlbum',
    function(req, res, next) {
      // match the album via id instead of name so there
      // are no conflicts if the name changes
    	Submission
    		.findOneAndUpdate({
    			_id: req.body.id,
    		},{
    			$set: {
            artistType:req.body.artistType,
            artistName:req.body.artistName,
            type: req.body.albumType,
            name:req.body.albumName,
        		year:req.body.year,
            genre: req.body.genre,
            subgenre: req.body.subgenre,
            language: req.body.language,
            country:req.body.country,
            state:req.body.state,
            city:req.body.city,
          },
    		},{
    			new: true
    		})
    		.exec(function(err, doc){
          if(err) {
          	return next(err);
          } else {
            // refresh page and put the user on the album
            // they were currently editing
            res.redirect('/submissions#' + req.body.id);
          }
        });
    });



    // DELETE ALBUM
    app.post('/deleteAlbum',
    function(req, res, next) {
      rmdir('/Users/jeffcarbine/dev/SpikeDB/archive/music/' + req.body.albumID, function(err) {
        if (err) throw err;
      });
      Promise.all([
        Submission.find({'_id':req.body.albumID}).remove().exec(),
      ]).then(function(data) {
        res.redirect('/submissions');
      });
    });



    // ADD TRACK TO ALBUM SUBMISSION
    app.post('/addTrack',
      function(req, res, next) {
        req.newMongoId = mongoose.Types.ObjectId();
        next();
      },
      upload.single('audioFile'), // see upload handler (line 79)
      function(req, res, next) {
            Submission
              .findOneAndUpdate({
                _id: req.body.id,
              },{
                $push: { // push another track entry onto the tracks array
                  tracks:
                    {
                      _id: req.newMongoId,
                      title: req.body.trackName,
                      timing: req.body.timing,
                      download: req.body.download,
                    }
                }
              },{
                new: true
              })
              .exec(function(err, doc){
                if(err) {
                  return next(err);
                } else {
                  res.redirect('/submissions');
                }
              });
      }
    );




    // MOIDFY TRACK IN ALBUM SUBMISSION
    app.post('/updateTrack',
      upload.single('audioFile'), // see line 79
      function(req, res, next) {
        Submission
          .findOneAndUpdate({
            'tracks._id': req.body.trackID,
          },{
            $set: {
                'tracks.$.title' : req.body.trackName,
                'tracks.$.timing' : req.body.timing,
                'tracks.$.download' : req.body.download,
            }
          },{
            new: true
          })
          .exec(function(err, doc){
            if(err) {
              return next(err);
            } else {
              // refresh the page
              res.redirect('/submissions');
            }
          });
        });



      // DELETE TRACK FROM ALBUM SUBMISSION
      app.post('/deleteTrack',
        function(req, res, next) {
          var trackFile = appDirectory + '/archive/music/' + req.body.albumID + '/' + req.body.trackID + '.mp3';
          fs.unlink(trackFile);
          Submission
            .update({
              _id : req.body.albumID
            },{
              $pull: {
                'tracks': {
                  "_id" : req.body.trackID
                }
              }
            })
            .exec(function(err, doc){
              if(err) {
                return next(err);
              } else {
                res.redirect('/submissions');
              }
            });
          });


    // SUBMISSION APPROVAL INDEX
    app.get('/submissions/approval', isLoggedIn, function(req, res, next) {
      if(req.user.administrator == true) {
        Promise.all([
          Submission.find().exec(),
        ]).then(function(data) {
          var albums = data[0];
          res.render('app/submissions/approval.ejs', {
              albums: albums,
              user : req.user
          });
        });
      } else {
        res.redirect('/');
      }
    });


    // APPROVE AN ALBUM
    app.post("/approveAlbum", isLoggedIn, function(req, res, next) {
      req.newMongoId = mongoose.Types.ObjectId();
      next();
    },
    function(req, res, next) {
      Submission.find({'_id':req.body.submissionID}).remove().exec();
      var newAlbum = new Album({
        _id: req.newMongoId,
        owner: req.body.userEmail,
        artistType: req.body.artistType,
        artistName: req.body.artistName,
        type: req.body.albumType,
        name: req.body.albumName,
        year: req.body.year,
        genre: req.body.genre,
        subgenre: req.body.subgenre,
        language: req.body.language,
        country: req.body.country,
        state: req.body.state,
        city: req.body.city,
      });
      newAlbum.save(function(err, doc){
        if(err) {
          return next(err);
        } else {
          res.redirect('/submissions/approval');
        }
      });
    });

    // STREAMING ENDPOINTS
    app.get('/retrieve/albums', function(req, res, next) {
      Promise.all([
        Album.find().exec(), // pull all data from albums and
        Tracks.find().exec()      // pull all datay from respective tracks
      ]).then(function(data) {
        var albumData = [];
        var albumArr = data[0];
        var tracksArr = data[1];
        for(var i=0;i < albumArr.length; i++) {
          albumData.push(albumArr[i]);
          for(var e=0;e < tracksArr.length; e++) {
            if(tracksArr[e].albumID == albumArr[i]._id) {
              console.log('They match!');
              console.log(albumArr[i].tracks);
              console.log(tracksArr[e].tracks);
              Array.prototype.push.apply(albumArr[i].tracks, tracksArr[e].tracks);
            }
          }
        }
        return albumData;
        })
        .then(function(albumData) {
          res.jsonp(albumData);
        });
      });
};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/login');
}
