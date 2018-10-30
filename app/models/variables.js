var mongoose = require('mongoose');

// define the schema for our user model
var variablesSchema = mongoose.Schema({
    yearBudget  : Object,
    monthBudget : Object,
    flex        : Number
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Variables', variablesSchema);
