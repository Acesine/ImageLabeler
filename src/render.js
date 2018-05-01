const { ipcRenderer } = require('electron');
const { dialog } = require('electron').remote;
const prompt = require('electron-prompt');
const fs = require('fs');

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

// Keep a record of current working image path
var imgPath;
var leftMousePressed = false;
var currentLabel;
var labels = {};

function resetAll() {
  imgPath = undefined;
  leftMousePressed = false;
  currentLabel = undefined;
  labels = {};
}

function getLastPoint() {
  if (labels[currentLabel].points.length == 0) return undefined;
  return labels[currentLabel].points[labels[currentLabel].points.length - 1];
}

function getFirstPoint() {
  if (labels[currentLabel].points.length == 0) return undefined;
  return labels[currentLabel].points[0];
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
var helperRadius = 10;

function markFirstPoint(p) {
  ctx.beginPath();
  ctx.strokeStyle = '#FFFFFF';
  ctx.arc(p.x, p.y, helperRadius, 0, 2*Math.PI);
  ctx.stroke();
}

function withInCircle(c, p) {
  return Math.sqrt((c.x-p.x)*(c.x-p.x) + (c.y-p.y)*(c.y-p.y)) < helperRadius;
}

function drawTo(p) {
  if (getLastPoint() === undefined) {
    pushLabelPoint(p);
    markFirstPoint(p);
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
}

function isLabelling() {
  return imgPath !== undefined && currentLabel !== undefined;
}

function completeLabeling() {
  currentLabel = undefined;
}

canvas.onmousedown = function(e) {
  if (!isLabelling()) return;
  if (e.button == 0) {
    // Left button
    var p = new Point(e.offsetX, e.offsetY);
    if (getLastPoint() !== undefined && withInCircle(getFirstPoint(), p)) {
      drawTo(getFirstPoint());
      completeLabeling();
      leftMousePressed = false;
      return;
    }
    leftMousePressed = true;
    drawTo(p);
  }
}

canvas.onmousemove = function(e) {
  if (!isLabelling()) return;
  if (leftMousePressed) {
    drawTo(new Point(e.offsetX, e.offsetY));
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
  resetAll();
  // This will trigger img.onload() method
  imgPath = filePath;
  img.src = imgPath;
}

function newLabel(labelName) {
  var lineColor = '#'+Math.random().toString(16).substr(-6);
  if (labelName in labels) {
    lineColor = labels[labelName].line_color;
  }
  labels[labelName] = {
    label: labelName,
    line_color: lineColor,
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
      currentLabel = label;
      element.points.forEach(p => {
        drawTo(new Point(p[0], p[1]));
      });
    });
  });
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

document.addEventListener('dragover', e => {
  e.preventDefault();
  e.stopPropagation();
});

// IPC ops
ipcRenderer.on('open-image', (event, arg) => {
  dialog.showOpenDialog(fileNames => {        
    // fileNames is an array that contains all the selected 
    if(fileNames === undefined || fileNames.length == 0) { 
      return;
    } else { 
      openImage(fileNames[0]);
    } 
  });
});

ipcRenderer.on('save-image', (event, arg) => {
  dialog.showSaveDialog(filename => {        
    if(filename === undefined) { 
      // 
    } else { 
      save(filename);
    } 
  });
});

ipcRenderer.on('load-label', (event, arg) => {
  if (imgPath === undefined) {
    dialog.showErrorBox('Failure', 'Open an image first!');
    return;
  }
  dialog.showOpenDialog(fileNames => {        
    // fileNames is an array that contains all the selected 
    if(fileNames === undefined || fileNames.length == 0) {
      return;
    } else {
      // refresh image
      openImage(imgPath);
      loadLabel(fileNames[0]);
    } 
  });
});

ipcRenderer.on('new-label', (event, arg) => {
  if (imgPath === undefined) {
    dialog.showErrorBox('Failure', 'Open an image first!');
    return;
  }
  if (isLabelling()) {
    dialog.showErrorBox('Failure', 'Complete current label before starting a new one!');
    return;
  }
  prompt({
    title: 'Input',
    label: 'Label name:',
    type: 'input'
  })
  .then(r => {
    if (r == null || r.length == 0) return;
    newLabel(r);
  })
  .catch(e => {
    //
  });
});
