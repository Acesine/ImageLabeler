const { ipcRenderer } = require('electron');
const { dialog } = require('electron').remote;
const prompt = require('electron-prompt');
const fs = require('fs');

const mask = require('./mask.js')

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

// Keep a record of current working image path
var imgPath;
var originalImageData;
var currentImageData;
var showingMask = false;
var leftMousePressed = false;
var isLabelling = false;
var labels = [];

function resetAll() {
  imgPath = undefined;
  originalImageData = undefined;
  currentImageData = undefined;
  showingMask = false;
  leftMousePressed = false;
  isLabelling = false;
  labels = [];
}

// ----- Following method assumes there's a label and operates on latest label
function getLastPoint() {
  if (labels[labels.length-1].points.length == 0) return undefined;
  return labels[labels.length-1].points[labels[labels.length-1].points.length - 1];
}

function getFirstPoint() {
  if (labels[labels.length-1].points.length == 0) return undefined;
  return labels[labels.length-1].points[0];
}

function getLabelPoints() {
  return labels[labels.length-1].points;
}

function pushLabelPoint(p) {
  labels[labels.length-1].points.push(p);
}

function getCurrentLineColor() {
  return labels[labels.length-1].line_color;
}

function pushMaskValue(x) {
  labels[labels.length-1].mask.push(x);
}

function getMaskValue(pos) {
  return labels[labels.length-1].mask[pos];
}

function getLableName() {
  return labels[labels.length-1].label
}
// -----

// Draw
var canvas = document.getElementById("imgCanvas");
var ctx = canvas.getContext("2d");
var helperRadius = 10;

function markFirstPoint(p) {
  ctx.beginPath();
  ctx.strokeStyle = '#FFFFFF';
  ctx.arc(p.x, p.y, helperRadius, 0, 2*Math.PI);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = "15px Verdana";
  ctx.fillText(getLableName(), p.x - 10, p.y - 10);
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

function completeLabeling() {
  constructMask();
  blendImageAndMask();
  isLabelling = false;
}

canvas.onmousedown = function(e) {
  if (!isLabelling) return;
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
  if (!isLabelling) return;
  if (leftMousePressed) {
    drawTo(new Point(e.offsetX, e.offsetY));
  }
}

canvas.onmouseup = function(e) {
  if (!isLabelling) return;
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
    originalImageData = ctx.getImageData(0, 0, img.width, img.height);
    currentImageData = ctx.getImageData(0, 0, img.width, img.height);
}

function openImage(filePath) {
  // Reset global vars before loading a new image
  resetAll();
  // This will trigger img.onload() method
  imgPath = filePath;
  img.src = imgPath;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newLabel(labelName) {
  var lineColor = '#'+Math.random().toString(16).substr(-6);
  for (var index in labels) {
    var label = labels[index];
    if (label.label == labelName) {
      lineColor = label.line_color;
    }
  }
  labels.push({
    label: labelName,
    line_color: lineColor,
    points: [],
    mask: []
  });
  isLabelling = true;
}

function loadLabel(filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      dialog.showErrorBox('Failure', 'Failed to load label file!');
    }
    try {
      var loaded = JSON.parse(data);
    } catch(e) {
      dialog.showErrorBox('Failure', 'Failed to load label file!');
      return;
    }
    labels = []
    loaded.shapes.forEach(element => {
      var label = element.label;
      labels.push({
        label: label,
        line_color: element.line_color,
        points: [],
        mask: []
      });
      isLabelling = true;
      element.points.forEach(p => {
        drawTo(new Point(p[0], p[1]));
      });
      if ('mask' in element) {
        labels[labels.length-1].mask = mask.decompress(element.mask);
        blendImageAndMask();
      }
    });
    isLabelling = false;
  });
}

function constructLableFileContent() {
  var ret = {
    dimension: [img.width, img.height],
    shapes: [
    ]
  };
  for (var index in labels) {
    var label = labels[index];
    var labelData = {
      label: label.label,
      line_color: label.line_color,
      points: [],
      mask: mask.compress(label.mask)
    };
    label.points.forEach(element => {
      labelData.points.push([element.x, element.y]);
    });
    ret.shapes.push(labelData);
  }
  return JSON.stringify(ret, null, 4);
}

function save(fileFullPath) {
  var labelFileFullPath = fileFullPath + '.label.json';
  if (imgPath === undefined) return;
  var content = constructLableFileContent();
  fs.writeFile(labelFileFullPath, content, 'utf8', err => {
    if (err) {
      dialog.showErrorBox('Failure', 'Filed to save file!');
    }
  });
  showMaskImage();
  var maskFileFullPath = fileFullPath + '.mask';
  saveCanvas(maskFileFullPath);
  showCurrentImage();
  dialog.showMessageBox({
    message: 'Lable and mask files are saved! 🎉🎉🎉'
  });
}

