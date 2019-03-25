const { app, Menu } = require('electron')
const fs = require('fs')
const language = require('./language')
const contextmenu = require('electron-context-menu')

function onOpen(menuItem, browserWindow, event) {
  browserWindow.webContents.send('open-image');
}

function onCreateROI(menuItem, browserWindow, event) {
  browserWindow.webContents.send('create-roi');
}

function onDeleteROI(menuItem, browserWindow, event) {
  browserWindow.webContents.send('delete-roi');
}

function onNewLabel(menuItem, browserWindow, event) { 
  browserWindow.webContents.send('new-label');
}

function onRemoveLabel(menuItem, browserWindow, event) { 
  browserWindow.webContents.send('remove-label');
}

function onLoadLabel(menuItem, browserWindow, event) {
  browserWindow.webContents.send('load-label');
}

function onSave(menuItem, browserWindow, event) {
  browserWindow.webContents.send('save');
}

function onToggleMasks(menuItem, browserWindow, event) {
  browserWindow.webContents.send('toggle-masks');
}

function onSaveImage(menuItem, browserWindow, event) {
  browserWindow.webContents.send('save-canvas');
}

// Language related
function onChinese(menuItem, browserWindow, event) {
  buildMenu('ch');
}

function onEnglish(menuItem, browserWindow, event) {
  buildMenu('en');
}

function buildFileSubMenu(lang) {
  return [
    {
      label: language(lang).OpenImage,
      click: onOpen
    },
    {
      type: 'separator'
    },
    {
      label: language(lang).CreateROI,
      click: onCreateROI
    },
    {
      label: language(lang).DeleteROI,
      click: onDeleteROI
    },
    {
      type: 'separator'
    },
    {
      label: language(lang).NewLabel,
      click: onNewLabel
    },
    {
      label: language(lang).RemoveLabel,
      click: onRemoveLabel
    },
    {
      label: language(lang).LoadLabel,
      click: onLoadLabel
    },
    {
      label: language(lang).SaveLabel,
      click: onSave
    },
    {
      type: 'separator'
    },
    {
      label: language(lang).ToggleMasks,
      click: onToggleMasks
    },
    {
      type: 'separator'
    },
    {
      label: language(lang).SaveImage,
      click: onSaveImage
    }
  ];
}

function buildTemplate(lang) {
  return [
    {
      label: 'File',
      submenu: buildFileSubMenu(lang)
    },
    {
      label: 'View',
      submenu: [
        {
          role: 'togglefullscreen'
        }
      ]
    },
    {
      role: 'window',
      submenu: [
        {
          role: 'minimize'
        },
        {
          role: 'close'
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: '中文',
          click: onChinese
        },
        {
          label: 'English',
          click: onEnglish
        }
      ]
    }
  ];
}

function buildMenu(lang) {
  const menu = Menu.buildFromTemplate(buildTemplate(lang));
  Menu.setApplicationMenu(menu);
}

buildMenu('ch');
// TODO: figuire out how to reload context menu
contextmenu({
  prepend: (params, browserWindow) => buildFileSubMenu('ch'),
  showInspectElement: false
})