# python3

import sys
import argparse
import json

import matplotlib.pyplot as plt
import numpy as np

def decompress(compressed_mask):
    r = []
    for v in compressed_mask:
        r.extend([v[0]] * v[1])
    return r

def main(file_path):
    with open(file_path) as f:
        label_file = json.load(f)
        dimension = label_file['dimension']
        shape_cnt = len(label_file['shapes'])
        cols = min(3, shape_cnt)
        rows = shape_cnt // cols if shape_cnt % cols == 0 else shape_cnt // cols + 1
        for index, shape in enumerate(label_file['shapes']):
            compressed_mask = shape['mask']
            mask = decompress(compressed_mask)
            nparray = np.reshape(np.asarray(mask), (dimension[1], dimension[0]))
            plt.subplot(rows, cols, index+1)
            plt.title(shape['label'])
            plt.imshow(nparray, cmap='Greys',  interpolation='nearest')
        plt.show()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--label-file', dest='label_file', help='label file')
    args = parser.parse_args()
    main(args.label_file)