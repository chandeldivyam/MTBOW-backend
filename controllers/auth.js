const User = require("../models/User");
const pool = require("../db/postgreDb");
const {
    PHONE_NOT_FOUND_ERR,
    PHONE_ALREADY_EXISTS_ERR,
    USER_NOT_FOUND_ERR,
    INCORRECT_OTP_ERR,
} = require("../middleware/errors");
const { createJwtToken } = require("../utils/token");
const { generateOTP, fast2smsSend } = require("../utils/otp");
const referralCodeGenerator = require("referral-code-generator")


const registerUser = async (req, res, next) => {
    try {
        let { phone, name, referral_code_used } = req.body;
        if(!phone || !name) return res.status(400).json({success: false})
        phone = phone.trim()
        const phoneExist = await User.findOne({ phone });
       if (phoneExist) {
            const user_exist = await pool.query(
                `select id from user_info where phone = $1`,
                [phone]
            );
            if (user_exist.rowCount > 0) {
                res.status(400).json({success: false, message: "user already exists"})
                return;
            }
            if(referral_code_used){
                const referral_code_check = await pool.query(
                    `SELECT referral_code from user_info where referral_code = $1`,
                    [referral_code_used.toUpperCase()]
                )
                if(referral_code_check.rowCount === 0){
                    res.status(400).json({success: false, message: "Please enter a valid Referral Code"})
                    return;
                }
            }
            const otp = generateOTP(6);

            phoneExist.phoneOtp = otp;
            await phoneExist.save();
            await fast2smsSend(
                {
                    message: `OTP for MTBOW is ${otp}`,
                    contactNumber: phone,
                },
                next
            );
            res.status(200).json({
                type: "success",
                message: "Account created OTP sent to mobile number",
                data: {
                    userId: phoneExist._id,
                },
            });
            return;
        }
        if(referral_code_used){
            const referral_code_check = await pool.query(
                `SELECT referral_code from user_info where referral_code = $1`,
                [referral_code_used]
            )
            if(referral_code_check.rowCount === 0){
                res.status(400).json({success: false, message: "Please enter a valid Referral Code"})
                return;
            }
        }
        const createUser = new User({
            phone,
            name,
        });
        const user = await createUser.save();
        //console.log("here");
        res.status(200).json({
            type: "success",
            message: "Account created OTP sent to mobile number",
            data: {
                userId: user._id,
            },
        });
        const otp = generateOTP(6);
        // save otp to user collection
        user.phoneOtp = otp;
        await user.save();
        // send otp to phone number
        await fast2smsSend(
            {
                message: `OTP for MTBOW is ${otp}`,
                contactNumber: user.phone,
            },
            next
        );
    } catch (error) {
        console.log(error)
        next(error);
    }
};

const loginUser = async (req, res, next) => {
    try {
        const { phone } = req.body;
        const user = await User.findOne({ phone });

        if (!user) {
            next({ status: 400, message: PHONE_NOT_FOUND_ERR });
            return;
        }

        res.status(201).json({
            type: "success",
            message: "OTP sended to your registered phone number",
            data: {
                userId: user._id,
            },
        });

        // generate otp
        const otp = generateOTP(6);
        // save otp to user collection
        user.phoneOtp = otp;
        user.isAccountVerified = true;
        await user.save();
        // send otp to phone number
        await fast2smsSend(
            {
                message: `OTP for MTBOW is ${otp}`,
                contactNumber: user.phone,
            },
            next
        );
    } catch (error) {
        next(error);
    }
};

const verifyOTPSignup = async (req, res, next) => {
    try {
        const { otp, userId, referral_code_used } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            next({ status: 400, message: USER_NOT_FOUND_ERR });
            return;
        }

        if (user.phoneOtp !== otp) {
            res.status(400).json({success: false, message: "Invalid OTP"})
            return;
        }

        const token = createJwtToken({ userId: user._id });
        let referral_code = "";
        while(true){
            referral_code = referralCodeGenerator.alphaNumeric('uppercase', 3, 1)
            let referral_unique = await pool.query(`SELECT * FROM user_info where referral_code = $1`, [referral_code])
            if(referral_unique.rowCount === 0) break
        }
        if(referral_code_used){
            const newUser = await pool.query(
                `INSERT INTO user_info (name, phone, promotional, winnings, topup, referral_code_used, referral_code) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [user.name, user.phone, 0, 0, 0, referral_code_used.toUpperCase(), referral_code]
            );
        }
        else{
            const newUser = await pool.query(
                `INSERT INTO user_info (name, phone, promotional, winnings, topup, referral_code) VALUES ($1, $2, $3, $4, $5, $6)`,
                [user.name, user.phone, 0, 0, 0, referral_code]
            );
        }
        const user_id_pg = await pool.query(`SELECT MAX(id) FROM user_info where phone=$1`, [user.phone]);

        user.user_id_mongo = Number(user_id_pg.rows[0]["max"]);
        user.phoneOtp = "";
        await user.save();

        res.status(201).json({
            type: "success",
            message: "OTP verified successfully",
            data: {
                token,
                userId: user._id,
            },
        });
    } catch (error) {
        next(error);
    }
};
const verifyOTPLogin = async (req, res, next) => {
    try {
        const { otp, userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            next({ status: 400, message: USER_NOT_FOUND_ERR });
            return;
        }

        if (user.phoneOtp !== otp) {
            next({ status: 400, message: INCORRECT_OTP_ERR });
            return;
        }
        const token = createJwtToken({ userId: user._id });

        user.phoneOtp = "";
        await user.save();

        res.status(201).json({
            type: "success",
            message: "OTP verified successfully",
            data: {
                token,
                userId: user._id,
            },
        });
    } catch (error) {
        next(error);
    }
};

const fetchCurrentUser = async (req, res, next) => {
    try {
        const { _id, name, user_id_mongo } = req.headers.user;

        return res.status(200).json({
            type: "success",
            message: "fetch current user",
            data: {
                _id,
                name,
                user_id_mongo,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    fetchCurrentUser,
    loginUser,
    registerUser,
    verifyOTPSignup,
    verifyOTPLogin,
};