// Credits to https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon
function isInPolygon(px, py) {
  var c = 0;
  var points = getLabelPoints()
  var n = points.length;
  var i, j;
  for (i = 0, j = n-1; i < n; j = i++) {
    if (((points[i].y>py) != (points[j].y>py)) &&
	 (px < (points[j].x-points[i].x) * (py-points[i].y) / (points[j].y-points[i].y) + points[i].x))
       c = (c + 1) % 2;
  }
  return c != 0;
}

function constructMask() {
  var x, y;
  for (y=0; y<img.height; y++) {
    for (x=0; x<img.width; x++) {
      if (isInPolygon(x, y)) {
        pushMaskValue(1);
      } else {
        pushMaskValue(0);
      }
    }
  }
}

function blendImageAndMask() {
  currentImageData = ctx.getImageData(0, 0, img.width, img.height);
  var currentLineColor = getCurrentLineColor();
  var red = parseInt(currentLineColor.substring(1, 3), 16);
  var green = parseInt(currentLineColor.substring(3, 5), 16);
  var blue = parseInt(currentLineColor.substring(5, 7), 16);
  var alpha = 0.2;
  var x, y;
  for (y=0; y<img.height; y++) {
    for (x=0; x<img.width; x++) {
      var pos = y*4*img.width + x*4;
      if (getMaskValue(y*img.width+x) > 0) {
        currentImageData.data[pos] = Math.floor((1 - alpha) * currentImageData.data[pos] + alpha * red);
        currentImageData.data[pos + 1] = Math.floor((1 - alpha) * currentImageData.data[pos + 1] + alpha * green);
        currentImageData.data[pos + 2] = Math.floor((1 - alpha) * currentImageData.data[pos + 2] + alpha * blue);
      }
    }
  }
  showCurrentImage();
}

function showCurrentImage() {
  ctx.putImageData(currentImageData, 0, 0);
  showingMask = false;
}

function getMaskImage() {
  var maskImage = ctx.getImageData(0, 0, img.width, img.height);
  var x, y;
  for (y=0; y<img.height; y++) {
    for (x=0; x<img.width; x++) {
      var pos = y*4*img.width + x*4;
      var val = 0;
      for (var index in labels) {
        var label = labels[index];
        if (label.mask[y*img.width+x] > 0) {
          val = 255;
          break;
        }
      }
      maskImage.data[pos] = val;
      maskImage.data[pos + 1] = val;
      maskImage.data[pos + 2] = val;
    }
  }
  return maskImage;
}

function showMaskImage() {
  // Save current image first
  currentImageData = ctx.getImageData(0, 0, img.width, img.height);
  ctx.putImageData(getMaskImage(), 0, 0);
  showingMask = true;
}

function saveCanvas(filePath) {
  var imgAsDataURL = canvas.toDataURL("image/png", 1.0);
  var data = imgAsDataURL.replace(/^data:image\/\w+;base64,/, "");
  var buf = new Buffer(data, 'base64');
  fs.writeFile(filePath + '.png', buf, err => {
    if (err) {
        dialog.showErrorBox('Failure', 'Filed to save file!');
    }
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

ipcRenderer.on('save', (event, arg) => {
  dialog.showSaveDialog(filename => {        
    if(filename === undefined) { 
      // 
    } else { 
      save(filename);
    } 
  });
});

ipcRenderer.on('load-label', (event, arg) => {
  // Preconditions
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
  // Preconditions
  if (imgPath === undefined) {
    dialog.showErrorBox('Failure', 'Open an image first!');
    return;
  }
  // Complete current label if is still labelling
  if (isLabelling && getFirstPoint() !== undefined) {
    drawTo(getFirstPoint());
    completeLabeling();
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

ipcRenderer.on('toggle-masks', (event, arg) => {
  // Preconditions
  if (imgPath === undefined) {
    dialog.showErrorBox('Failure', 'Open an image first!');
    return;
  }

  if (showingMask) {
    showCurrentImage();
  } else {
    showMaskImage();
  }
});

ipcRenderer.on('save-canvas', (event, arg) => {
  // Preconditions
  if (imgPath === undefined) {
    dialog.showErrorBox('Failure', 'Open an image first!');
    return;
  }

  dialog.showSaveDialog(filePath => {        
    if(filePath === undefined) { 
      // 
    } else { 
      saveCanvas(filePath);
    } 
  });
});