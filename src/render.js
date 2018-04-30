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
    ctx.beginPath();
    ctx.strokeStyle="#FFFFFF";
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
}

canvas.onmousedown = function(e) {
    if (imgPath === undefined) return;
    if (e.button == 0) {
        // Left button
        leftMousePressed = true;
        lastPoint = new Point(e.offsetX, e.offsetY);
        labelPoints.push(lastPoint);
    }
}

canvas.onmousemove = function(e) {
    if (imgPath === undefined) return;
    if (leftMousePressed) {
        var p = new Point(e.offsetX, e.offsetY);
        drawTo(p);
        // Simply dedup
        if (p.x != labelPoints[labelPoints.length-1].x || 
            p.y != labelPoints[labelPoints.length-1].y) {
            labelPoints.push(p);
        }
        lastPoint = p;
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
    fs.writeFile(labelFileFullPath, content, 'utf8', function (err) {
        if (err) {
            dialog.showErrorBox('Failed to save', 'Filed to save file');
        }
    
        dialog.showMessageBox({
            message: 'Label file saved at ' + labelFileFullPath
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