function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(date) {
  return new Date(date).toISOString();
}

function calculatePercentageChange(oldValue, newValue) {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

module.exports = {
  delay,
  formatDate,
  calculatePercentageChange,
};
