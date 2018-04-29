const { ipcRenderer, remote } = require('electron');

var Point = class {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
};

// Keep a record of current working image path
var imgPath;
var leftMousePressed = false;
var labelPoints = [];
var lastPoint;

function reset() {
    imgPath = undefined;
    leftMousePressed = false;
    labelPoints = [];
    lastPoint = undefined;
}

// Draw
var canvas = document.getElementById("imgCanvas");
var ctx = canvas.getContext("2d");

function drawTo(p) {
    ctx.beginPath();
    ctx.strokeStyle="#FFFFFF";
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
}

canvas.onmousedown = function(e) {
    if (e.button == 0) {
        // Left button
        leftMousePressed = imgPath !== undefined;
        lastPoint = new Point(e.offsetX, e.offsetY);
    }
}

canvas.onmousemove = function(e) {
    if (leftMousePressed) {
        var p = new Point(e.offsetX, e.offsetY);
        drawTo(p);
        labelPoints.push(p);
        lastPoint = p;
    }
}

canvas.onmouseup = function(e) {
    if (e.button == 0) {
        // Left button
        leftMousePressed = false;
        console.log(labelPoints.length);
    }
}

var img = new Image();
img.onload = function() {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    console.debug('Loaded file: ' + img.src)
}

function openImage(filePath) {
    // Reset global vars before loading a new image
    reset();
    // This will trigger img.onload() method
    imgPath = filePath;
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
    openImage(filePath);
});

document.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
});

// IPC ops
ipcRenderer.on('refresh-image', (event, arg) => {
    openImage(arg);
});