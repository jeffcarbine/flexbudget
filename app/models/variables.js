var mongoose = require('mongoose');

// define the schema for our user model
var variablesSchema = mongoose.Schema({
    yearly  : Object,
    monthly : Object
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Variables', variablesSchema);
