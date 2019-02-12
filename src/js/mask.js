// compress [1,1,1,1,0,0,0,0,1,1,1] -> [[1,4],[0,4],[1,3]]
// TODO: use a better compression method
function compressMask(mask) {
  if (mask.length == 0) return mask;
  var ret = [];
  var curr = mask[0];
  var cnt = 1;
  for (var i=1; i<mask.length; i++) {
    if (mask[i] != curr) {
      ret.push([curr, cnt]);
      curr = mask[i];
      cnt = 1;
      continue;
    }
    cnt ++;
  }
  ret.push([curr, cnt]);
  return ret;
}

function decompressMask(mask) {
  if (mask.length == 0) return mask;
  var ret = [];
  mask.forEach(element => {
    for (var i=0; i<element[1]; i++) {
      ret.push(element[0]);
    }
  });
  return ret;
}

module.exports = {
    compress: compressMask,
    decompress: decompressMask
}