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
var currentLabel;
var labels = {};

function reset() {
    imgPath = undefined;
    leftMousePressed = false;
    currentLabel = undefined;
    labels = {};
}

function getLastPoint() {
    return labels[currentLabel].lastPoint;
}

function setLastPoint(p) {
    labels[currentLabel].lastPoint = p;
}

function getLabelPoints() {
    return labels[currentLabel].points;
}

function pushLabelPoint(p) {
    labels[currentLabel].points.push(p);
}

function getCurrentLineColor() {
    return labels[currentLabel].line_color;
}

// Draw
var canvas = document.getElementById("imgCanvas");
var ctx = canvas.getContext("2d");

function drawTo(p) {
    if (getLastPoint() === undefined) {
        setLastPoint(p);
        pushLabelPoint(p);
    }
    ctx.beginPath();
    ctx.strokeStyle = getCurrentLineColor();
    ctx.moveTo(getLastPoint().x, getLastPoint().y);
    ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();
    // Simply dedup
    if (getLastPoint().x != p.x || 
        getLastPoint().y != p.y) {
        pushLabelPoint(p);
    }
    setLastPoint(p);
}

function drawPoints() {
    if (getLabelPoints().length == 0) return;
    setLastPoint(getLabelPoints()[0]);
    getLabelPoints().forEach(p => {
        drawTo(p);
        setLastPoint(p);
    });
}

function isLabelling() {
    return imgPath !== undefined && currentLabel !== undefined;
}

canvas.onmousedown = function(e) {
    if (!isLabelling()) return;
    if (e.button == 0) {
        // Left button
        leftMousePressed = true;
        var p = new Point(e.offsetX, e.offsetY);
        drawTo(p);
    }
}

canvas.onmousemove = function(e) {
    if (!isLabelling()) return;
    if (leftMousePressed) {
        var p = new Point(e.offsetX, e.offsetY);
        drawTo(p);
    }
}

canvas.onmouseup = function(e) {
    if (!isLabelling()) return;
    if (e.button == 0) {
        // Left button
        leftMousePressed = false;
    }
}

var img = new Image();
img.onload = function() {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
}

function openImage(filePath) {
    // Reset global vars before loading a new image
    reset();
    // This will trigger img.onload() method
    imgPath = filePath;
    img.src = imgPath;
}

function newLabel(labelName) {
    if (labelName in labels) {
        dialog.showErrorBox('Failure', `Label "${labelName}" already exists!`);
        return;
    }
    labels[labelName] = {
        label: labelName,
        line_color: '#'+Math.random().toString(16).substr(-6),
        points: []
    }
    currentLabel = labelName;
}

function loadLabel(filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            dialog.showErrorBox('Failure', 'Failed to load label file!');
        }
        var loaded = JSON.parse(data);
        labels = {}
        loaded.shapes.forEach(element => {
            var label = element.label;
            labels[label] = {
                label: label,
                line_color: element.line_color,
                points: []
            };
            element.points.forEach(p => {
                labels[label].points.push(new Point(p[0], p[1]));
            });
            currentLabel = label;
            drawPoints();
        });     
    });
    console.log('Label file loaded.')
}

function constructLableFileContent() {
    var ret = {
        shapes: [
        ]
    };
    for (var label in labels) {
        var labelData = {
            label: labels[label].label,
            line_color: labels[label].line_color,
            points: []
        };
        labels[label].points.forEach(element => {
            labelData.points.push([element.x, element.y]);
        });
        ret.shapes.push(labelData);
    }
    return JSON.stringify(ret, null, 4);
}

function save(labelFileFullPath) {
    if (imgPath === undefined) return;
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
    save(arg);
});

ipcRenderer.on('load-label', (event, arg) => {
    loadLabel(arg);
});

ipcRenderer.on('new-label', (event, arg) => {
    newLabel(arg);
})