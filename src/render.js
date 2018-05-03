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
var originalImageData;
var leftMousePressed = false;
var currentLabel;
var labels = {};

function resetAll() {
  imgPath = undefined;
  originalImageData = undefined;
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

function pushMaskValue(x) {
  labels[currentLabel].mask.push(x);
}

function getMaskValue(pos) {
  return labels[currentLabel].mask[pos];
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
  ctx.fillStyle = '#FFFFFF';
  ctx.font = "15px Verdana";
  ctx.fillText(currentLabel, p.x - 10, p.y - 10);
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
  constructMask();
  blendImageAndMask();
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
    originalImageData = ctx.getImageData(0, 0, img.width, img.height);
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
  if (labelName in labels) {
    lineColor = labels[labelName].line_color;
  }
  labels[labelName] = {
    label: labelName,
    line_color: lineColor,
    points: [],
    mask: []
  }
  currentLabel = labelName;
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
    labels = {}
    loaded.shapes.forEach(element => {
      var label = element.label;
      labels[label] = {
        label: label,
        line_color: element.line_color,
        points: [],
        mask: []
      };
      currentLabel = label;
      element.points.forEach(p => {
        drawTo(new Point(p[0], p[1]));
      });
      if ('mask' in element) {
        labels[label].mask = decompressMask(element.mask);
        blendImageAndMask();
      }
    });
    currentLabel = undefined;
  });
}

// compress [1,1,1,1,0,0,0,0,1,1,1] -> [[1,4],[0,4],[1,3]]
// TODO: use a better compression method
function compressMask(mask) {
  if (mask.length == 0) return mask;
  var ret = [];
  var curr = mask[0];
  var cnt = 1;
  for (var i=1; i<mask.length; i++) {
    if (mask[i] != curr) {
      ret.push([curr, cnt]);
      curr = mask[i];
      cnt = 1;
      continue;
    }
    cnt ++;
  }
  ret.push([curr, cnt]);
  return ret;
}

function decompressMask(mask) {
  if (mask.length == 0) return mask;
  var ret = [];
  mask.forEach(element => {
    for (var i=0; i<element[1]; i++) {
      ret.push(element[0]);
    }
  });
  return ret;
}

function constructLableFileContent() {
  var ret = {
    dimension: [img.width, img.height],
    shapes: [
    ]
  };
  for (var label in labels) {
    var labelData = {
      label: labels[label].label,
      line_color: labels[label].line_color,
      points: [],
      mask: compressMask(labels[label].mask)
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
  var imageWithMask = ctx.getImageData(0, 0, img.width, img.height);
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
        imageWithMask.data[pos] = Math.floor((1 - alpha) * imageWithMask.data[pos] + alpha * red);
        imageWithMask.data[pos + 1] = Math.floor((1 - alpha) * imageWithMask.data[pos + 1] + alpha * green);
        imageWithMask.data[pos + 2] = Math.floor((1 - alpha) * imageWithMask.data[pos + 2] + alpha * blue);
      }
    }
  }
  ctx.putImageData(imageWithMask, 0, 0);
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
  // Complete current label if is still labelling
  if (isLabelling()) {
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
