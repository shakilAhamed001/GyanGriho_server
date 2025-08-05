const express = require('express');
const app = express();
require('dotenv').config({ debug: true });
const cors = require('cors');
const admin = require('firebase-admin');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Debug: Log environment variables
console.log('MONGODB_URL:', process.env.MONGODB_URL ? '[set]' : 'undefined');

// Validate environment variables
const requiredEnvVars = ['MONGODB_URL'];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const port = process.env.PORT || 3000;

// Initialize Firebase Admin SDK with JSON file
try {
  admin.initializeApp({
    credential: admin.credential.cert(require('./firebase.json')),
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Authentication Middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// MongoDB Setup
const uri = process.env.MONGODB_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db('Gyangriho-management-system');
    const booksCollection = db.collection('books');
    const cartCollection = db.collection('cart');

    // Create a book (Authenticated)
    app.post('/books', authenticate, async (req, res) => {
      const bookData = req.body;
      if (!bookData.title || !bookData.author || !bookData.price) {
        return res.status(400).json({ error: 'Title, author, and price are required' });
      }
      try {
        const book = await booksCollection.insertOne({
          ...bookData,
          createdBy: req.user.uid,
          createdAt: new Date(),
        });
        res.status(201).json(book);
      } catch (err) {
        console.error('Error creating book:', err.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get all books in cart (Authenticated)
    app.get('/cart', authenticate, async (req, res) => {
      try {
        const cart = await cartCollection.find({ userId: req.user.uid }).toArray();
        res.status(200).json(cart);
      } catch (err) {
        console.error('Error fetching cart:', err.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Add book to cart (Authenticated)
    app.post('/cart', authenticate, async (req, res) => {
      const bookData = req.body;
      if (!bookData.bookId) {
        return res.status(400).json({ error: 'Book ID is required' });
      }
      try {
        const book = await cartCollection.insertOne({
          ...bookData,
          userId: req.user.uid,
          addedAt: new Date(),
        });
        res.status(201).json(book);
      } catch (err) {
        console.error('Error adding to cart:', err.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get all books (Public)
    app.get('/books', async (req, res) => {
      const { page, limit, genre, minYear, maxYear, author, minPrice, maxPrice, sortBy, order, search } = req.query;

      try {
        const currentPage = Math.max(1, parseInt(page) || 1);
        const perPage = parseInt(limit) || 10;
        const skip = (currentPage - 1) * perPage;

        const filter = {};
        if (search) {
          filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ];
        }
        if (genre) filter.genre = genre;
        if (minYear || maxYear) {
          filter.publishedYear = {
            ...(minYear && { $gte: parseInt(minYear) }),
            ...(maxYear && { $lte: parseInt(maxYear) }),
          };
        }
        if (author) filter.author = author;
        if (minPrice || maxPrice) {
          filter.price = {
            ...(minPrice && { $gte: parseFloat(minPrice) }),
            ...(maxPrice && { $lte: parseFloat(maxPrice) }),
          };
        }

        const sortOptions = { [sortBy || 'title']: order === 'desc' ? -1 : 1 };

        const [books, totalBooks] = await Promise.all([
          booksCollection
            .find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(perPage)
            .toArray(),
          booksCollection.countDocuments(filter),
        ]);

        res.status(200).json({
          books,
          totalBooks,
          currentPage,
          totalPages: Math.ceil(totalBooks / perPage),
        });
      } catch (error) {
        console.error('Error fetching books:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get book by ID (Public)
    app.get('/books/:id', async (req, res) => {
      const { id } = req.params;
      try {
        const book = await booksCollection.findOne({ _id: new ObjectId(id) });
        if (!book) return res.status(404).json({ error: 'Book not found' });
        res.status(200).json(book);
      } catch (err) {
        console.error('Error fetching book:', err.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Update book (Authenticated)
    app.put('/books/:id', authenticate, async (req, res) => {
      const { id } = req.params;
      try {
        const updatedBook = await booksCollection.updateOne(
          { _id: new ObjectId(id), createdBy: req.user.uid },
          { $set: { ...req.body, updatedAt: new Date() } }
        );
        if (updatedBook.matchedCount === 0) {
          return res.status(404).json({ error: 'Book not found or unauthorized' });
        }
        res.status(200).json({ message: 'Book updated' });
      } catch (err) {
        console.error('Error updating book:', err.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Delete book (Authenticated)
    app.delete('/books/:id', authenticate, async (req, res) => {
      const { id } = req.params;
      try {
        const result = await booksCollection.deleteOne({
          _id: new ObjectId(id),
          createdBy: req.user.uid,
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Book not found or unauthorized' });
        }
        res.status(200).json({ message: 'Book deleted' });
      } catch (err) {
        console.error('Error deleting book:', err.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Delete cart item by ID (Authenticated)
    app.delete('/cart/:id', authenticate, async (req, res) => {
      const { id } = req.params;
      try {
        const result = await cartCollection.deleteOne({
          _id: new ObjectId(id),
          userId: req.user.uid,
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Cart item not found or unauthorized' });
        }
        res.status(200).json({ message: 'Cart item deleted' });
      } catch (err) {
        console.error('Error deleting cart item:', err.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Ping MongoDB
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error in run function:', err.message);
  process.exit(1);
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to Gyangriho');
});

// Start server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});