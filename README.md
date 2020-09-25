# MP3 MediaRecorder Polyfill

A MediaRecorder polyfill (for Safari) with MP3 (audio/mpeg) encoding support

## Supports
#### Constructor
MediaRecorder()

#### Properties
mimeType<br>
ondataavailable<br>
onerror<br>
onpause<br>
onresume<br>
onstart<br>
onstop<br>
state<br>
stream<br>

#### Methods
isTypeSupported()<br>
pause()<br>
requestData()<br>
resume()<br>
start()<br>
stop()<br>

#### Events
dataavailable<br>
error<br>
pause<br>
resume<br>
start<br>
stop<br>



## Usage

```
<script>
if (!window.MediaRecorder) {
  document.write(decodeURI('%3Cscript defer src="/path/to/dist/polyfill.js">%3C/script>'));
}
</script>
```

## Based on
https://github.com/ai/audio-recorder-polyfill<br>
https://github.com/zhuker/lamejs
