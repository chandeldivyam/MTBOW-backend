const cfSdk = require("cashfree-sdk");

const { Payouts } = cfSdk;
const { Validation } = Payouts;

const config = {
    Payouts: {
        ClientID: "CF240401CCOVN5T84OK74C7OSFIG",
        ClientSecret: "7bff468b8ff63150bb9d54562e8ac1992ac4e1b5",
        ENV: "TEST",
    },
};

(async () => {
    //init
    Payouts.Init(config.Payouts);
    //bank validation
    try {
        const response = await Validation.ValidateBankDetails({
            name: "sameera",
            phone: "9000000000",
            bankAccount: "026291800001191",
            ifsc: "YESB0000262",
        });
        console.log("bank validation response");
        console.log(response);
    } catch (err) {
        console.log("err caught in bank validation");
        console.log(err);
    }
})();
