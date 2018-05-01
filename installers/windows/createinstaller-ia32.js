const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')

var appDirectory = 'ImageLabeler-win32-ia32/';

getInstallerConfig()
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })

function getInstallerConfig () {
  console.log('creating windows installer')
  const rootPath = path.join('./')
  const outPath = path.join(rootPath, 'release-builds')

  return Promise.resolve({
    appDirectory: path.join(outPath, appDirectory),
    authors: 'Acesine',
    noMsi: true,
    outputDirectory: path.join(outPath, 'windows-installer'),
    exe: 'ImageLabeler.exe',
    setupExe: 'ImageLabelerInstaller.exe',
    setupIcon: path.join(rootPath, 'resource', 'icon.ico')
  })
}