const jwt = require("jsonwebtoken");

exports.createJwtToken = (payload) => {
    const token = jwt.sign(payload, process.env.JWT_AUTH_TOKEN, {
        expiresIn: "30d",
    });
    return token;
};

exports.verifyJwtToken = (token, next) => {
    try {
        const { userId } = jwt.verify(token, process.env.JWT_AUTH_TOKEN);
        return userId;
    } catch (err) {
        next(err);
    }
};
