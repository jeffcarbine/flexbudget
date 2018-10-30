var mongoose = require('mongoose');

// define the schema for our user model
var statcSchema = mongoose.Schema({
    accounts            : [
        {
            name        : String,
            balance     : Number,
            rate        : Number,
        }
    ],
    debts               : [
        {
            name        : String,
            balance     : Number,
            rate        : Number,
        }
    ],
    income              : [
        {
            name        : String,
            amount      : Number,
            frequency   : String,
            months      : Array

        }
    ],
    transfers           : [
        {
            toAccount   : String,
            fromAccount : String,
            amount      : Number,
            limit       : Number
        }
    ]
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Static', staticSchema);
