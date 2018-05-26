var ENG = {
    OpenImage: 'Open image',
    NewLabel: 'New label',
    LoadLabel: 'Load label',
    SaveLabel: 'Save label',
    ToggleMasks: 'Toggle masks',
    SaveImage: 'Save image'
}

var CHI = {
    OpenImage: '打开图像',
    NewLabel: '新建标注',
    LoadLabel: '载入标注',
    SaveLabel: '保存标注',
    ToggleMasks: '切换图像/蒙版',
    SaveImage: '保存当前图像'
}

module.exports = function(lang) {
    switch(lang) {
        case 'en':
            return ENG;
        case 'ch':
            return CHI;
        default:
            return {}
    }
}