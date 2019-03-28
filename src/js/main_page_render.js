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
  toString() {
    return '(' + this.x + ', ' + this.y + ')';
  }
}

var img = new Image();

// Keep a record of current working image path
var g_imgPath;
var g_originalImageData;
var g_currentImageData;
var g_showingMask = false;
var g_leftMousePressed = false;
var g_isLabelling = undefined;
/* Label struct
{
  label: labelName,
  line_color: lineColor,
  points: [Point],
  mask: [0/1]
}
*/
var g_labels = [];
/* RegionName */
var g_isCropping = undefined;
/*
[region, size]
*/
var g_isCroppingWithSize = undefined;
var g_isLinkingROI = undefined;
/*
{
  data: [Point],
  link: [str]
}
*/
var g_rois = {};
/*
{
  name: str,
  from: Point
}
*/
var g_movingROI = {};
/*
{
  name: region
}
*/
var g_selectedROI = undefined;

function resetAll() {
  g_imgPath = undefined;
  g_originalImageData = undefined;
  g_currentImageData = undefined;
  g_showingMask = false;
  g_leftMousePressed = false;
  g_isLabelling = undefined;
  g_labels = [];
  g_isCropping = undefined;
  g_isCroppingWithSize = undefined;
  g_isLinkingROI = undefined;
  g_rois = {};
  g_movingROI = {};
  g_selectedROI = undefined;
}

// ----- Following method assumes there's a label and operates on latest label
function getLastPoint(labelIndex=g_labels.length-1) {
  if (g_labels[labelIndex].points.length == 0) return undefined;
  return g_labels[labelIndex].points[g_labels[labelIndex].points.length - 1];
}

function getFirstPoint(labelIndex=g_labels.length-1) {
  if (g_labels[labelIndex].points.length == 0) return undefined;
  return g_labels[labelIndex].points[0];
}

function getLabelPoints(labelIndex=g_labels.length-1) {
  return g_labels[labelIndex].points;
}

function pushLabelPoint(p, labelIndex=g_labels.length-1) {
  g_labels[labelIndex].points.push(p);
}

function getCurrentLineColor(labelIndex=g_labels.length-1) {
  return g_labels[labelIndex].line_color;
}

function pushMaskValue(x, labelIndex=g_labels.length-1) {
  g_labels[labelIndex].mask.push(x);
}

function getMaskValue(pos, labelIndex=g_labels.length-1) {
  return g_labels[labelIndex].mask[pos];
}

function getLableName(labelIndex=g_labels.length-1) {
  return g_labels[labelIndex].label
}
// -----

// Draw
var canvas = document.getElementById("imgCanvas");
var ctx = canvas.getContext("2d");
var helperRadius = 7;

function markFirstPoint(labelIndex=g_labels.length-1, highlight=undefined) {
  let p = g_labels[labelIndex].points[0];
  if (highlight) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, helperRadius, 0, 2*Math.PI);
    ctx.fillStyle = highlight;
    ctx.fill();
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.font = "15px Verdana";
  ctx.fillText(getLableName(labelIndex), p.x - 10, p.y - 10);
}

function withInCircle(c, p) {
  return Math.sqrt((c.x-p.x)*(c.x-p.x) + (c.y-p.y)*(c.y-p.y)) < helperRadius;
}

