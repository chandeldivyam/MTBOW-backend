const crypto = require("crypto");
const https = require("https");

function encodeReuqest(payload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function signRequest(payload) {
    return crypto.createHash("sha256").update(payload).digest("hex");
}

module.exports = {
    encodeReuqest,
    signRequest,
};
