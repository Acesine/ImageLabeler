A **toy** image labeler...

### Commands
- To open an image: Drag image into window or File -> Open.
- To add a new contour: File -> New label.
- To load an existing label file onto current image: File -> Load label.
- To save label: File -> Save label.
- To complete a contour, click inside the circle around starting point. This will complete current label.
- To save mask as image: Toggle masks -> Save image.

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
- Prerequisite: https://yarnpkg.com/en/ or https://www.npmjs.com/get-npm
- Run with source:
  ```bash
  yarn install
  yarn start
  ```
- Install:
  ```bash
  # On mac, will create .dmg
  yarn install
  yarn run package-mac
  yarn run release-mac
  ```
  ```bash
  # On x64 windows, will create .exe under ./release-builds/windows-installer
  yarn install
  yarn run package-win-x64
  yarn run release-win-x64
  ```
### Show masks
```bash
# Using numpy and matplotlib
python utils/show_mask_image.py --label-file ...
``` 