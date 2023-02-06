require("dotenv").config();
require("express-async-errors");
const express = require("express");
const pool = require("./db/postgreDb");
const teamsRouter = require("./routes/teams");
const videoTeamsRouter = require("./routes/videoContest/videoTeams")
const contestsRouter = require("./routes/contests");
const videoContestRouter = require("./routes/videoContest/videoContests")
const { connectMongoDB } = require("./db/mongoConnect");
const authRouter = require("./routes/auth");
const checkAuth = require("./middleware/checkAuth");
const creatorRouter = require("./routes/creator");
const walletRouter = require("./routes/wallet");
const paymentRouter = require("./routes/payments");
const referRouter = require("./routes/refer")
const scratchCardRouter = require("./routes/scratchCards")

const cors = require("cors");
const SERVER_ERR = require("./middleware/errors");

const app = express();

app.use(express.json());
app.use(
    cors({
        credentials: true,
        origin: "*",
        optionsSuccessStatus: 200,
    })
);

app.use("/api/v1/contests", contestsRouter);
app.use("/api/v1/teams", teamsRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/creator", creatorRouter);
app.use("/api/v1/wallet", walletRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/videocontests", videoContestRouter);
app.use("/api/v1/videoteams", videoTeamsRouter);
app.use("/api/v1/refer", referRouter);
app.use("/api/v1/scratchcards", scratchCardRouter)

app.use((err, req, res, next) => {
    console.log(err);
    const status = err.status || 500;
    const message = err.message || SERVER_ERR;
    const data = err.data || null;
    res.status(status).json({
        type: "error",
        message,
        data,
    });
});

const port = process.env.PORT || 4000;
const start = async () => {
    try {
        await connectMongoDB(process.env.MONGO_URI);
        app.listen(port, () => {
            console.log(`Server is listening on port ${port}...`);
        });
    } catch (error) {
        console.log(error);
    }
};

start();
