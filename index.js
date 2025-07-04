const express = require('express')
const app = express()
require('dotenv').config()
const cors = require("cors");
const port = process.env.PORT || 3000

app.use(cors());
app.use(express.json());

console.log(process.env.MONGODB_URL)

//codebase for security
const uri = process.env.MONGODB_URL

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	
    await client.connect();

    //create db and collections
    const db = client.db("Gyangriho-management-system")

    const booksCollection = db.collection("books")
    const cartCollection = db.collection("cart") 
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
    // get all books in cart
    app.get("/cart", async (req, res) => {
      try {
        const cart = await cartCollection.find({}).toArray();
        res.status(200).json(cart);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    })
    
    app.post("/cart", async (req, res) => {
      const bookData = req.body;
      console.log(bookData)
      try {
        const book = await cartCollection.insertOne(req.body);
        res.status(201).json(book);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    })
    // get all books
    app.get("/books", async (req, res) => {
      const {page,limit,genre,minYear,maxYear,author,minPrice,maxPrice,sortBy,order,search,} = req.query

      try {

        const currentPage = Math.max(1, parseInt(page) || 1);
        const perPage = parseInt(limit) || 10;
        const skip = (currentPage - 1) * perPage;

        const filter ={};
        if (search) {
          filter.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } } 
          ]
        }
        if (genre) filter.genre = genre;

        if (minYear || maxYear) {
          filter.publishedYear = {
            ...(minYear && { $gte: parseInt(minYear) }),
            ...(maxYear && { $lte: parseInt(maxYear) })
          }
          }

          if (author) filter.author = author;
          if (minPrice || maxPrice) {
            filter.price = {
              ...(minPrice && { $gte: parseFloat(minPrice) }),
              ...(maxPrice && { $lte: parseFloat(maxPrice) })
            }
          }
          // Sort options
        const sortOptions = { [sortBy || 'title']: order === 'desc' ? -1 : 1 };
         // Execute queries in parallel for better performance
         const [books, totalBooks] = await Promise.all([
          booksCollection
            .find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(perPage)
            .toArray(),
          booksCollection.countDocuments(filter)
        ]);

       // const book = await booksCollection.find(filter).toArray();
        res.status(201).json({  books, totalBooks, currentPage, totalPages: Math.ceil(totalBooks / perPage) })
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
  })

   // Get Book by ID (GET)
   app.get("/books/:id", async (req, res) => {
    const {id} =req.params;
     console.log(id)
    try {
      const book = await booksCollection.findOne({_id: new ObjectId(id)});
      if (!book) return res.status(404).json({ message: "Book not found" });
      res.json(book);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })

  // Update Book (PUT)
  app.put("/books/:id", async (req, res) => {
    try {
      const updatedBook = await booksCollection.updateOne( { _id: new ObjectId(req.params.id) }, { $set: req.body } );
      res.json(updatedBook);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })

  // Delete Book (DELETE)
  app.delete("/books/:id", async (req, res) => {
    try {
      await booksCollection.deleteOne({_id: new ObjectId(req.params.id),
      });
      res.json({ message: "Book deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })

  // Send a ping to confirm a successful connection
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