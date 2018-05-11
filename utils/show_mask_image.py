# python3

import sys
import argparse
import json
import os

import matplotlib
import matplotlib.pyplot as plt
import numpy as np

def decompress(compressed_mask):
    r = []
    for v in compressed_mask:
        r.extend([v[0]] * v[1])
    return r

def combine(a, b, shape):
    r = np.zeros(shape, dtype=np.uint8)
    for i in range(shape[0]):
        for j in range(shape[1]):
            r[i, j] = 1 if a[i, j] + b[i, j] > 0 else 0
    return r

def main(file_path, save_file):
    with open(file_path) as f:
        file_name = os.path.basename(file_path)
        label_file = json.load(f)
        dimension = label_file['dimension']
        # A label may contains multiple parts
        label_array = {}
        for shape in label_file['shapes']:
            compressed_mask = shape['mask']
            mask = decompress(compressed_mask)
            array_shape = (dimension[1], dimension[0])
            nparray = np.reshape(np.asarray(mask, dtype=np.uint8), array_shape)
            label_name = shape['label']
            if label_name not in label_array:
                label_array[label_name] = nparray
            else:
                label_array[label_name] = combine(nparray, label_array[label_name], array_shape)

        shape_cnt = len(label_array)
        cols = min(3, shape_cnt)
        rows = shape_cnt // cols if shape_cnt % cols == 0 else shape_cnt // cols + 1
        index = 1
        for label_name in label_array:
            nparray = label_array[label_name]
            plt.subplot(rows, cols, index)
            plt.title(label_name)
            plt.imshow(nparray, cmap='binary')
            if save_file:
                matplotlib.image.imsave('{}_{}.png'.format(file_name, label_name), nparray, cmap='binary')
            index += 1

        plt.show()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--label-file', dest='label_file', help='label file')
    parser.add_argument('--save', dest='save', nargs='?', const=True, help='save mask images')
    args = parser.parse_args()
    main(args.label_file, args.save)