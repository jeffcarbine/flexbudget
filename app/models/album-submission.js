var mongoose = require('mongoose');

var submissionSchema = mongoose.Schema({
  owner         : String,
  artistType    : String,
  artistName    : String,
  type          : String,
  name          : String,
  year          : String,
  genre         : String,
  subgenre      : String,
  language      : String,
  country       : String,
  state         : String,
  city          : String,
  tracks            : [{
    title       : String,
    language    : String,
    download    : String,
    timing      : String,
  }]
});

module.exports = mongoose.model('Submission', submissionSchema);
