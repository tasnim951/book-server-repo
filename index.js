const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json");

const app = express();
const port = process.env.PORT || 5000;

/* Firebase Admin */
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/* MongoDB */
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.fez2prt.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* Middleware */
app.use(cors());
app.use(express.json());

/* JWT Verify */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized" });
  }
};

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("book-courier");
    const booksCollection = db.collection("books");
    const ordersCollection = db.collection("orders");
    const usersCollection = db.collection("users");

    /* ================= USER ================= */

    app.get("/user", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.user.email });
      if (!user) {
  const newUser = {
    name: req.user.name || "User",
    email: req.user.email,
    role: "user",
    createdAt: new Date()
  };

  await usersCollection.insertOne(newUser);
  return res.send(newUser);
}

res.send(user);

    });

    /* ================= BOOKS ================= */

    // Public books
    app.get("/allbooks", async (req, res) => {
      const books = await booksCollection.find({ status: "published" }).toArray();
      res.send(books);
    });

    app.get("/latestbooks", async (req, res) => {
      const books = await booksCollection
        .find({ status: "published" })
        .sort({ addedAt: -1 })
        .limit(6)
        .toArray();
      res.send(books);
    });

    app.get("/book/:id", async (req, res) => {
      const book = await booksCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!book) return res.status(404).send({ message: "Book not found" });
      res.send(book);
    });

    /* ================= LIBRARIAN ================= */

    // Add book
    app.post("/books", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.user.email });
      if (!user || (user.role !== "librarian" && user.role !== "admin")) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const bookData = {
        ...req.body,
        addedBy: req.user.email,
        addedAt: new Date(),
      };

      const result = await booksCollection.insertOne(bookData);
      res.send({ success: true, insertedId: result.insertedId });
    });

    // My Books
    app.get("/mybooks", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.user.email });
      if (!user || (user.role !== "librarian" && user.role !== "admin")) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const books = await booksCollection.find({ addedBy: req.user.email }).toArray();
      res.send(books);
    });

    // Librarian Orders (✅ THIS WAS MISSING)
    app.get("/librarian/orders", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.user.email });
      if (!user || (user.role !== "librarian" && user.role !== "admin")) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const books = await booksCollection
        .find({ addedBy: req.user.email })
        .project({ _id: 1 })
        .toArray();

      const bookIds = books.map(b => b._id);

      const orders = await ordersCollection
        .find({ bookId: { $in: bookIds } })
        .toArray();

      res.send(orders);
    });

    app.patch("/orders/:id/status", verifyToken, async (req, res) => {
  const user = await usersCollection.findOne({ email: req.user.email });
  if (!user || (user.role !== "librarian" && user.role !== "admin")) {
    return res.status(403).send({ message: "Forbidden" });
  }

  const { status } = req.body;

  await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status } }
  );

  res.send({ success: true });
});

app.patch("/orders/:id/cancel", verifyToken, async (req, res) => {
  const user = await usersCollection.findOne({ email: req.user.email });
  if (!user || (user.role !== "librarian" && user.role !== "admin")) {
    return res.status(403).send({ message: "Forbidden" });
  }

  await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status: "cancelled" } }
  );

  res.send({ success: true });
});


    /* ================= ORDERS ================= */

    app.post("/order", verifyToken, async (req, res) => {
      if (req.body.userEmail !== req.user.email) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const orderData = {
        ...req.body,
        bookId: new ObjectId(req.body.bookId),
        status: "pending",
        paymentStatus: "unpaid",
        orderedAt: new Date(),
      };

      await ordersCollection.insertOne(orderData);
      res.send({ success: true });
    });

    app.get("/myorders", verifyToken, async (req, res) => {
      const orders = await ordersCollection
        .find({ userEmail: req.user.email })
        .toArray();
      res.send(orders);
    });

  } finally {}
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BookCourier Server is Running!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
