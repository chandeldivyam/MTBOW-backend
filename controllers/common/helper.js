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

function realEscapeString (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
                return "";
            case `"`:
                return "";
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
            default:
                return char;
        }
    });
}

module.exports = {
    encodeRequest,
    signRequest,
    decodeRequest,
    realEscapeString
};