function drawTo(p) {
  if (getLastPoint() === undefined) {
    pushLabelPoint(p);
    markFirstPoint();
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
  canvas.style.cursor = 'default';
  g_isLabelling = undefined;

  // Propogate to linked regions if exist
  let p = getFirstPoint();
  // Only care first region if exists and then all linked regions
  var region;
  for (var regionName in g_rois) {
    let p1 = g_rois[regionName].data[0];
    let p2 = g_rois[regionName].data[1];
    if (p.x >= p1.x && p.x <= p2.x && p.y >= p1.y && p.y <= p2.y) {
      region = regionName;
      break;
    }
  }
  if (region) {
    var linkedRegions = []
    // BFS to find all linked regions
    let visited = new Set([region]);
    let queue = [region]
    while(queue.length > 0) {
      let r = queue.shift();
      let region = g_rois[r];
      if (region.link && region.link.length > 0) {
        for (var i in region.link) {
          if (visited.has(region.link[i])) continue;
          queue.push(region.link[i]);
          visited.add(region.link[i]);
          linkedRegions.push(region.link[i]);
        }
      }
    }
    console.log('All linked regions: ' + linkedRegions);
    let sourceLabelIndex = g_labels.length - 1;
    let sourceRegionTopLeft = g_rois[region].data[0];
    console.log(`${sourceLabelIndex} - ${sourceRegionTopLeft}`)
    for (var i in linkedRegions) {
      // duplicate the label in each region, with same label name
      let linkedRegionName = linkedRegions[i];
      let targetRegionTopLeft = g_rois[linkedRegionName].data[0];
      g_labels.push({
        label: g_labels[sourceLabelIndex].label,
        line_color: g_labels[sourceLabelIndex].line_color,
        points: [],
        mask: []
      });
      for (var pindex in g_labels[sourceLabelIndex].points) {
        let sourceP = g_labels[sourceLabelIndex].points[pindex];
        let targetP = new Point(targetRegionTopLeft.x + sourceP.x - sourceRegionTopLeft.x, targetRegionTopLeft.y + sourceP.y - sourceRegionTopLeft.y);
        drawTo(targetP);
      }
      drawTo(getFirstPoint());
      constructMask();
      blendImageAndMask();
    }
  }
  refresh();
}

canvas.onmousedown = function(e) {
  if (e.button == 0) {
    // Left button
    var p = new Point(e.offsetX, e.offsetY);

    // Label:
    if (g_isLabelling) {
      if (getLastPoint() !== undefined && withInCircle(getFirstPoint(), p)) {
        drawTo(getFirstPoint());
        completeLabeling();
        g_leftMousePressed = false;
        return;
      }
      drawTo(p);
    }
    // Crop:
    else if (g_isCropping) {
      g_rois[g_isCropping].data.push(p);
      g_rois[g_isCropping].data.push(p);
      drawROI(g_isCropping);
    }

    // Crop with size
    else if (g_isCroppingWithSize) {
      let regionName = g_isCroppingWithSize[0];
      let size = g_isCroppingWithSize[1];
      g_rois[regionName].data.push(p);
      g_rois[regionName].data.push(new Point(p.x + size, p.y + size));
      drawROI(regionName);
      g_isCroppingWithSize = undefined;
    }

    else if (g_isLinkingROI) {
      var roi = g_isLinkingROI;
      var linkedROI = g_rois[roi].link;
      g_rois[roi].data[0] = p;
      let w = Math.abs(g_rois[linkedROI].data[0].y - g_rois[linkedROI].data[1].y);
      let h = Math.abs(g_rois[linkedROI].data[0].x - g_rois[linkedROI].data[1].x);
      g_rois[roi].data[1] = new Point(p.x + h, p.y + w);
      refresh(false);
      canvas.style.cursor = 'default';
      g_isLinkingROI = undefined;
      g_currentImageData = ctx.getImageData(0, 0, img.width, img.height);
      dialog.showMessageBox({
        message: '关联 ' + linkedROI + ' - ' + roi
      });
    }

    // Move ROI
    else {
      let region = isInROI(p);
      if (region) {
        console.log(`Select ROI ${region}`);
        g_movingROI = {name: region, from: p};
        g_selectedROI = {name: region};
      } else {
        g_selectedROI = undefined;
      }
      refresh();
    }

    g_leftMousePressed = true;
  }
}

canvas.onmousemove = function(e) {
  let p = new Point(e.offsetX, e.offsetY);

  if (g_leftMousePressed) {
    // Lable
    if (g_isLabelling) {
      drawTo(new Point(e.offsetX, e.offsetY));
    }
    // Crop
    if (g_isCropping) {
      let origin = g_rois[g_isCropping].data[0];
      if (e.shiftKey) {
        let l = Math.abs(p.y - origin.y);
        let sign = Math.sign(p.x - origin.x);
        p = new Point(origin.x + sign*l, p.y);
      }
      g_rois[g_isCropping].data[1] = p;
      refresh(false);
    }

    // Move ROI
    if (Object.keys(g_movingROI).length > 0) {
      let f = g_movingROI.from;
      let delta = [p.x - f.x, p.y - f.y];
      g_rois[g_movingROI.name].data[0].x += delta[0];
      g_rois[g_movingROI.name].data[0].y += delta[1];
      g_rois[g_movingROI.name].data[1].x += delta[0];
      g_rois[g_movingROI.name].data[1].y += delta[1];
      g_movingROI.from = p;
      refresh();
    }
  }
  if (g_isLabelling) {
    if (getLastPoint() !== undefined) {
      if (withInCircle(getFirstPoint(), p)) {
        markFirstPoint(g_labels.length-1, 'red');
      } else {
        markFirstPoint(g_labels.length-1, getCurrentLineColor());
      }
    }
  }
}

canvas.onmouseup = function(e) {
  if (e.button == 0) {
    var p = new Point(e.offsetX, e.offsetY);
    // Left button
    g_leftMousePressed = false;
    if (g_isCropping) {
      let p1 = g_rois[g_isCropping].data[0];
      g_rois[g_isCropping].data[0] = new Point(Math.min(p1.x, p.x), Math.min(p1.y, p.y));
      let w = Math.abs(p1.y - p.y);
      let h = Math.abs(p1.x - p.x);
      g_rois[g_isCropping].data[1] = new Point(g_rois[g_isCropping].data[0].x + h, g_rois[g_isCropping].data[0].y + w)
      refresh(false);
      canvas.style.cursor = 'default';
      g_isCropping = undefined;
      g_currentImageData = ctx.getImageData(0, 0, img.width, img.height);
    }
    if (Object.keys(g_movingROI).length > 0) {
      let f = g_movingROI.from;
      let delta = [p.x - f.x, p.y - f.y];
      g_rois[g_movingROI.name].data[0].x += delta[0];
      g_rois[g_movingROI.name].data[0].y += delta[1];
      g_rois[g_movingROI.name].data[1].x += delta[0];
      g_rois[g_movingROI.name].data[1].y += delta[1];
      g_movingROI = {};
    }
  }
}

document.addEventListener("keydown", function(e) {
  switch(e.key) {
    case "Escape":
      if (g_isCropping) {
        delete g_rois[g_isCropping];
        g_isCropping = undefined;
        canvas.style.cursor = 'default';
      }
      if (g_selectedROI) {
        g_selectedROI = undefined;
        refresh();
      }
      break;
    case "ArrowLeft":
      if (g_selectedROI) {
        if (e.shiftKey && !isSizeChangable(g_selectedROI.name)) return;
        if (!e.shiftKey) {
          g_rois[g_selectedROI.name].data[0].x -= 1
        }
        g_rois[g_selectedROI.name].data[1].x -= 1
      }
      refresh(true);
      break;
    case "ArrowRight":
      if (g_selectedROI) {
        if (e.shiftKey && !isSizeChangable(g_selectedROI.name)) return;
        if (!e.shiftKey) {
          g_rois[g_selectedROI.name].data[1].x += 1
        }
        g_rois[g_selectedROI.name].data[0].x += 1
      }
      refresh(true);
      break;
    case "ArrowUp":
      if (g_selectedROI) {
        if (e.shiftKey && !isSizeChangable(g_selectedROI.name)) return;
        if (!e.shiftKey) {
          g_rois[g_selectedROI.name].data[0].y -= 1
        }
        g_rois[g_selectedROI.name].data[1].y -= 1
      }
      refresh(true);
      break;
    case "ArrowDown":
      if (g_selectedROI) {
        if (e.shiftKey && !isSizeChangable(g_selectedROI.name)) return;
        if (!e.shiftKey) {
          g_rois[g_selectedROI.name].data[1].y += 1
        }
        g_rois[g_selectedROI.name].data[0].y += 1
      }
      refresh(true);
      break;
  }
});

function isSizeChangable(regionName) {
  if (g_rois[regionName].link && g_rois[regionName].link.length > 0) {
    dialog.showMessageBox({
      message: '无法改变关联标注区大小'
    });
    return false;
  }
  return true;
}

function isInROI(point) {
  for (var regionName in g_rois) {
    let p1 = g_rois[regionName].data[0];
    let p2 = g_rois[regionName].data[1];
    if (point.x >= p1.x && point.x <= p2.x && point.y >= p1.y && point.y <= p2.y) return regionName;
  }
  return null;
}

img.onload = function() {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    g_originalImageData = ctx.getImageData(0, 0, img.width, img.height);
    g_currentImageData = ctx.getImageData(0, 0, img.width, img.height);
}

function openImage(filePath) {
  // Reset global vars before loading a new image
  resetAll();
  // This will trigger img.onload() method
  g_imgPath = filePath;
  img.src = g_imgPath;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newLabel(labelName) {
  var lineColor = randomBrightColor();
  for (var index in g_labels) {
    var label = g_labels[index];
    if (label.label == labelName) {
      lineColor = label.line_color;
    }
  }
  g_labels.push({
    label: labelName,
    line_color: lineColor,
    points: [],
    mask: []
  });
  canvas.style.cursor = 'crosshair';
  g_isLabelling = labelName;
}

function randomBrightColor() {
  function isBright(s) {
    var v = 0;
    if (parseInt(s.substr(0, 2), 16) > 110) v += 1;
    if (parseInt(s.substr(2, 2), 16) > 110) v += 1;
    if (parseInt(s.substr(4, 2), 16) > 110) v += 1;
    return v > 1;
  }
  var t = 0;
  while (t < 10) {
    let color = Math.random().toString(16).substr(-6);
    if (isBright(color)) {
      return '#' + color;
    }
    t += 1;
  }
}

function createROI(regionName) {
  // Save current image data
  g_rois[regionName] = {data: []};
  refresh();
  g_currentImageData = ctx.getImageData(0, 0, img.width, img.height);
  canvas.style.cursor = 'crosshair';
  g_isCropping = regionName;
}

function createROIWithSize(regionName, sideLen) {
  g_rois[regionName] = {data: []};
  refresh();
  canvas.style.cursor = 'crosshair';
  g_isCroppingWithSize = [regionName, sideLen];
}

function createLinkedROI(sourceROI, roi) {
  if (roi in g_rois) {
    dialog.showErrorBox('❌', '标注区已存在，无法关联');
    return;
  }
  console.log(`Creating linked ROI: ${sourceROI} - ${roi}`);
  g_rois[roi] = {data: [], link: [sourceROI]};
  if (!g_rois[sourceROI].link) {
    g_rois[sourceROI].link = []
  }
  g_rois[sourceROI].link.push(roi);
  refresh();
  g_currentImageData = ctx.getImageData(0, 0, img.width, img.height);
  canvas.style.cursor = 'crosshair';
  g_isLinkingROI = roi;
}

function deleteROI(regionName) {
  delete g_rois[regionName];
  console.log(`Removed ROI ${regionName}`);
  // Unlink
  for (var r in g_rois) {
    if (g_rois[r].link && g_rois[r].link.indexOf(regionName) != -1) {
      let i = g_rois[r].link.indexOf(regionName);
      g_rois[r].link.splice(i, 1);
      console.log(`Unlinked ${regionName} from ${r}`);
    }
  }
  refresh();
}

function removeLabel(labelName) {
  while (true) {
    var pos = -1;
    for (var index in g_labels) {
      var label = g_labels[index];
      if (label.label == labelName) {
        pos = index;
        break;
      }
    }
    if (pos >= 0) {
      g_labels.splice(pos, 1);
    } else {
      break;
    }
  }
  refresh();
}

function loadLabel(filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      dialog.showErrorBox('❌', '无法载入标注文件');
    }
    try {
      var loaded = JSON.parse(data);
    } catch(e) {
      dialog.showErrorBox('❌', '无法载入标注文件');
      return;
    }
    g_labels = []
    loaded.shapes.forEach(element => {
      var label = element.label;
      g_labels.push({
        label: label,
        line_color: element.line_color,
        points: [],
        mask: []
      });
      g_isLabelling = label;
      element.points.forEach(p => {
        drawTo(new Point(p[0], p[1]));
      });
      if ('mask' in element) {
        g_labels[g_labels.length-1].mask = mask.decompress(element.mask);
        blendImageAndMask();
      }
    });
    g_rois = loaded.rois? loaded.rois : {};
    drawROIs();
    g_isLabelling = undefined;
  });
}

