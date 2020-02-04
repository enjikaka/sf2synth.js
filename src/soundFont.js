import Synthesizer from './sound_font_synth.js';

/**
 * @param {File} file
 */
function readFileAsArrayBuffer (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(e.target.result);
    reader.onerror = error => reject(error);

    reader.readAsArrayBuffer(file);
  });
}

/**
 * @param {string} URL
 */
async function fetchResourceAsArrayBuffer (url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Did not get an OK response when fetching resource.');
  }

  const arrayBuffer = await response.arrayBuffer();

  return arrayBuffer;
}

const waitForReference = ref => new Promise(resolve => {
  const iid = setInterval(() => {
    if (ref !== undefined) {
      clearInterval(iid);
      resolve();
    }
  }, 16);
});

export default class SoundFont {
  constructor () {
    this.synth = undefined;
    this._channel = 0;
    this._bankIndex = 0;
    this._programIndex = 0;
  }

  set channel (channel) {
    this._channel = channel;
  }

  /**
   *
   * @param {File} file
   */
  async loadSoundFontFromFile (file) {
    const arrayBuffer = await readFileAsArrayBuffer(url);

    this.bootSynth(arrayBuffer);
  }

  /**
   *
   * @param {string} url
   */
  async loadSoundFontFromURL (url) {
    const arrayBuffer = await fetchResourceAsArrayBuffer(url);

    this.bootSynth(arrayBuffer);
  }

  set bank (index) {
    this._bankIndex = index;

    this.synth.bankChange(this._channel, index);
  }

  get banks () {
    return Object.keys(this.synth.programSet).map(bankIndex => ({
      bankIndex,
      bankName:  ('000' + parseInt(bankIndex, 10)).slice(-3)
    }));
  }

  set program (index) {
    this._programIndex = index;

    this.synth.programChange(this._channel, index);
  }

  get programs () {
    const { programSet } = this.synth;

    return Object.keys(programSet[this._bankIndex]).map(programIndex => ({
      programIndex,
      programName: ('000' + (parseInt(programIndex) + 1)).slice(-3) + ':' + programSet[this._bankIndex][programIndex]
    }));
  }

  /**
   * @param {ArrayBuffer} arrayBuffer
   */
  async bootSynth (arrayBuffer) {
    const input = new Uint8Array(arrayBuffer);

    if (this.synth) {
      this.synth.refreshInstruments(input);
    } else {
      this.synth = new Synthesizer(input);

      this.synth.init();
      this.synth.start();

      await waitForReference(this.synth.programSet);

      console.log(this.synth);
      console.log(this.banks);
      console.log(this.programs);
    }
  }

  /**
   *
   * @param {number} midiNumber
   */
  noteOn (midiNumber) {
    const volume = 127;

    this.synth.noteOn(this._channel, midiNumber, volume);
  }

  /**
   *
   * @param {number} midiNumber
   */
  noteOff (midiNumber) {
    const volume = 127;

    this.synth.noteOff(this._channel, midiNumber, volume);
  }
}
