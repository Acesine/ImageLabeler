const { ipcRenderer, remote } = require('electron');

// Draw
var canvas = document.getElementById("imgCanvas");
var ctx = canvas.getContext("2d");

var img = new Image();
img.onload = function() {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    console.debug('Loaded file: ' + img.src)
}

function showImage(imgPath) {
    // This will trigger img.onload() method
    img.src = imgPath;
}

document.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();

    // Select last image
    var filePath;
    for (let f of e.dataTransfer.files) {
        filePath = 'file://' + f.path;
    }
    showImage(filePath);
});

document.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
});

// IPC ops
ipcRenderer.on('refresh-image', (event, arg) => {
    showImage(arg);
});