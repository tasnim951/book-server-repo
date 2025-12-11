const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.fez2prt.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Middleware
app.use(cors());
app.use(express.json());

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const booksCollection = client.db("book-courier").collection("books");
    const ordersCollection = client.db("book-courier").collection("orders");

    // Get all books
    app.get("/allbooks", async (req, res) => {
      const books = await booksCollection.find({ status: "published" }).toArray();
      res.send(books);
    });

    // Get single book by ID
    app.get("/book/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const book = await booksCollection.findOne({ _id: new ObjectId(id) });
        if (!book) return res.status(404).send({ message: "Book not found" });
        res.send(book);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Invalid book ID" });
      }
    });

    
app.get("/latestbooks", async (req, res) => {
  try {
    const latestBooks = await booksCollection
      .find({ status: "published" })
      .sort({ addedAt: -1 })  
      .limit(6)
      .toArray();
    res.send(latestBooks);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch latest books" });
  }
});


    // Place order
    app.post("/order", async (req, res) => {
      const orderData = req.body;
      // Add default status fields
      orderData.status = "pending";
      orderData.paymentStatus = "unpaid";
      orderData.orderedAt = new Date();

      try {
        const result = await ordersCollection.insertOne(orderData);
        res.send({ insertedId: result.insertedId, message: "Order placed successfully!" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to place order" });
      }
    });

  } finally {
    // Do not close client, server keeps running
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BookCourier Server is Running!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
