import argparse
import numpy as np
from PIL import Image

def main(src_file, target_file, x, y):
    x = int(x)
    y = int(y)
    src_img = np.asarray(Image.open(src_file))
    dest_img = np.asarray(Image.open(target_file))
    for i in range(dest_img.shape[0]):
        for j in range(dest_img.shape[1]):
            if dest_img[i][j][0] != src_img[y+i][x+j][0] or dest_img[i][j][1] != src_img[y+i][x+j][1] or dest_img[i][j][2] != src_img[y+i][x+j][2]:
                print(i, j)
                print(dest_img[i][j])
                print(src_img[y+i][x+j])

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--src-image', dest='src_image', help='src file')
    parser.add_argument('--target-image', dest='target_image', help='dest file')
    parser.add_argument('--x', dest='x', help='x')
    parser.add_argument('--y', dest='y', help='y')
    args = parser.parse_args()
    main(args.src_image, args.target_image, args.x, args.y)