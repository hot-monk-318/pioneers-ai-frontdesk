require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 8787;
const MODEL_CANDIDATES = [
  process.env.REACT_APP_ANTHROPIC_MODEL,
  "claude-haiku-4-5-20251001"
].filter(Boolean);

app.use(express.json());

app.post("/api/claude/reply", async (req, res) => {
  try {
    const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
    const { system, messages } = req.body || {};

    if (!apiKey) {
      return res.status(500).json({ error: "Missing REACT_APP_ANTHROPIC_API_KEY in server environment." });
    }

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: messages must be an array." });
    }

    const normalizedMessages = messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    }));

    let lastError = "Claude request failed.";
    for (const model of MODEL_CANDIDATES) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          system,
          messages: normalizedMessages
        })
      });

      const data = await response.json();
      if (response.ok) {
        const textBlock = Array.isArray(data.content) ? data.content.find((item) => item.type === "text") : null;
        return res.json({
          reply: textBlock?.text || "I'll connect you with our staff and flag it."
        });
      }

      lastError = data.error?.message || `Claude request failed for model ${model}.`;
      if (!lastError.toLowerCase().includes("model")) {
        return res.status(response.status).json({ error: lastError });
      }
    }

    return res.status(400).json({
      error: `All configured Anthropic models failed. Last error: ${lastError}`
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error calling Claude." });
  }
});

app.listen(PORT, () => {
  console.log(`Claude proxy listening on http://localhost:${PORT}`);
});
