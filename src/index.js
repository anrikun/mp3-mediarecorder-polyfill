import Encoder from './mp3-encoder.js';
const AudioContext = window.AudioContext || window.webkitAudioContext;
let context, processor;

function createWorker(fn) {
  let js = fn.toString().match(/^.*?\{(.+)\}/s)[1];
  let blob = new Blob([js]);
  return new Worker(URL.createObjectURL(blob));
}

class MediaRecorder {
  constructor(stream) {
    let recorder = this;
    recorder.state = 'inactive';
    recorder.stream = stream;

    recorder._em = document.createDocumentFragment();

    recorder._encoder = createWorker(Encoder);
    recorder._encoder.onmessage = function(e) {
      let data = e.data;
      recorder._data.push(new Blob(data[1]));
      if (data[0]) {
        recorder._raiseDataAvailable();
        recorder._raise('stop');
      }
    };

    let _handlers = {};
    ['start', 'stop', 'pause', 'resume', 'dataavailable', 'error'].forEach(type => {
      Object.defineProperty(recorder, 'on' + type, {
        get: () => _handlers[type],
        set: fn => {
          if (_handlers[type]) {
            recorder._em.removeEventListener(type, _handlers[type]);
            delete _handlers[type];
          }
          if (fn) {
            _handlers[type] = fn;
            recorder._em.addEventListener(type, fn);
          }
        }
      })
    });
  }

  get mimeType() {
    return 'audio/mpeg';
  }

  start(timeslice) {
    let recorder = this;

    if (recorder.state !== 'inactive') {
      recorder._raiseError();
      return;
    }

    recorder.state = 'recording';

    recorder._tl = recorder.stream.getTracks()[0].addEventListener('ended', () => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    });

    if (!context) {
      context = new AudioContext();
    }
    if (!processor) {
      processor = context.createScriptProcessor(0, 1, 1);
    }
    recorder._input = context.createMediaStreamSource(recorder.stream);

    recorder._data = [];

    recorder._encoder.postMessage([0, context.sampleRate]);
    processor.onaudioprocess = function (e) {
      if (recorder.state === 'recording') {
        let buffer = e.inputBuffer.getChannelData(0).buffer;
        recorder._encoder.postMessage([1, buffer], [buffer]);
      }
    }

    recorder._input.connect(processor);
    processor.connect(context.destination);

    recorder._raise('start');

    if (timeslice) {
      recorder._slicing = setInterval(() => {
        if (recorder.state === 'recording') {
          recorder._raiseDataAvailable();
        }
      }, timeslice);
    }
  }

  stop() {
    let recorder = this;

    if (recorder.state === 'inactive') {
      recorder._raiseError();
      return;
    }

    recorder.state = 'inactive';

    recorder._input.disconnect();
    if (recorder._slicing) {
      clearInterval(recorder._slicing);
      delete recorder._slicing;
    }

    recorder.stream.removeEventListener('ended', recorder._tl);

    recorder._encoder.postMessage([2]);
  }

  pause() {
    let recorder= this;
    if (recorder.state === 'inactive') {
      recorder._raiseError();
      return;
    }
    recorder.state = 'paused';
    recorder._raise('pause');
  }

  resume() {
    let recorder= this;
    if (recorder.state === 'inactive') {
      recorder._raiseError();
      return;
    }
    recorder.state = 'recording';
    recorder._raise('resume');
  }

  requestData() {
    let recorder= this;
    if (recorder.state === 'recording') {
      recorder._raiseDataAvailable();
    }
    else {
      recorder._raiseError();
    }
  }

  addEventListener(...args) {
    this._em.addEventListener(...args);
  }

  removeEventListener(...args) {
    this._em.removeEventListener(...args);
  }

  dispatchEvent(...args) {
    return this._em.dispatchEvent(...args);
  }

  _raiseDataAvailable() {
    let recorder = this;
    let e = new Event('dataavailable');
    e.data = new Blob(recorder._data, {type: recorder.mimeType});
    recorder._data = [];
    recorder._em.dispatchEvent(e);
  }

  _raiseError(name) {
    let e = new Event('error');
    e.error = {name: name || 'InvalidStateError'};
    this._em.dispatchEvent(e);
  }

  _raise(type) {
    this._em.dispatchEvent(new Event(type));
  }
}

MediaRecorder.isTypeSupported = mimeType => {
  return mimeType === 'audio/mpeg';
};

MediaRecorder.notSupported = !navigator.mediaDevices || !AudioContext;

export default MediaRecorder;
