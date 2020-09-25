(function($, window) {$(function() {
  'use strict';

  var recorder, recordedData;

  var settings = {
    maxSize: (0.5 * 1024 - 128) * 1024 // 0.5 MB - 128 KB
  };

  var now = function() {
    return (new Date()).getTime();
  };

  var startRecorder = function() {
    if (recorder && recorder.state !== 'recording') {
      recorder.start(1000);
      return true;
    }
  }

  var stopRecorder = function() {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      var track = recorder.stream.getTracks()[0];
      track.stop();
      track.dispatchEvent(new Event('ended'));
    }
  };

  var setProgress = function($progress, time, size) {
    $progress.text('Recording... ' + time + 's ' + size + 'B');
  };

  var enableRecording = function() {
    var $item = $('#item');
    var $content = $('<div></div>');
    var $button = $('<a href="#" class="button"></a>').text('Record').appendTo($content);
    var initializingRecorder, recorderInitialized, size, blobs, $progress, $audio, startedAt;

    $button.click(function(e) {
      e.preventDefault();
      if (initializingRecorder) return;
      if (!recorderInitialized) {
        initializingRecorder = true;
        navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) {
          stream.getTracks()[0].onended = function() {
            recorderInitialized = false;
          };
          recorder = new MediaRecorder(stream);
          recorder.onstart = function() {
            if ($audio) {
              $audio.remove();
              $audio = null;
            }
            $progress = $('<div class="progress"></div>').insertAfter($button);
            setProgress($progress, 0, 0);
            $button.addClass('stop').text('Stop');
            size = 0;
            blobs = [];
            startedAt = now();
          };
          recorder.ondataavailable = function(e) {
            var data = e.data;
            console.log(recorder.state !== 'inactive' ? 'encoded' : 'finalized', data.size);
            var newSize = size + data.size;
            if (newSize > settings.maxSize && recorder.state !== 'inactive') {
              stopRecorder();
            }
            else {
              blobs.push(data);
              size = newSize;
              setProgress($progress, Math.round((now() - startedAt) / 1000), size);
            }
          };
          recorder.onstop = function() {
            $progress.remove();
            $button.removeClass('stop');
            recordedData = new Blob(blobs, {type: 'audio/mpeg'});
            if (recordedData.size > 0) {
              $audio = $('<audio controls></audio>').prop('src', URL.createObjectURL(recordedData)).insertAfter($button);
              $button.text('Re-record');
            }
            else {
              recordedData = null;
              $button.text('Record');
            }
          };
          recorderInitialized = true;
          startRecorder();
        }).catch(function(e) {
          console.log('Please allow access to your microphone to start recording.');
          throw e;
        }).finally(function() {
          initializingRecorder = false;
        });
      }
      else {
        startRecorder() || stopRecorder();
      }
    });

    $item.append($content).show();
  };

  if (window.MediaRecorder && !window.MediaRecorder.notSupported) {
    enableRecording();
  }

})})(jQuery, window);
