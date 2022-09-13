const Pool = require("pg").Pool;
const postgresql_config = require("./postgresql-config");

const pool = new Pool(postgresql_config);

module.exports = pool;
