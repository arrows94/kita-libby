function cryptoRandomId() {
  return [...Array(16)].map(() => Math.floor(Math.random()*16).toString(16)).join('');
}
module.exports = { cryptoRandomId };
