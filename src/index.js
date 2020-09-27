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

    recorder._wo = createWorker(Encoder);
    recorder._wo.onmessage = function(e) {
      let data = e.data;
      recorder._da.push(new Blob(data[1]));
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
      return recorder._raiseError();
    }

    recorder.state = 'recording';

    let listener = () => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    };
    recorder._li = listener;
    recorder.stream.getTracks()[0].addEventListener('ended', listener);

    if (!context) {
      context = new AudioContext();
    }
    if (!processor) {
      processor = context.createScriptProcessor(0, 1, 1);
    }
    recorder._in = context.createMediaStreamSource(recorder.stream);

    recorder._da = [];

    recorder._wo.postMessage([0, context.sampleRate]);
    processor.onaudioprocess = function (e) {
      if (recorder.state === 'recording') {
        let buffer = e.inputBuffer.getChannelData(0).buffer;
        recorder._wo.postMessage([1, buffer], [buffer]);
      }
    }

    recorder._in.connect(processor);
    processor.connect(context.destination);

    recorder._raise('start');

    if (timeslice) {
      recorder._si = setInterval(() => {
        if (recorder.state === 'recording') {
          recorder._raiseDataAvailable();
        }
      }, timeslice);
    }
  }

  stop() {
    let recorder = this;

    if (recorder.state === 'inactive') {
      return recorder._raiseError();
    }

    recorder.state = 'inactive';

    recorder._in.disconnect();
    if (recorder._si) {
      clearInterval(recorder._si);
      recorder._si = null;
    }

    recorder.stream.removeEventListener('ended', recorder._li);

    recorder._wo.postMessage([2]);
  }

  pause() {
    let recorder = this;
    if (recorder.state === 'inactive') {
      return recorder._raiseError();
    }
    recorder.state = 'paused';
    recorder._raise('pause');
  }

  resume() {
    let recorder = this;
    if (recorder.state === 'inactive') {
      return recorder._raiseError();
    }
    recorder.state = 'recording';
    recorder._raise('resume');
  }

  requestData() {
    let recorder = this;
    if (recorder.state !== 'recording') {
      return recorder._raiseError();
    }
    recorder._raiseDataAvailable();
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
    e.data = new Blob(recorder._da, {type: recorder.mimeType});
    recorder._da = [];
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
