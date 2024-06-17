const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");

const app = express();
const uploadMiddleware = multer({ dest: "uploads/" });

const salt = bcrypt.genSaltSync(10);
const secret = "asdfghjtrdcvbnhtrdcvbnhgfd";

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

// MongoDB Connection
mongoose.connect(
  "mongodb+srv://ankurbajpai2019@cluster0.6khbkix.mongodb.net/?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  }
);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Routes

// Register a new user
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, salt);
    const userDoc = await User.create({ username, password: hashedPassword });
    res.json(userDoc);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Registration failed" });
  }
});

// User login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.findOne({ username });
    if (!userDoc) {
      return res.status(404).json({ error: "User not found" });
    }
    const isPasswordValid = bcrypt.compareSync(password, userDoc.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }
    const token = jwt.sign({ id: userDoc._id }, secret, { expiresIn: "1h" });
    res.cookie("token", token, { httpOnly: true }).json({
      id: userDoc._id,
      username: userDoc.username,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

// User logout
app.post("/logout", (req, res) => {
  res.clearCookie("token").json({ message: "Logout successful" });
});

// Create a new post
app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  try {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    const decoded = jwt.verify(token, secret);
    const { title, summary, content } = req.body;

    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: decoded.id,
    });
    res.json(postDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Update a post
app.put("/post/:id", uploadMiddleware.single("file"), async (req, res) => {
  try {
    const postId = req.params.id;
    const { title, summary, content } = req.body;
    let cover = null;

    if (req.file) {
      const { originalname, path } = req.file;
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];
      const newPath = path + "." + ext;
      fs.renameSync(path, newPath);
      cover = newPath;
    }

    const { token } = req.cookies;
    const decoded = jwt.verify(token, secret);
    const postDoc = await Post.findById(postId);
    if (!postDoc) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (postDoc.author.toString() !== decoded.id) {
      return res
        .status(403)
        .json({ error: "Unauthorized to update this post" });
    }
    postDoc.title = title;
    postDoc.summary = summary;
    postDoc.content = content;
    if (cover) {
      postDoc.cover = cover;
    }
    await postDoc.save();
    res.json(postDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update post" });
  }
});

// Get all posts
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find().populate("author", "username").exec();
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Get a specific post by ID
app.get("/post/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId)
      .populate("author", "username")
      .exec();
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
