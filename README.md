A **toy** image labeler...

### Commands
- To open an image: Drag image into window or File -> Open.
- To add a new contour: File -> New label.
- To load an existing label file onto current image: File -> Load label.
- To save label: File -> Save label.
- To complete a contour, click inside the circle around starting point. This will complete current label.

### Format
Sample label file format: (Taking some properties from LabelMe)
```json
{
    "shapes": [
        {
            "label": "test1",
            "line_color": "#080632",
            "points": [
                [
                    428,
                    306
                ],
                [
                    438,
                    295
                ]
            ]
        },
        {
            "label": "test2",
            "line_color": "#663703",
            "points": [
                [
                    844,
                    437
                ],
                [
                    840,
                    435
                ]
            ]
        }
    ]
}
```
### Run
- Prerequisite: https://www.npmjs.com/get-npm
- Run with source:
  ```bash
  npm install
  npm start
  ```
- Install:
  ```bash
  # On mac, will create .dmg
  npm install
  npm package-mac
  npm release-mac
  ```
  ```bash
  # On x64 windows, will create .exe under ./release-builds/windows-installer
  npm install
  npm package-win-x64
  npm release-win-x64
  ```
### Show masks
```bash
# Using numpy and matplotlib
python utils/show_mask_image.py --label-file ...
``` 