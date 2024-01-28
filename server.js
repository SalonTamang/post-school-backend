const path = require('path');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const app = express();


app.use(cors());

// Use Morgan as logger middleware
app.use(morgan('dev'));

// initial route
app.get('/', function(req, res) {
    res.send('start with collections/lessons or collections/orders');
});

// Serve static files from the "images" directory
app.use('/images', express.static(path.join(__dirname, 'images/')));

// Send a 404 response when an image file is not found
app.use('/images/*', function(req,res) {
    res.status(404).send('Sorry, we cannot find that image!');
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err) {
        res.status(404).send('Something went wrong!');
    } else {
        next();
    }
});

let propertiesReader = require("properties-reader");
let propertiesPath = path.resolve(__dirname, "conf/db.properties");
let properties = propertiesReader(propertiesPath);
let dbPprefix = properties.get("db.prefix");
//URL-Encoding of User and PWD
//for potential special characters
let dbUsername = encodeURIComponent(properties.get("db.user"));
let dbPwd = encodeURIComponent(properties.get("db.pwd"));
let dbName = properties.get("db.dbName");
let dbUrl = properties.get("db.dbUrl");
let dbParams = properties.get("db.params");

const url = dbPprefix + dbUsername + ":" + dbPwd + dbUrl + dbParams;

const { MongoClient, ServerApiVersion } = require("mongodb");
const client = new MongoClient(url, { serverApi: ServerApiVersion.v1 });
const port =  process.env.PORT || 4000;

const startServer = async (collectionName) => {
    try {
        await client.connect();
        const db = client.db(dbName);
        return db.collection(collectionName);
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
};

startServer();

app.param('collectionName', async (req, res, next, collectionName) => {
    try {
        req.collection = await startServer(collectionName);
        return next();
    } catch (err) {
        console.error(err);
    }
});

app.get('/collections/:collectionName', async(req, res, next) => {
    try {
        const data = await req.collection.find({}).toArray();
        res.json(data);
    } catch (err) {
        console.error(err);
        return next(err);
    }
});

//get a lesson from the database using the lesson id
app.get('/collections/:collectionName/:id', async (req, res, next) => {
    try {
        const lessonId = parseInt(req.params.id);
        const doc = await req.collection.findOne({id: lessonId});
        res.json(doc);
    } catch (err) {
        console.error("Error fetching data from MongoDB Atlas:", err);
        next(err);
    }
});

app.put('/collections/:collectionName', express.json(), async (req, res) => {
    const ids = req.body.id; // Array of lessonIds
    const spaces = req.body.spaces; // Array of spaces
    console.log(ids);
    try {
        const promises = ids.map(async (id, index) => {
            const lessonId = parseInt(id);
            const space = parseInt(spaces[index]);
            return req.collection.updateOne({id: lessonId}, {$inc: {available: -space}});
        });
        await Promise.all(promises);
        res.json({message: 'Lessons updated successfully'});
    } catch (err) {
        console.error('Error occurred while updating lessons...\n', err);
        res.status(500).send('Error occurred while updating lessons');
    }
});

//adds a new order to the database
app.post('/collections/:collectionName', express.json(), async (req, res) => {
    try {
        const result = await req.collection.insertOne(req.body);
        res.json(result);
    } catch (err) {
        console.error('Error occurred while adding new order...\n', err);
        res.status(500).send('Error occurred while adding new order');
    }
});

app.get('/:collectionName/search', async (req, res) => {
    const query = req.query.q;
    const results = await req.collection.find({
        $or: [
            { title: { $regex: new RegExp(query, 'i') } },
            { location: {$regex: new RegExp(query, 'i') }}
        ]
    }).toArray();
  
    res.json(results);
});

//deletes a lesson from the database using the lesson id
app.delete('/collections/:collectionName/:id', async (req, res, next) => {
    try {
        let id = req.params.id;
        id = parseInt(id);
        const result = await req.collection.deleteOne({ id: id });
        if (result.deletedCount === 1) {
            res.json({ message: 'Successfully deleted', id });
        } else {
            res.json({ message: 'No lesson found with this ID', id });
        }
    } catch (err) {
        console.error(err);
        return next(err);
    }
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});