function refresh(withOriginalImage=true) {
  if (withOriginalImage) {
    showOriginalImage();
    for (var index in g_labels) {
      drawLabel(index);
    }
  } else {
    showCurrentImage();
  }
  drawROIs();
}

function drawROI(regionName) {
  let roi = g_rois[regionName].data;
  if (roi.length != 2) return;
  let p1 = roi[0];
  let p2 = roi[1];
  let tl = new Point(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y))
  let w = Math.abs(p1.x - p2.x);
  let h = Math.abs(p1.y - p2.y);
  if (g_selectedROI && g_selectedROI.name === regionName) {
    ctx.strokeStyle = 'red';
    ctx.fillStyle = 'red';
    ctx.lineWidth = 3;
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
  }
  ctx.strokeRect(tl.x, tl.y, w, h);
  ctx.font = "15px Verdana";
  ctx.fillText(regionName, tl.x, tl.y - 10);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#FFFFFF';
}

function drawROIs() {
  for (var index in g_rois) {
    drawROI(index);
  }
}

function drawLabel(labelIndex) {
  markFirstPoint(labelIndex);
  for (var index=1; index<g_labels[labelIndex].points.length; index++) {
    var curr = g_labels[labelIndex].points[index];
    var prev = g_labels[labelIndex].points[index-1];
    ctx.beginPath();
    ctx.strokeStyle = getCurrentLineColor(labelIndex);
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.closePath();
    ctx.stroke();
  }
  if ('mask' in g_labels[labelIndex]) {
    blendImageAndMask(labelIndex);
  }
}

