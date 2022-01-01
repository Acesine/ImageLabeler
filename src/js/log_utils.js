function debug(msg) {
  console.log('[DEBUG] ' + msg);
}

function error(msg) {
  console.error('[ERROR] ' + msg);
}

module.exports = {
  debug: debug,
  error: error,
}