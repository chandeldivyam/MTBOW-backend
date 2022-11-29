require("dotenv").config();
const pool = require("../db/postgreDb");
const Cashfree = require("cashfree-sdk");
const axios = require("axios");
const nanoId = require("nano-id");
const { query } = require("express");
const { encodeReuqest, signRequest } = require("./common/helper");
const fetch = require("node-fetch");

const generateToken = async (req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const { amount } = req.body;
        if (!amount) {
            res.status(400).send("Amount not entered");
        }
        const user_details = await pool.query(
            `select name, phone from user_info where id = $1`,
            [user_id_mongo]
        );
        const { name, phone } = user_details.rows[0];
        const order_id = nanoId(32);
        const user_number_string = user_id_mongo.toString();

        const { data } = await axios({
            method: "POST",
            url: "https://sandbox.cashfree.com/pg/orders",
            data: {
                order_id: order_id,
                order_amount: parseInt(amount),
                order_currency: "INR",
                customer_details: {
                    customer_id: user_number_string,
                    customer_name: name,
                    customer_email: "care@cashfree.com",
                    customer_phone: phone,
                },
            },
            headers: {
                "Content-Type": "application/json",
                "x-api-version": "2022-01-01",
                "x-client-id": process.env.CASHFREE_PAYMENT_TEST_API_KEY,
                "x-client-secret": process.env.CASHFREE_PAYMENT_TEST_SECRET_KEY,
            },
        });
        await pool.query(
            `
            INSERT INTO recharge_request (user_id, order_id, cf_order_id, cf_order_token, order_status, order_amount) VALUES ($1, $2, $3, $4, $5, $6)
        `,
            [
                user_id_mongo,
                data.order_id,
                data.cf_order_id,
                data.order_token,
                "ACTIVE",
                data.order_amount,
            ]
        );
        res.status(200).json({ order_token: data.order_token });
    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
};

const rechargeSuccess = async (req, res) => {
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const { order_id } = req.body;
    const current_status = await pool.query(
        `select order_status from recharge_request where user_id = $1 and order_id = $2`,
        [user_id_mongo, order_id]
    );
    const current_order_status = current_status.rows[0].order_status;
    if (current_order_status !== "ACTIVE") {
        return res.status(400).send("Payment Expired or Already processed");
    }
    const { data } = await axios({
        method: "GET",
        url: `https://sandbox.cashfree.com/pg/orders/${order_id}`,
        headers: {
            "Content-Type": "application/json",
            "x-api-version": "2022-01-01",
            "x-client-id": process.env.CASHFREE_PAYMENT_TEST_API_KEY,
            "x-client-secret": process.env.CASHFREE_PAYMENT_TEST_SECRET_KEY,
        },
    });

    if (data.order_status !== "PAID") {
        return res.status(424).send("Payment Failed");
    }
    await pool.query(
        `
        UPDATE recharge_request set order_status = 'PAID' where user_id = $1 and order_id = $2
    `,
        [user_id_mongo, order_id]
    );

    await pool.query(
        `
        UPDATE user_info set topup = (topup + $1) where id = $2
    `,
        [data.order_amount, user_id_mongo]
    );

    res.json({ success: true });
};

const rechargeFailed = async (req, res) => {
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const { order_id } = req.body;
    pool.query(
        `UPDATE recharge_request set order_status = 'FAILED' where user_id = $1 and order_id = $2`,
        [user_id_mongo, order_id]
    );
    res.json({ payment: "failed" });
};

const initiatePayment = async (req, res) => {
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const { amount } = req.body;

    if (!amount) {
        res.status(400).send("Amount not entered");
    }

    const user_details = await pool.query(
        `select name, phone from user_info where id = $1`,
        [user_id_mongo]
    );
    const { name, phone } = user_details.rows[0];
    const user_number_string = user_id_mongo.toString();
    const transaction_id = nanoId(32);
    const callbackUrl =
        "https://api.mtbow.com/api/v1/payments/callback/" + transaction_id;
    const payload = {
        merchantId: process.env.PHONEPE_UAT_MID,
        merchantTransactionId: transaction_id,
        merchantUserId: "MUID" + user_id_mongo,
        amount: 100 * amount,
        redirectUrl: "https://play.mtbow.com/payments",
        redirectMode: "POST",
        callbackUrl: callbackUrl,
        mobileNumber: phone,
        paymentInstrument: {
            type: "PAY_PAGE",
        },
    };
    const payload_base64 = encodeReuqest(payload);
    const sign = payload_base64 + "/pg/v1/pay" + process.env.PHONEPE_UAT_KEY;
    const x_verify =
        signRequest(sign) + "###" + process.env.PHONEPE_UAT_KEYINDEX;
    const options = {
        method: "POST",
        headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "X-VERIFY": x_verify,
        },
        body: JSON.stringify({
            request: payload_base64,
        }),
    };
    const payment_initiation_response = await fetch(
        "https://api-preprod.phonepe.com/apis/hermes/pg/v1/pay",
        options
    )
        .then((response) => response.json())
        .catch((err) => console.error(err));
    if (
        payment_initiation_response.success === true &&
        payment_initiation_response.message === "Payment initiated"
    ) {
        // await pool.query(
        //     `
        //     INSERT INTO recharge_request (user_id, transaction_id, verification_code, recharge_amount, recharge_status)
        //     VALUES ($1, $2, $3, $4)
        // `,
        //     [
        //         user_id_mongo,
        //         payment_initiation_response.data.merchantTransactionId,
        //         x_verify,
        //         amount,
        //         "ACTIVE",
        //     ]
        // );
        return res.status(200).json({
            redirect_url:
                payment_initiation_response.data.instrumentResponse.redirectInfo
                    .url,
        });
    }
    res.status(500).json({ status: "failure, payment did not initiate" });
};

const paymentCallback = async (req, res) => {
    // Get the id from url
    // get the payment status from the merchant
    // if success add money to the wallet
    const transaction_id = req.params.id;
    console.log(req);
};

module.exports = {
    generateToken,
    rechargeSuccess,
    rechargeFailed,
    initiatePayment,
    paymentCallback,
};
