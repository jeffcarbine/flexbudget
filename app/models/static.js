var mongoose = require('mongoose');

// define the schema for our user model
var staticSchema = mongoose.Schema({
    userid              : String,
    accounts            : [
        {
            name        : String,
            balance     : Number,
            rate        : Number,
            type        : String
        }
    ],
    creditCards               : [
        {
            name        : String,
            balance     : Number,
            limit       : Number,
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
            dates       : Array

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
