require('dotenv').config();
var express = require('express');
var app = express();
var dbClient = require('mongodb').MongoClient;

var port = process.env.PORT || 8080;

var dbURL = process.env.DBURI

console.log(dbURL);


app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index', { url: req.protocol + '://' + req.get('host') });
});

app.get(['/https://:original','/http://:original'], (req, res) => {
    var serverUrl = req.protocol + '://' + req.get('host');
    res.setHeader('Content-Type', 'application/json');
    var result = {
        "original_url": null,
        "short_url": null
    };
    var urlOriginal = req.path.substr(1);
    if (isValidUrl(req.params.original)) {
        result.original_url = urlOriginal;
        createShortUrl(urlOriginal, (success, id) => {
            if (success) {
                result.short_url = serverUrl + "/" + id;
                res.end(JSON.stringify(result));
            } else {
                res.end(JSON.stringify({ error: id }));
            }
            
        });
    } else {
        res.end(JSON.stringify({ error: 'Invalid URL' }));
    }
});

app.get('/:id', (req, res) => {
    dbClient.connect(dbURL, (err, db) => {
        if (err) return res.end(JSON.stringify({ error : err.message }));
        var collection = db.collection('urls');
        collection.findOne({ '_id': +req.params.id }, (err, result) => {
            if (err) {
                db.close();
                return res.end(JSON.stringify({ error: 'Short url not found' }));
            }
            res.redirect(result.original);
            db.close();
        });
    })
});

function isValidUrl(str) {
    var splitted = str.split(".");
    if (splitted.length < 2 || splitted.length > 4) {
        return false
    } else {
        if (splitted.length == 4) {
            if (splitted[0].toLowerCase() != "www") {
                return false
            }
        }
        splitted.forEach((el) => {
            if (/[^a-z\d]/i.test(el)) {
                return false;
            }
        });
    }
    return true;
}

function createShortUrl(originalUrl, callback) {
    dbClient.connect(dbURL, (err, db) => {
        if (err) {
            return callback(false, err.message);
        } 
        var collection = db.collection('urls');
        collection.findOne({ 'original': originalUrl }, (err, result) => {
                if (result == null) {
                    getNextSequence(db, 'urlId', (err, id) => {
                        collection.insert({ _id: id, original: originalUrl }, (err, result) => {
                            if (err) {
                                db.close();
                                return callback(false, err.message);
                            }
                            return callback(true, id);
                            db.close();
                        })
                    });
                } else {
                    return callback(true, result._id);
                    db.close();
                }
            });
    });
}

function getNextSequence(db, name, callback) {
    db.collection("counters").findAndModify( { _id: name }, null, { $inc: { seq: 1 } }, function(err, result){
        if(err) return callback(err, result);
        callback(err, result.value.seq);
    } );
}

app.listen(port, () => {
    console.log('Server started on port '+ port);
});