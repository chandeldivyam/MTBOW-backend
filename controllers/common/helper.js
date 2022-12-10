const crypto = require("crypto");
const https = require("https");

function encodeRequest(payload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function decodeRequest(payload) {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
}

function signRequest(payload) {
    return crypto.createHash("sha256").update(payload).digest("hex");
}

module.exports = {
    encodeRequest,
    signRequest,
    decodeRequest,
};
