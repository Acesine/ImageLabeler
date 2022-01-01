const { dialog, nativeImage } = require('electron').remote;
const path = require('path');

const appIcon = nativeImage.createFromPath(path.join(__dirname, '../../resource/icon.png'));

function error(message) {
  dialog.showMessageBox({
    title: '❌',
    message: message,
    icon: appIcon,
  });
}

function message(message) {
  dialog.showMessageBox({
    message: message,
    icon: appIcon,
  });
}

module.exports = {
  error: error,
  message: message,
}