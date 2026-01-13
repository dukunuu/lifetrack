const SparkMD5 = require('spark-md5');

module.exports = function md5(input) {
  return SparkMD5.hash(String(input));
};