function constructLableFileContent() {
  var ret = {
    dimension: [img.width, img.height],
    shapes: [
    ],
    rois: g_rois
  };
  for (var index in g_labels) {
    var label = g_labels[index];
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
  return JSON.stringify(ret, null);
}

function save(fileFullPath) {
  var labelFileFullPath = fileFullPath + '.label.json';
  if (g_imgPath === undefined) return;
  var content = constructLableFileContent();
  fs.writeFile(labelFileFullPath, content, 'utf8', err => {
    if (err) {
      dialog.showErrorBox('❌', '无法保存文件');
    }
    console.log("Saved label file " + labelFileFullPath);
  });
  
  var labelNames = new Set([]);
  for (var index in g_labels) {
    labelNames.add(g_labels[index].label);
  }
  var regionNames = new Set([]);
  for (var regionName in g_rois) {
    regionNames.add(regionName);
  }
  if (regionNames.size > 0) {
    for (let regionName of regionNames) {      
      var regionalImageFileFullPath = fileFullPath + '_' + regionName;
      saveOriginalImageWithROI(regionName, regionalImageFileFullPath, () => {
        console.log("Saved regional image " + regionalImageFileFullPath);
      });
      for (let labelName of labelNames) {
        var maskFileFullPath = fileFullPath + '_' + regionName + '_' + labelName + '.mask';
        saveMaskImage(maskFileFullPath, () => {
          console.log("Saved regional mask image " + maskFileFullPath);
        }, labelName, regionName);
      }
    }
  } else {
    for (let labelName of labelNames) {
      var maskFileFullPath = fileFullPath + '_' + labelName + '.mask';
      saveMaskImage(maskFileFullPath, () => {
        console.log("Saved file " + maskFileFullPath);
      }, labelName);
    }
  }
  refresh();
  dialog.showMessageBox({
    message: '标注和蒙版文件保存成功! 🎉🎉🎉'
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

function blendImageAndMask(labelIndex=g_labels.length-1) {
  g_currentImageData = ctx.getImageData(0, 0, img.width, img.height);
  var currentLineColor = getCurrentLineColor(labelIndex);
  var red = parseInt(currentLineColor.substring(1, 3), 16);
  var green = parseInt(currentLineColor.substring(3, 5), 16);
  var blue = parseInt(currentLineColor.substring(5, 7), 16);
  var alpha = 0.2;
  var x, y;
  for (y=0; y<img.height; y++) {
    for (x=0; x<img.width; x++) {
      var pos = y*4*img.width + x*4;
      if (getMaskValue(y*img.width+x, labelIndex) > 0) {
        g_currentImageData.data[pos] = Math.floor((1 - alpha) * g_currentImageData.data[pos] + alpha * red);
        g_currentImageData.data[pos + 1] = Math.floor((1 - alpha) * g_currentImageData.data[pos + 1] + alpha * green);
        g_currentImageData.data[pos + 2] = Math.floor((1 - alpha) * g_currentImageData.data[pos + 2] + alpha * blue);
      }
    }
  }
  showCurrentImage();
}

function showCurrentImage() {
  ctx.putImageData(g_currentImageData, 0, 0);
  g_showingMask = false;
}

function showOriginalImage() {
  ctx.putImageData(g_originalImageData, 0, 0);
  g_showingMask = false;
}

function getMaskImage(labelName=null, regionName=null) {
  var w = img.width;
  var h = img.height;
  var topleft = new Point(0, 0);
  if (regionName != null) {
    let region = g_rois[regionName].data;
    w = Math.abs(region[0].x - region[1].x);
    h = Math.abs(region[0].y - region[1].y);
    topleft = new Point(Math.min(region[0].x, region[1].x), Math.min(region[0].y, region[1].y));
  }
  var maskImage = ctx.createImageData(w, h);
  //var maskImage = ctx.getImageData(0, 0, img.width, img.height);
  var targetX, targetY;
  for (targetY=0; targetY<h; targetY++) {
    for (targetX=0; targetX<w; targetX++) {
      let x = targetX + topleft.x;
      let y = targetY + topleft.y;
      var val = 255;
      if (labelName === null) {
        for (var index in g_labels) {
          var label = g_labels[index];
          if (label.mask[y*img.width+x] > 0) {
            val = 0;
            break;
          }
        }
      } else {
        for (var index in g_labels) {
          var label = g_labels[index];
          if (label.label === labelName && label.mask[y*img.width+x] > 0) {
            val = 0;
            break;
          }
        }
      }
      let pos = targetY*4*w + targetX*4;
      maskImage.data[pos] = val;
      maskImage.data[pos + 1] = val;
      maskImage.data[pos + 2] = val;
      maskImage.data[pos + 3] = 255;
    }
  }
  return maskImage;
}

function showMaskImage(labelName=null, regionName=null) {
  // Save current image first
  g_currentImageData = ctx.getImageData(0, 0, img.width, img.height);
  ctx.putImageData(getMaskImage(labelName, regionName), 0, 0);
  g_showingMask = true;
}

function saveOriginalImageWithROI(regionName, filePath, callback) {
  let region = g_rois[regionName].data;
  let w = Math.abs(region[0].x - region[1].x);
  let h = Math.abs(region[0].y - region[1].y);
  let topleft = new Point(Math.min(region[0].x, region[1].x), Math.min(region[0].y, region[1].y));

  var roiImage = ctx.createImageData(w, h);
  var targetX, targetY;
  for (targetY=0; targetY<h; targetY++) {
    for (targetX=0; targetX<w; targetX++) {
      let x = targetX + topleft.x;
      let y = targetY + topleft.y;
      let pos = y*4*img.width + x*4;
      let targetPos = targetY*4*w + targetX*4;
      roiImage.data[targetPos] = g_originalImageData.data[pos];
      roiImage.data[targetPos + 1] = g_originalImageData.data[pos + 1];
      roiImage.data[targetPos + 2] = g_originalImageData.data[pos + 2];
      roiImage.data[targetPos + 3] = g_originalImageData.data[pos + 3];
    }
  }
  let tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  let tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.putImageData(roiImage, 0, 0);

  saveCanvas(filePath, callback, tmpCanvas);
}

function saveMaskImage(filePath, callback, labelName=null, regionName=null) {
  var w = img.width;
  var h = img.height;
  if (regionName != null) {
    let region = g_rois[regionName].data;
    w = Math.abs(region[0].x - region[1].x);
    h = Math.abs(region[0].y - region[1].y);
  }
  let tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  let tmpCtx = tmpCanvas.getContext('2d');

  let imageData = getMaskImage(labelName, regionName);
  tmpCtx.putImageData(imageData, 0, 0);

  saveCanvas(filePath, callback, tmpCanvas);
}

function saveCanvas(filePath, callback, canvasToSave=canvas) {
  var imgAsDataURL = canvasToSave.toDataURL("image/png", 1.0);
  var data = imgAsDataURL.replace(/^data:image\/\w+;base64,/, "");
  var buf = new Buffer(data, 'base64');
  fs.writeFile(filePath + '.png', buf, err => {
    if (err) {
        dialog.showErrorBox('❌', '无法保存文件');
    } else {
      callback();
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
function commonPreconditions() {
  // Preconditions
  if (g_imgPath === undefined) {
    dialog.showErrorBox('❌', '请先打开图像');
    return false;
  }
  // Complete current label if is still labelling
  if (g_isLabelling && getFirstPoint() !== undefined) {
    drawTo(getFirstPoint());
    completeLabeling();
  }
  return true;
}

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

ipcRenderer.on('create-roi', (event, arg) => {
  if (!commonPreconditions()) return;
  prompt({
    title: 'Input',
    label: '标注区名称:',
    type: 'input'
  })
  .then(r => {
    if (r == null || r.length == 0) return;
      prompt({
        title: 'Select',
        label: '选择类型:',
        type: 'select',
        selectOptions: {
          'Draw': '绘制矩形',
          'Input': '输入边长'
        }
      }).then(type => {
        if (type === 'Draw') {
          createROI(r);
        } else {
          prompt({
            title: 'Input',
            label: '边长像素:',
            type: 'input'
          }).then(sideLen => {
            createROIWithSize(r, parseInt(sideLen));
          })
        }        
      })
      .catch(e => {
        //
      });
  })
  .catch(e => {
    //
  });
});

ipcRenderer.on('create-linked-roi', (event, arg) => {
  if (!commonPreconditions()) return;
  let options = {}
  for (var regionName in g_rois) {
    options[regionName] = regionName;
  }
  prompt({
    title: 'Select',
    label: '要关联的标注区名称:',
    type: 'select',
    selectOptions: options
  })
  .then(sourceROI => {
    if (sourceROI == null || sourceROI.length == 0) return;
    prompt({
      title: 'Input',
      label: '标注区名称:',
      type: 'input'
    })
    .then(roi => {
      if (roi == null || roi.length == 0) return;
      createLinkedROI(sourceROI, roi);
    })
    .catch(e => {
      //
    });
  })
  .catch(e => {
    //
  });
});

ipcRenderer.on('delete-roi', (event, arg) => {
  if (!commonPreconditions()) return;
  prompt({
    title: 'Input',
    label: '标注区名称:',
    type: 'input'
  })
  .then(r => {
    if (r == null || r.length == 0) return;
    deleteROI(r);
  })
  .catch(e => {
    //
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
  if (g_imgPath === undefined) {
    dialog.showErrorBox('❌', '请先打开图像');
    return;
  }
  dialog.showOpenDialog(fileNames => {        
    // fileNames is an array that contains all the selected 
    if(fileNames === undefined || fileNames.length == 0) {
      return;
    } else {
      // refresh image
      openImage(g_imgPath);
      loadLabel(fileNames[0]);
    } 
  });
});

ipcRenderer.on('new-label', (event, arg) => {
  // Preconditions
  if (!commonPreconditions()) return;
  // Turn off cropping
  if (g_isCropping) {
    g_isCropping = undefined;
  }
  prompt({
    title: 'Input',
    label: '标注名称:',
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

ipcRenderer.on('remove-label', (event, arg) => {
  // Preconditions
  if (!commonPreconditions()) return;
  prompt({
    title: 'Input',
    label: 'Label name:',
    type: 'input'
  })
  .then(r => {
    if (r == null || r.length == 0) return;
    removeLabel(r);
  })
  .catch(e => {
    //
  });
});

ipcRenderer.on('toggle-masks', (event, arg) => {
  // Preconditions
  if (!commonPreconditions()) return;

  if (g_showingMask) {
    showCurrentImage();
  } else {
    showMaskImage();
  }
});

ipcRenderer.on('save-canvas', (event, arg) => {
  // Preconditions
  if (g_imgPath === undefined) {
    dialog.showMessageBox({title: '❌', message: '请先打开图像'});
    return;
  }

  dialog.showSaveDialog(filePath => {        
    if(filePath === undefined) { 
      // 
    } else { 
      saveCanvas(filePath, () => {});
    } 
  });
});