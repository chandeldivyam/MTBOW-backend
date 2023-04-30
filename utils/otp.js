const fast2sms = require("fast-two-sms");
var axios = require('axios');
var qs = require('qs');

const generateOTP = (otp_length) => {
    // Declare a digits variable
    // which stores all digits
    var digits = "0123456789";
    let OTP = "";
    for (let i = 0; i < otp_length; i++) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
};

const fast2smsSend = async ({ message, contactNumber }, next) => {
    try {
      var data = qs.stringify({
        'variables_values': `${message}`,
        'route': 'otp',
        'numbers': `${contactNumber}` 
      });
      var config = {
        method: 'post',
        url: 'https://www.fast2sms.com/dev/bulkV2',
        headers: { 
          'authorization': process.env.FAST2SMS_API_KEY, 
          'Content-Type': 'application/x-www-form-urlencoded', 
        },
        data : data
      };
      
      axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
      })
      .catch(function (error) {
        console.log(error);
      });
    } catch (error) {
      next(error);
    }
};

module.exports = { generateOTP, fast2smsSend };
