const { ipcRenderer, remote } = require('electron');

function showImage(imgPath) {
    var img = document.createElement("img");
    img.src = imgPath;
    var imgDiv = document.getElementById('imgDiv');
    if (imgDiv.childElementCount > 0) {
        imgDiv.removeChild(imgDiv.firstChild);
    }
    imgDiv.appendChild(img);
    console.debug('Loaded file: ' + imgPath)
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