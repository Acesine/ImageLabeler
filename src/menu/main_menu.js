const { app, Menu } = require('electron')
const fs = require('fs') 

function onOpen(menuItem, browserWindow, event) {
  browserWindow.webContents.send('open-image');
}

function onNewLabel(menuItem, browserWindow, event) { 
  browserWindow.webContents.send('new-label');
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

var fileSubMenu = [
  {
    label: 'Open',
    click: onOpen
  },
  {
    type: 'separator'
  },
  {
    label: 'New label',
    click: onNewLabel
  },
  {
    label: 'Load label',
    click: onLoadLabel
  },
  {
    label: 'Save label',
    click: onSave
  },
  {
    type: 'separator'
  },
  {
    label: 'Toggle masks',
    click: onToggleMasks
  },
  {
    type: 'separator'
  },
  {
    label: 'Save this image',
    click: onSaveImage
  }
]

const template = [
  {
    label: 'File',
    submenu: fileSubMenu
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
    ]
  }
];

if (process.platform === 'darwin') {
  const name = app.getName()
  template.unshift({
    label: name,
    submenu: [
      {
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        role: 'hide'
      },
      {
        role: 'hideothers'
      },
      {
        role: 'unhide'
      },
      {
        type: 'separator'
      },
      {
        role: 'quit'
      }
    ]
  })
  // Edit menu.
  template[1].submenu.push(
    {
      type: 'separator'
    }
  )
  // Window menu.
  template[3].submenu = [
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close'
    },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize'
    },
    {
      label: 'Zoom',
      role: 'zoom'
    },
    {
      type: 'separator'
    },
    {
      label: 'Bring All to Front',
      role: 'front'
    }
  ]
};

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

require('electron-context-menu')({
  append: (params, browserWindow) => fileSubMenu,
  showInspectElement: false
})