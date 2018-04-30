const { app, Menu, dialog } = require('electron')
const fs = require('fs') 

function onOpen(menuItem, browserWindow, event) {
  dialog.showOpenDialog(fileNames => {        
    // fileNames is an array that contains all the selected 
    if(fileNames === undefined) { 
      console.debug("No file selected"); 
    } else { 
      browserWindow.webContents.send('refresh-image', fileNames[0]);
    } 
  });
}

function onLoadLabel(menuItem, browserWindow, event) {
  dialog.showOpenDialog(fileNames => {        
    // fileNames is an array that contains all the selected 
    if(fileNames === undefined) { 
       console.debug("No file selected"); 
    } else { 
       browserWindow.webContents.send('load-label', fileNames[0]);
    } 
 });
}

function onSave(menuItem, browserWindow, event) {
  browserWindow.webContents.send('save-image');
}

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Open',
        click: onOpen
      },
      {
        label: 'Load label',
        click: onLoadLabel
      },
      {
        label: 'Save',
        click: onSave
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        role: 'undo'
      },
      {
        role: 'redo'
      },
      {
        type: 'separator'
      },
      {
        role: 'cut'
      },
      {
        role: 'copy'
      },
      {
        role: 'paste'
      },
      {
        role: 'pasteandmatchstyle'
      },
      {
        role: 'delete'
      },
      {
        role: 'selectall'
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click (item, focusedWindow) {
          if (focusedWindow) focusedWindow.reload()
        }
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click (item, focusedWindow) {
          if (focusedWindow) focusedWindow.webContents.toggleDevTools()
        }
      },
      {
        type: 'separator'
      },
      {
        role: 'resetzoom'
      },
      {
        role: 'zoomin'
      },
      {
        role: 'zoomout'
      },
      {
        type: 'separator'
      },
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