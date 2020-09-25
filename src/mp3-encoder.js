export default () => {
  importScripts('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.0/lame.min.js');

  const blockSize = 1152;
  let encoder;

  function _convertBuffer(buffer) {
    let src = new Float32Array(buffer), len = src.length;
    let dst = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      let s = Math.max(-1, Math.min(1, src[i]));
      dst[i] = s * (s < 0 ? 0x8000 : 0x7FFF);
    }
    return dst;
  }

  function _encode(buffer) {
    let encoded = [];
    buffer = _convertBuffer(buffer);
    for (let i = 0, len = buffer.length; i < len; i += blockSize) {
      let buf = encoder.encodeBuffer(buffer.subarray(i, i + blockSize));
      buf.length && encoded.push(new Int8Array(buf));
    }
    return encoded;
  }

  const handlers = [
    (sampleRate) => {
      encoder = new lamejs.Mp3Encoder(1, sampleRate || 44100, 128);
    },
    (buffer) => {
      postMessage([0, _encode(buffer)]);
    },
    () => {
      let encoded = [];
      let buf = encoder.flush();
      buf.length && encoded.push(new Int8Array(buf));
      postMessage([1, encoded]);
    },
  ];

  onmessage = function(e) {
    let data = e.data;
    handlers[data[0]](data[1]);
  };
};
