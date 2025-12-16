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
    // await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("book-courier");
    const booksCollection = db.collection("books");
    const ordersCollection = db.collection("orders");
    const usersCollection = db.collection("users");
    const wishlistCollection = db.collection("wishlist");
    const reviewsCollection = db.collection("reviews");


    /* ================= USER ================= */

    app.get("/user", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.user.email });
      if (!user) {
        const newUser = {
          name: req.user.name || "User",
          email: req.user.email,
          role: "user",
          createdAt: new Date(),
        };

        await usersCollection.insertOne(newUser);
        return res.send(newUser);
      }

      res.send(user);
    });

    app.get("/admin/users", verifyToken, async (req, res) => {
      const requester = await usersCollection.findOne({ email: req.user.email });

      if (!requester || requester.role !== "admin") {
        return res.status(403).send({ message: "Forbidden" });
      }

      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.patch("/admin/users/:id/role", verifyToken, async (req, res) => {
      const requester = await usersCollection.findOne({ email: req.user.email });

      if (!requester || requester.role !== "admin") {
        return res.status(403).send({ message: "Forbidden" });
      }

      const { role } = req.body;

      await usersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role } }
      );

      res.send({ success: true });
    });

    /* ================= ADMIN BOOKS ================= */

    app.get("/admin/books", verifyToken, async (req, res) => {
      const adminUser = await usersCollection.findOne({ email: req.user.email });

      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).send({ message: "Forbidden" });
      }

      const books = await booksCollection.find().toArray();
      res.send(books);
    });

    app.patch("/admin/books/:id/status", verifyToken, async (req, res) => {
      const adminUser = await usersCollection.findOne({ email: req.user.email });

      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).send({ message: "Forbidden" });
      }

      const { status } = req.body;

      await booksCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status } }
      );

      res.send({ success: true });
    });

    app.delete("/admin/books/:id", verifyToken, async (req, res) => {
      const adminUser = await usersCollection.findOne({ email: req.user.email });

      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).send({ message: "Forbidden" });
      }

      const bookId = new ObjectId(req.params.id);

      await booksCollection.deleteOne({ _id: bookId });
      await ordersCollection.deleteMany({ bookId });

      res.send({ success: true });
    });

    /* ================= BOOKS ================= */

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

      /* ================= REVIEWS ================= */


     app.post("/reviews", verifyToken, async (req, res) => {
        const { bookId, rating, comment } = req.body;

 
           const ordered = await ordersCollection.findOne({
               bookId: new ObjectId(bookId),
             userEmail: req.user.email,
                  });

          if (!ordered) {
    return res.status(403).send({ message: "Order required to review" });
    }

   const review = {
    bookId: new ObjectId(bookId),
    userEmail: req.user.email,
    userName: req.user.name || "User",
    rating,
    comment,
    createdAt: new Date(),
  };

  await reviewsCollection.insertOne(review);
  res.send({ success: true });
});


     app.get("/reviews", async (req, res) => {
     const bookId = req.query.bookId;

    const reviews = await reviewsCollection
                 .find({ bookId: new ObjectId(bookId) })
                          .sort({ createdAt: -1 })
                            .toArray();

                        res.send(reviews);
                       });
 

    /* ================= LIBRARIAN ================= */

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

    app.get("/mybooks", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.user.email });
      if (!user || (user.role !== "librarian" && user.role !== "admin")) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const books = await booksCollection.find({ addedBy: req.user.email }).toArray();
      res.send(books);
    });

    
    app.patch("/books/:id", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.user.email });

      if (!user || (user.role !== "librarian" && user.role !== "admin")) {
        return res.status(403).send({ message: "Forbidden" });
      }

      await booksCollection.updateOne(
        { _id: new ObjectId(req.params.id), addedBy: req.user.email },
        { $set: req.body }
      );

      res.send({ success: true });
    });

    /* ================= LIBRARIAN ORDERS ================= */

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

    /* ================= WISHLIST ================= */


app.post("/wishlist", verifyToken, async (req, res) => {
  const item = req.body;

  const exists = await wishlistCollection.findOne({
    bookId: new ObjectId(item.bookId),
    userEmail: req.user.email,
  });

  if (exists) {
    return res.send({ message: "Already wishlisted" });
  }

  await wishlistCollection.insertOne({
    bookId: new ObjectId(item.bookId),
    title: item.title,      
    image: item.image,    
    price: item.price,     
    userEmail: req.user.email,
    addedAt: new Date(),
  });

  res.send({ success: true });
});




   app.get("/wishlist", verifyToken, async (req, res) => {
     const wishlist = await wishlistCollection
        .find({ userEmail: req.user.email })
           .toArray();

          res.send(wishlist);
          });

     app.delete("/wishlist/:id", verifyToken, async (req, res) => {
         await wishlistCollection.deleteOne({
         _id: new ObjectId(req.params.id),
      userEmail: req.user.email,
  });

  res.send({ success: true });
});


    /* ================= PAY ORDER ================= */

    app.patch("/orders/:id/pay", verifyToken, async (req, res) => {
      const order = await ordersCollection.findOne({
        _id: new ObjectId(req.params.id),
        userEmail: req.user.email,
      });

      if (!order) {
        return res.status(404).send({ message: "Order not found" });
      }

      await ordersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            paymentStatus: "paid",
            paymentId: `PAY-${Date.now()}`,
            date: new Date(),
          },
        }
      );

      res.send({ success: true });
    });

    /* ================= INVOICES ================= */

  app.get("/myinvoices", verifyToken, async (req, res) => {
  const orders = await ordersCollection
    .find({ userEmail: req.user.email, paymentStatus: "paid" })
    .toArray();

  const invoices = await Promise.all(
    orders.map(async (order) => {
      const book = await booksCollection.findOne({ _id: order.bookId });

      return {
        _id: order._id,
        paymentId: order._id,
        bookTitle: book?.title || "Unknown",
        amount: (() => {
          const price = book?.price;
          const num = Number(
            typeof price === "string"
              ? price.replace(/[^0-9.]/g, "")
              : price
          );
          return Number.isFinite(num) ? num : 0;
        })(),
        date: order.orderedAt,
      };
    })
  );

  res.send(invoices);
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
