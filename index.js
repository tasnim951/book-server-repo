const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json");

const app = express();
const port = process.env.PORT || 5000;


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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

         // JWT Verification Middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const idToken = authHeader.split(" ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(401).send({ message: "Unauthorized" });
  }
};

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const booksCollection = client.db("book-courier").collection("books");
    const ordersCollection = client.db("book-courier").collection("orders");



// Add a book (protected for librarian/admin)
app.post("/books", verifyToken, async (req, res) => {
  const bookData = req.body;
  const userEmail = req.user.email; // get email from Firebase token

  try {
    // Fetch user from DB
    const user = await usersCollection.findOne({ email: userEmail });
    if (!user) return res.status(404).send({ message: "User not found" });

    // Only allow librarian or admin
    if (user.role !== "librarian" && user.role !== "admin") {
      return res.status(403).send({ message: "Forbidden: Only librarian/admin can add books" });
    }

    // Add metadata
    bookData.addedAt = new Date();
    bookData.addedBy = userEmail;

    const result = await booksCollection.insertOne(bookData);
    res.send({ 
      success: true, 
      message: "Book added successfully!", 
      insertedId: result.insertedId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to add book" });
  }
});




const usersCollection = client.db("book-courier").collection("users");

// Endpoint to get the logged-in user info (including role)
app.get("/user", verifyToken, async (req, res) => {
  try {
    const email = req.user.email;
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).send({ message: "User not found" });
    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch user info" });
  }
});


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

    // Get latest 6 books
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

    // Place order (protected)
    app.post("/order", verifyToken, async (req, res) => {
      const orderData = req.body;

     
      if (orderData.userEmail !== req.user.email) {
        return res.status(403).send({ message: "Forbidden: Email mismatch" });
      }

      orderData.status = "pending";
      orderData.paymentStatus = "unpaid";
      orderData.orderedAt = new Date();

      try {
        const result = await ordersCollection.insertOne(orderData);
        res.send({ insertedId: result.insertedId, message: "Order placed successfully!" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to place order!" });
      }
    });

   
    app.get("/myorders", verifyToken, async (req, res) => {
      try {
        const userOrders = await ordersCollection.find({ userEmail: req.user.email }).toArray();
        res.send(userOrders);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch orders!" });
      }
    });

  } finally {
    
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BookCourier Server is Running!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
