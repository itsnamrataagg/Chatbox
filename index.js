
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config(); 
const GROQ_API_KEYY = process.env.GROQ_API_KEY;

console.log("🔑 Loaded GROQ API Key:", GROQ_API_KEYY);

const app = express();
app.use(express.json());
app.use(express.static("public")); 


mongoose
  .connect("mongodb://127.0.0.1:27017/crud-chatbot")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));


const messageSchema = new mongoose.Schema({
  text: String,
  sender: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);


app.post("/messages", async (req, res) => {
  const { text, sender } = req.body;

  try {
    
    const userMsg = new Message({ text, sender: sender || "user" });
    await userMsg.save();

    let botReply = null;

    
    if (sender !== "bot") {
      try {
        const response = await axios.post(
          "https://api.groq.com/v1/chat/completions",
          {
            model: "grok-4",
            messages: [{ role: "user", content: text }],
          },
          {
            headers: { Authorization: `Bearer ${GROQ_API_KEYY}` },
          }
        );

        console.log("🔹 Groq raw response:", response.data);

        
        const replyText =
          response.data.choices?.[0]?.message?.content ||
          response.data.choices?.[0]?.text ||
          "🤖 AI unavailable";

        botReply = new Message({ text: replyText, sender: "bot" });
        await botReply.save();
      } catch (err) {
        console.error("⚠️ Groq API Error:", err.response?.data || err.message);

        
        botReply = new Message({ text: "🤖 AI unavailable", sender: "bot" });
        await botReply.save();
      }
    }

    
    res.status(201).json({ user: userMsg, bot: botReply });
  } catch (err) {
    console.error("❌ Error in /messages:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});


app.get("/messages", async (req, res) => {
  try {
    const msgs = await Message.find().sort({ timestamp: 1 });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});


app.get("/messages/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid id format" });
  }
  try {
    const msg = await Message.findById(id);
    msg ? res.json(msg) : res.status(404).json({ error: "Not found" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


app.put("/messages/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid id format" });
  }
  try {
    const updated = await Message.findByIdAndUpdate(
      id,
      { text: req.body.text },
      { new: true }
    );
    updated ? res.json(updated) : res.status(404).json({ error: "Not found" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update" });
  }
});


app.delete("/messages/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid id format" });
  }
  try {
    const deleted = await Message.findByIdAndDelete(id);
    deleted
      ? res.json({ success: true })
      : res.status(404).json({ error: "Not found" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});


app.delete("/messages", async (req, res) => {
  try {
    await Message.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});


app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
