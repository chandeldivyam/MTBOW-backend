const { model, Schema } = require("mongoose");

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: [true, "Please provide a name"],
            minlength: 3,
            maxlength: 50,
        },
        phone: {
            type: String,
            required: true,
            match: [/^\d{10}$/, "Please provide a valid mobile number"],
            unique: true,
        },
        phoneOtp: {
            type: String,
            required: false,
            unique: false,
        },
        user_id_mongo: {
            type: String,
            required: false,
            unique: false,
        },
    },
    { timestamps: true }
);

module.exports = model("User", userSchema);
