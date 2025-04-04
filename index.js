const express = require('express')
const app = express()
require('dotenv').config()
const cors = require("cors");
const port = process.env.PORT || 3000

//const app = express();

app.use(cors());
app.use(express.json());

console.log(process.env.MONGODB_URL)

const { MongoClient, ServerApiVersion } = require('mongodb');

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const uri = "mongodb+srv://Admin:ANDA001@book.5il3a.mongodb.net/book?appName=book"
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection


    //create db and collections
    const db = client.db("Gyangriho-management-system")

    const booksCollection = db.collection("books")

    // create a book
    app.post("/books", async (req, res) => {
      const bookData = req.body;
      console.log(bookData)
      try {
        const book = await booksCollection.insertOne(req.body);
        res.status(201).json(book);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    })
    // get all books
    app.get("/books", async (req, res) => {
      try {
        const book = await booksCollection.find().toArray();
        res.status(201).json({ book })
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Welcome to Gyangriho')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})