import express from "express";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello World");
});

const PORT = process.env.PORT || 3200;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}\nhttp://localhost:${PORT}`);
});