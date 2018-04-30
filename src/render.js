const { ipcRenderer, remote } = require('electron');
const { dialog } = require('electron').remote
const path = require('path');
const fs = require('fs');

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
    if (lastPoint === undefined) {
        lastPoint = p;
        labelPoints.push(p);
    }
    ctx.beginPath();
    ctx.strokeStyle="#FFFFFF";
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
    // Simply dedup
    if (lastPoint.x != p.x || 
        lastPoint.y != p.y) {
        labelPoints.push(p);
    }
    lastPoint = p;
}

function drawPoints() {
    if (labelPoints.length == 0) return;
    lastPoint = labelPoints[0];
    labelPoints.forEach(p => {
        drawTo(p);
        lastPoint = p;
    });
}

canvas.onmousedown = function(e) {
    if (imgPath === undefined) return;
    if (e.button == 0) {
        // Left button
        leftMousePressed = true;
        var p = new Point(e.offsetX, e.offsetY);
        drawTo(p);
    }
}

canvas.onmousemove = function(e) {
    if (imgPath === undefined) return;
    if (leftMousePressed) {
        var p = new Point(e.offsetX, e.offsetY);
        drawTo(p);
    }
}

canvas.onmouseup = function(e) {
    if (imgPath === undefined) return;
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

function loadLabel(filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            dialog.showErrorBox('Failure', 'Failed to load label file!');
        }
        var loaded = JSON.parse(data);
        labelPoints = [];
        loaded.points.forEach(element => {
            labelPoints.push(new Point(element[0], element[1]));
        });
        drawPoints();
    });
}

// TODO: Apply compatible format with 'LabelMe'
function constructLableFileContent() {
    var ret = {
        points: [
        ]
    };

    labelPoints.forEach(element => {
        ret.points.push([element.x, element.y]);
    });
    
    return JSON.stringify(ret, null, 4);
}

function save() {
    if (imgPath === undefined) return;
    var fileName = path.parse(imgPath).base;
    var labelFileName = fileName + '_labels.json';
    var labelFileFullPath = `${__dirname}/${labelFileName}`;
    var content = constructLableFileContent();
    fs.writeFile(labelFileFullPath, content, 'utf8', err => {
        if (err) {
            dialog.showErrorBox('Failure', 'Filed to save file!');
        }
    
        dialog.showMessageBox({
            message: 'Label file saved at: \n' + labelFileFullPath
        });
    }); 
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

ipcRenderer.on('save-image', (event, arg) => {
    save();
});

ipcRenderer.on('load-label', (event, arg) => {
    loadLabel(arg);
});