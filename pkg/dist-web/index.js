import Reverb from '@logue/reverb';

/**
 * SynthesizerNote Class
 * @private
 */
class SynthesizerNote {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} destination
   * @param {{
   *   channel: number,
   *   key: number,
   *   sample: Uint8Array,
   *   basePlaybackRate: number,
   *   loopStart: number,
   *   loopEnd: number,
   *   volume: number,
   *   panpot: number
   * }} instrument
   */
  constructor(ctx, destination, instrument) {
    /** @type {AudioContext} */
    this.ctx = ctx;
    /** @type {AudioNode} */

    this.destination = destination;
    /** @type {{
     *   channel: number,
     *   key: number,
     *   sample: Uint8Array,
     *   basePlaybackRate: number,
     *   loopStart: number,
     *   loopEnd: number,
     *   volume: number,
     *   panpot: number
     * }}
     */

    this.instrument = instrument;
    /** @type {number} */

    this.channel = instrument['channel'];
    /** @type {number} */

    this.key = instrument['key'];
    /** @type {number} */

    this.velocity = instrument['velocity'];
    /** @type {Int16Array} */

    this.buffer = instrument['sample'];
    /** @type {number} */

    this.playbackRate = instrument['basePlaybackRate'];
    /** @type {number} */

    this.loopStart = instrument['loopStart'];
    /** @type {number} */

    this.loopEnd = instrument['loopEnd'];
    /** @type {number} */

    this.sampleRate = instrument['sampleRate'];
    /** @type {number} */

    this.volume = instrument['volume'];
    /** @type {number} */

    this.panpot = instrument['panpot'];
    /** @type {number} */

    this.pitchBend = instrument['pitchBend'];
    /** @type {number} */

    this.pitchBendSensitivity = instrument['pitchBendSensitivity'];
    /** @type {number} */

    this.modEnvToPitch = instrument['modEnvToPitch'];
    /** @type {number} */

    this.expression = instrument['expression'];
    /** @type {number} */

    this.cutOffFrequency = instrument['cutOffFrequency'];
    /** @type {number} */

    this.hermonicContent = instrument['hermonicContent'];
    /** @type {Reverb} */

    this.reverb = instrument['reverb']; // state

    /** @type {number} */

    this.startTime = ctx.currentTime;
    /** @type {number} */

    this.computedPlaybackRate = this.playbackRate | 0;
    /** @type {boolean} */

    this.noteOffState = false; // ---------------------------------------------------------------------------
    // audio node
    // ---------------------------------------------------------------------------

    /** @type {AudioBuffer} */

    this.audioBuffer;
    /** @type {AudioBufferSourceNode} */

    this.bufferSource = ctx.createBufferSource();
    /** @type {StereoPannerNode} */

    this.panner = ctx.createPanner();
    /** @type {GainNode} */

    this.outputGainNode = ctx.createGain();
    /** @type {GainNode} */

    this.expressionGainNode = ctx.createGain();
    /** @type {BiquadFilterNode} */

    this.filter = ctx.createBiquadFilter();
    /** @type {BiquadFilterNode} */

    this.modulator = ctx.createBiquadFilter();
  }
  /**
   */


  noteOn() {
    /** @type {AudioContext} */
    const ctx = this.ctx;
    /** @type {{
     *   channel: number,
     *   key: number,
     *   sample: Uint8Array,
     *   basePlaybackRate: number,
     *   loopStart: number,
     *   loopEnd: number,
     *   volume: number,
     *   panpot: number
     * }} */

    const instrument = this.instrument; // console.log(instrument);

    /** @type {number} */

    const now = this.ctx.currentTime || 0;
    /** @type {number} */

    const volDelay = now + instrument['volDelay'];
    /** @type {number} */

    const modDelay = now + instrument['modDelay'];
    /** @type {number} */

    const volAttack = volDelay + instrument['volAttack'];
    /** @type {number} */

    const modAttack = volDelay + instrument['modAttack'];
    /** @type {number} */

    const volHold = volAttack + instrument['volHold'];
    /** @type {number} */

    const modHold = modAttack + instrument['modHold'];
    /** @type {number} */

    const volDecay = volHold + instrument['volDecay'];
    /** @type {number} */

    const modDecay = modHold + instrument['modDecay'];
    /** @type {number} */

    const loopStart = instrument['loopStart'] / this.sampleRate;
    /** @type {number} */

    const loopEnd = instrument['loopEnd'] / this.sampleRate;
    /** @type {number} */

    const startTime = instrument['start'] / this.sampleRate; // TODO: ドラムパートのPanが変化した場合、その計算をしなければならない
    // http://cpansearch.perl.org/src/PJB/MIDI-SoundFont-1.08/doc/sfspec21.html#8.4.6

    /** @type {number} */

    const pan = instrument['pan'] !== void 0 ? instrument['pan'] : this.panpot;
    const sample = this.buffer.subarray(0, this.buffer.length + instrument['end']);
    /** @type {AudioBuffer} */

    const buffer = this.audioBuffer = ctx.createBuffer(1, sample.length, this.sampleRate);
    /** @type {Float32Array} */

    const channelData = buffer.getChannelData(0);
    channelData.set(sample); // buffer source

    /** @type {AudioBufferSourceNode} */

    const bufferSource = this.bufferSource;
    bufferSource.buffer = buffer;
    bufferSource.loop = instrument['sampleModes'] | 0 || 0;
    bufferSource.loopStart = loopStart;
    bufferSource.loopEnd = loopEnd;
    this.updatePitchBend(this.pitchBend); // Output

    /** @type {GainNode} */

    const output = this.outputGainNode; // expression

    this.expressionGainNode.gain.value = this.expression / 127; // panpot

    /** @type {StereoPannerNode} */

    const panner = this.panner;
    panner.panningModel = 'equalpower'; // panner.distanceModel = 'inverse';

    panner.setPosition(Math.sin(pan * Math.PI / 2), 0, Math.cos(pan * Math.PI / 2)); // ---------------------------------------------------------------------------
    // Delay, Attack, Hold, Decay, Sustain
    // ---------------------------------------------------------------------------

    /** @type {number} */

    let volume = this.volume * (this.velocity / 127) * (1 - instrument['initialAttenuation'] / 1000);

    if (volume < 0) {
      volume = 0;
    } // volume envelope

    /** @type {AudioNode} */


    const outputGain = output.gain;
    outputGain.setValueAtTime(0, now);
    outputGain.setValueAtTime(0, volDelay);
    outputGain.setTargetAtTime(volume, volDelay, instrument['volAttack']);
    outputGain.setValueAtTime(volume, volHold);
    outputGain.linearRampToValueAtTime(volume * (1 - instrument['volSustain']), volDecay); // modulation envelope

    /** @type {number} */

    const baseFreq = this.amountToFreq(instrument['initialFilterFc']);
    /** @type {number} */

    const peekFreq = this.amountToFreq(instrument['initialFilterFc'] + instrument['modEnvToFilterFc']);
    /** @type {number} */

    const sustainFreq = baseFreq + (peekFreq - baseFreq) * (1 - instrument['modSustain']);
    /** @type {BiquadFilterNode} */

    const modulator = this.modulator;
    modulator.Q.setValueAtTime(10 ** (instrument['initialFilterQ'] / 200), now);
    modulator.frequency.value = baseFreq;
    modulator.type = 'lowpass';
    modulator.frequency.setTargetAtTime(baseFreq / 127, this.ctx.currentTime, 0.5);
    modulator.frequency.setValueAtTime(baseFreq, now);
    modulator.frequency.setValueAtTime(baseFreq, modDelay);
    modulator.frequency.setTargetAtTime(peekFreq, modDelay, parseFloat(instrument['modAttack'] + 1)); // For FireFox fix

    modulator.frequency.setValueAtTime(peekFreq, modHold);
    modulator.frequency.linearRampToValueAtTime(sustainFreq, modDecay); // connect

    bufferSource.connect(modulator);
    modulator.connect(panner);
    panner.connect(this.expressionGainNode);
    this.expressionGainNode.connect(output);

    if (!instrument['mute']) {
      this.connect();
    } // fire


    bufferSource.start(0, startTime);
  }
  /**
   * @param {number} val
   * @return {number}
   */


  amountToFreq(val) {
    return 2 ** ((val - 6900) / 1200) * 440;
  }
  /**
   */


  noteOff() {
    this.noteOffState = true;
  }
  /**
   * @return {boolean}
   */


  isNoteOff() {
    return this.noteOffState;
  }
  /**
   * @return {void}
   */


  release() {
    /** @type {{
     *   channel: number,
     *   key: number,
     *   sample: Uint8Array,
     *   basePlaybackRate: number,
     *   loopStart: number,
     *   loopEnd: number,
     *   volume: number,
     *   panpot: number
     * }} */
    const instrument = this.instrument;
    /** @type {AudioBufferSourceNode} */

    const bufferSource = this.bufferSource;
    /** @type {GainNode} */

    const output = this.outputGainNode;
    /** @type {number} */

    const now = this.ctx.currentTime;
    const release = instrument['releaseTime'] - 64; // ---------------------------------------------------------------------------
    // volume release time
    // ---------------------------------------------------------------------------

    /** @type {number} */

    const volEndTimeTmp = instrument['volRelease'] * output.gain.value;
    /** @type {number} */

    const volEndTime = now + volEndTimeTmp * (1 + release / (release < 0 ? 64 : 63)); // var volEndTime = now + instrument['volRelease'] * (1 - instrument['volSustain']);
    // ---------------------------------------------------------------------------
    // modulation release time
    // ---------------------------------------------------------------------------

    /** @type {BiquadFilterNode} */

    const modulator = this.modulator;
    /** @type {number} */

    const baseFreq = this.amountToFreq(instrument['initialFilterFc']);
    /** @type {number} */

    const peekFreq = this.amountToFreq(instrument['initialFilterFc'] + instrument['modEnvToFilterFc']);
    /** @type {number} */

    const modEndTime = now + instrument['modRelease'] * (baseFreq === peekFreq ? 1 : (modulator.frequency.value - baseFreq) / (peekFreq - baseFreq)); // var modEndTime = now + instrument['modRelease'] * (1 - instrument['modSustain']);

    if (!this.audioBuffer) {
      return;
    } // ---------------------------------------------------------------------------
    // Release
    // ---------------------------------------------------------------------------


    switch (instrument['sampleModes']) {
      case 0:
        // ループしない
        bufferSource.loop = false;
        bufferSource.disconnect();
        bufferSource.buffer = null;
        break;

      case 1:
        // ループさせる
        output.gain.cancelScheduledValues(0);
        output.gain.setValueAtTime(output.gain.value, now);
        output.gain.linearRampToValueAtTime(0, volEndTime);
        modulator.frequency.cancelScheduledValues(0);
        modulator.frequency.setValueAtTime(modulator.frequency.value, now);
        modulator.frequency.linearRampToValueAtTime(baseFreq, modEndTime);
        bufferSource.playbackRate.cancelScheduledValues(0);
        bufferSource.playbackRate.setValueAtTime(bufferSource.playbackRate.value, now);
        bufferSource.playbackRate.linearRampToValueAtTime(this.computedPlaybackRate, modEndTime);
        bufferSource.stop(volEndTime);
        break;

      case 2:
        // 未定義
        console.error('detect unused sampleModes');
        break;

      case 3:
        // ノートオフまでループさせる
        output.gain.cancelScheduledValues(0);
        output.gain.setValueAtTime(output.gain.value, now);
        output.gain.linearRampToValueAtTime(0, volEndTime);
        modulator.frequency.cancelScheduledValues(0);
        modulator.frequency.setValueAtTime(modulator.frequency.value, now);
        modulator.frequency.linearRampToValueAtTime(baseFreq, modEndTime);
        bufferSource.playbackRate.cancelScheduledValues(0);
        bufferSource.playbackRate.setValueAtTime(bufferSource.playbackRate.value, now);
        bufferSource.playbackRate.linearRampToValueAtTime(this.computedPlaybackRate, modEndTime);

      default:
        bufferSource.loop = false;
        break;
    }
  }
  /**
   */


  connect() {
    this.reverb.connect(this.outputGainNode).connect(this.destination);
  }
  /**
   */


  disconnect() {
    this.outputGainNode.disconnect(0);
  }
  /**
   */


  schedulePlaybackRate() {
    const playbackRate = this.bufferSource.playbackRate;
    /** @type {number} */

    const computed = this.computedPlaybackRate;
    /** @type {number} */

    const start = this.startTime;
    /** @type {Object} */

    const instrument = this.instrument;
    /** @type {number} */

    const modAttack = start + instrument['modAttack'];
    /** @type {number} */

    const modDecay = modAttack + instrument['modDecay'];
    /** @type {number} */

    const peekPitch = computed * 1.0594630943592953 // Math.pow(2, 1 / 12)
    ** (this.modEnvToPitch * this.instrument['scaleTuning']);
    playbackRate.cancelScheduledValues(0);
    playbackRate.setValueAtTime(computed, start);
    playbackRate.linearRampToValueAtTime(peekPitch, modAttack);
    playbackRate.linearRampToValueAtTime(computed + (peekPitch - computed) * (1 - instrument['modSustain']), modDecay);
  }
  /**
   * @param {number} expression
   */


  updateExpression(expression) {
    this.expressionGainNode.gain.value = (this.expression = expression) / 127;
  }
  /**
   * @param {number} pitchBend
   */


  updatePitchBend(pitchBend) {
    this.computedPlaybackRate = this.playbackRate * 1.0594630943592953 // Math.pow(2, 1 / 12)
    ** (pitchBend / (pitchBend < 0 ? 8192 : 8191) * this.pitchBendSensitivity * this.instrument['scaleTuning']);
    this.schedulePlaybackRate();
  }

}

/**
 * Riff Parser class
 * @private
 */
class Riff {
  /**
   * @param {ByteArray} input input buffer.
   * @param {Object=} optParams option parameters.
   */
  constructor(input, optParams = {}) {
    /** @type {ByteArray} */
    this.input = input;
    /** @type {number} */

    this.ip = optParams.index || 0;
    /** @type {number} */

    this.length = optParams.length || input.length - this.ip;
    /** @type {Array.<RiffChunk>} */

    this.chunkList;
    /** @type {number} */

    this.offset = this.ip;
    /** @type {boolean} */

    this.padding = optParams.padding !== void 0 ? optParams.padding : true;
    /** @type {boolean} */

    this.bigEndian = optParams.bigEndian !== void 0 ? optParams.bigEndian : false;
  }
  /**
   */


  parse() {
    /** @type {number} */
    const length = this.length + this.offset;
    this.chunkList = [];

    while (this.ip < length) {
      this.parseChunk();
    }
  }
  /**
   */


  parseChunk() {
    /** @type {ByteArray} */
    const input = this.input;
    /** @type {number} */

    let ip = this.ip;
    /** @type {number} */

    let size;
    this.chunkList.push(new RiffChunk(String.fromCharCode(input[ip++], input[ip++], input[ip++], input[ip++]), size = this.bigEndian ? (input[ip++] << 24 | input[ip++] << 16 | input[ip++] << 8 | input[ip++]) >>> 0 : (input[ip++] | input[ip++] << 8 | input[ip++] << 16 | input[ip++] << 24) >>> 0, ip));
    ip += size; // padding

    if (this.padding && (ip - this.offset & 1) === 1) {
      ip++;
    }

    this.ip = ip;
  }
  /**
   * @param {number} index chunk index.
   * @return {?RiffChunk}
   */


  getChunk(index) {
    /** @type {RiffChunk} */
    const chunk = this.chunkList[index];

    if (chunk === void 0) {
      return null;
    }

    return chunk;
  }
  /**
   * @return {number}
   */


  getNumberOfChunks() {
    return this.chunkList.length;
  }

}
/**
 * Riff Chunk Structure
 * @interface
 */

class RiffChunk {
  /**
   * @param {string} type
   * @param {number} size
   * @param {number} offset
   */
  constructor(type, size, offset) {
    /** @type {string} */
    this.type = type;
    /** @type {number} */

    this.size = size;
    /** @type {number} */

    this.offset = offset;
  }

}

/**
 * SoundFont Parser Class
 */

class Parser {
  /**
   * @param {ByteArray} input
   * @param {Object=} optParams
   */
  constructor(input, optParams = {}) {
    /** @type {ByteArray} */
    this.input = input;
    /** @type {(Object|undefined)} */

    this.parserOption = optParams.parserOption || {};
    /** @type {(Number|undefined)} */

    this.sampleRate = optParams.sampleRate || 22050; // よくわからんが、OSで指定されているサンプルレートを入れないと音が切れ切れになる。

    /** @type {Array.<Object>} */

    this.presetHeader;
    /** @type {Array.<Object>} */

    this.presetZone;
    /** @type {Array.<Object>} */

    this.presetZoneModulator;
    /** @type {Array.<Object>} */

    this.presetZoneGenerator;
    /** @type {Array.<Object>} */

    this.instrument;
    /** @type {Array.<Object>} */

    this.instrumentZone;
    /** @type {Array.<Object>} */

    this.instrumentZoneModulator;
    /** @type {Array.<Object>} */

    this.instrumentZoneGenerator;
    /** @type {Array.<Object>} */

    this.sampleHeader;
    /**
     * @type {Array.<string>}
     * @const
     */

    this.GeneratorEnumeratorTable = ['startAddrsOffset', 'endAddrsOffset', 'startloopAddrsOffset', 'endloopAddrsOffset', 'startAddrsCoarseOffset', 'modLfoToPitch', 'vibLfoToPitch', 'modEnvToPitch', 'initialFilterFc', 'initialFilterQ', 'modLfoToFilterFc', 'modEnvToFilterFc', 'endAddrsCoarseOffset', 'modLfoToVolume',, // 14
    'chorusEffectsSend', 'reverbEffectsSend', 'pan',,,, // 18,19,20
    'delayModLFO', 'freqModLFO', 'delayVibLFO', 'freqVibLFO', 'delayModEnv', 'attackModEnv', 'holdModEnv', 'decayModEnv', 'sustainModEnv', 'releaseModEnv', 'keynumToModEnvHold', 'keynumToModEnvDecay', 'delayVolEnv', 'attackVolEnv', 'holdVolEnv', 'decayVolEnv', 'sustainVolEnv', 'releaseVolEnv', 'keynumToVolEnvHold', 'keynumToVolEnvDecay', 'instrument',, // 42
    'keyRange', 'velRange', 'startloopAddrsCoarseOffset', 'keynum', 'velocity', 'initialAttenuation',, // 49
    'endloopAddrsCoarseOffset', 'coarseTune', 'fineTune', 'sampleID', 'sampleModes',, // 55
    'scaleTuning', 'exclusiveClass', 'overridingRootKey', // 59
    'endOper'];
  }
  /** @export */


  parse() {
    /** @type {Riff} */
    const parser = new Riff(this.input, this.parserOption); // parse RIFF chunk

    parser.parse();

    if (parser.chunkList.length !== 1) {
      throw new Error('wrong chunk length');
    }
    /** @type {?RiffChunk} */


    const chunk = parser.getChunk(0);

    if (chunk === null) {
      throw new Error('chunk not found');
    }

    this.parseRiffChunk(chunk); // console.log(this.sampleHeader);

    this.input = null;
  }
  /**
   * @param {RiffChunk} chunk
   */


  parseRiffChunk(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset; // check parse target

    if (chunk.type !== 'RIFF') {
      throw new Error('invalid chunk type:' + chunk.type);
    } // check signature

    /** @type {string} */


    const signature = String.fromCharCode(data[ip++], data[ip++], data[ip++], data[ip++]);

    if (signature !== 'sfbk') {
      throw new Error('invalid signature:' + signature);
    } // read structure

    /** @type {Riff} */


    const parser = new Riff(data, {
      'index': ip,
      'length': chunk.size - 4
    });
    parser.parse();

    if (parser.getNumberOfChunks() !== 3) {
      throw new Error('invalid sfbk structure');
    } // INFO-list


    this.parseInfoList(
    /** @type {!RiffChunk} */
    parser.getChunk(0)); // sdta-list

    this.parseSdtaList(
    /** @type {!RiffChunk} */
    parser.getChunk(1)); // pdta-list

    this.parsePdtaList(
    /** @type {!RiffChunk} */
    parser.getChunk(2));
  }

  /**
   * @param {RiffChunk} chunk
   */
  parseInfoList(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset; // check parse target

    if (chunk.type !== 'LIST') {
      throw new Error('invalid chunk type:' + chunk.type);
    } // check signature

    /** @type {string} */


    const signature = String.fromCharCode(data[ip++], data[ip++], data[ip++], data[ip++]);

    if (signature !== 'INFO') {
      throw new Error('invalid signature:' + signature);
    } // read structure

    /** @type {Riff} */


    const parser = new Riff(data, {
      'index': ip,
      'length': chunk.size - 4
    });
    parser.parse();
  }

  /**
   * @param {RiffChunk} chunk
   */
  parseSdtaList(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset; // check parse target

    if (chunk.type !== 'LIST') {
      throw new Error('invalid chunk type:' + chunk.type);
    } // check signature

    /** @type {string} */


    const signature = String.fromCharCode(data[ip++], data[ip++], data[ip++], data[ip++]);

    if (signature !== 'sdta') {
      throw new Error('invalid signature:' + signature);
    } // read structure

    /** @type {Riff} */


    const parser = new Riff(data, {
      'index': ip,
      'length': chunk.size - 4
    });
    parser.parse();

    if (parser.chunkList.length !== 1) {
      throw new Error('TODO');
    }

    this.samplingData =
    /** @type {{type: string, size: number, offset: number}} */
    parser.getChunk(0);
  }

  /**
   * @param {RiffChunk} chunk
   */
  parsePdtaList(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset; // check parse target

    if (chunk.type !== 'LIST') {
      throw new Error('invalid chunk type:' + chunk.type);
    } // check signature

    /** @type {string} */


    const signature = String.fromCharCode(data[ip++], data[ip++], data[ip++], data[ip++]);

    if (signature !== 'pdta') {
      throw new Error('invalid signature:' + signature);
    } // read structure

    /** @type {Riff} */


    const parser = new Riff(data, {
      'index': ip,
      'length': chunk.size - 4
    });
    parser.parse(); // check number of chunks

    if (parser.getNumberOfChunks() !== 9) {
      throw new Error('invalid pdta chunk');
    }

    this.parsePhdr(
    /** @type {RiffChunk} */
    parser.getChunk(0));
    this.parsePbag(
    /** @type {RiffChunk} */
    parser.getChunk(1));
    this.parsePmod(
    /** @type {RiffChunk} */
    parser.getChunk(2));
    this.parsePgen(
    /** @type {RiffChunk} */
    parser.getChunk(3));
    this.parseInst(
    /** @type {RiffChunk} */
    parser.getChunk(4));
    this.parseIbag(
    /** @type {RiffChunk} */
    parser.getChunk(5));
    this.parseImod(
    /** @type {RiffChunk} */
    parser.getChunk(6));
    this.parseIgen(
    /** @type {RiffChunk} */
    parser.getChunk(7));
    this.parseShdr(
    /** @type {RiffChunk} */
    parser.getChunk(8));
  }

  /**
   * @param {RiffChunk} chunk
   */
  parsePhdr(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset;
    /** @type {Array.<Object>} */

    const presetHeader = this.presetHeader = [];
    /** @type {number} */

    const size = chunk.offset + chunk.size; // check parse target

    if (chunk.type !== 'phdr') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    while (ip < size) {
      presetHeader.push({
        presetName: String.fromCharCode.apply(null, data.subarray(ip, ip += 20)),
        preset: data[ip++] | data[ip++] << 8,
        bank: data[ip++] | data[ip++] << 8,
        presetBagIndex: data[ip++] | data[ip++] << 8,
        library: (data[ip++] | data[ip++] << 8 | data[ip++] << 16 | data[ip++] << 24) >>> 0,
        genre: (data[ip++] | data[ip++] << 8 | data[ip++] << 16 | data[ip++] << 24) >>> 0,
        morphology: (data[ip++] | data[ip++] << 8 | data[ip++] << 16 | data[ip++] << 24) >>> 0
      });
    }
  }

  /**
   * @param {RiffChunk} chunk
   */
  parsePbag(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset;
    /** @type {Array.<Object>} */

    const presetZone = this.presetZone = [];
    /** @type {number} */

    const size = chunk.offset + chunk.size; // check parse target

    if (chunk.type !== 'pbag') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    while (ip < size) {
      presetZone.push({
        presetGeneratorIndex: data[ip++] | data[ip++] << 8,
        presetModulatorIndex: data[ip++] | data[ip++] << 8
      });
    }
  }

  /**
   * @param {RiffChunk} chunk
   */
  parsePmod(chunk) {
    // check parse target
    if (chunk.type !== 'pmod') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    this.presetZoneModulator = this.parseModulator(chunk);
  }

  /**
   * @param {RiffChunk} chunk
   */
  parsePgen(chunk) {
    // check parse target
    if (chunk.type !== 'pgen') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    this.presetZoneGenerator = this.parseGenerator(chunk);
  }

  /**
   * @param {RiffChunk} chunk
   */
  parseInst(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset;
    /** @type {Array.<Object>} */

    const instrument = this.instrument = [];
    /** @type {number} */

    const size = chunk.offset + chunk.size; // check parse target

    if (chunk.type !== 'inst') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    while (ip < size) {
      instrument.push({
        instrumentName: String.fromCharCode.apply(null, data.subarray(ip, ip += 20)),
        instrumentBagIndex: data[ip++] | data[ip++] << 8
      });
    }
  }

  /**
   * @param {RiffChunk} chunk
   */
  parseIbag(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset;
    /** @type {Array.<Object>} */

    const instrumentZone = this.instrumentZone = [];
    /** @type {number} */

    const size = chunk.offset + chunk.size; // check parse target

    if (chunk.type !== 'ibag') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    while (ip < size) {
      instrumentZone.push({
        instrumentGeneratorIndex: data[ip++] | data[ip++] << 8,
        instrumentModulatorIndex: data[ip++] | data[ip++] << 8
      });
    }
  }

  /**
   * @param {RiffChunk} chunk
   */
  parseImod(chunk) {
    // check parse target
    if (chunk.type !== 'imod') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    this.instrumentZoneModulator = this.parseModulator(chunk);
  }

  /**
   * @param {RiffChunk} chunk
   */
  parseIgen(chunk) {
    // check parse target
    if (chunk.type !== 'igen') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    this.instrumentZoneGenerator = this.parseGenerator(chunk);
  }

  /**
   * @param {RiffChunk} chunk
   */
  parseShdr(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset;
    /** @type {Array.<Object>} */

    const samples = this.sample = [];
    /** @type {Array.<Object>} */

    const sampleHeader = this.sampleHeader = [];
    /** @type {number} */

    const size = chunk.offset + chunk.size;
    /** @type {string} */

    let sampleName;
    /** @type {number} */

    let start;
    /** @type {number} */

    let end;
    /** @type {number} */

    let startLoop;
    /** @type {number} */

    let endLoop;
    /** @type {number} */

    let sampleRate;
    /** @type {number} */

    let originalPitch;
    /** @type {number} */

    let pitchCorrection;
    /** @type {number} */

    let sampleLink;
    /** @type {number} */

    let sampleType; // check parse target

    if (chunk.type !== 'shdr') {
      throw new Error('invalid chunk type:' + chunk.type);
    }

    while (ip < size) {
      sampleName = String.fromCharCode.apply(null, data.subarray(ip, ip += 20));
      start = (data[ip++] << 0 | data[ip++] << 8 | data[ip++] << 16 | data[ip++] << 24) >>> 0;
      end = (data[ip++] << 0 | data[ip++] << 8 | data[ip++] << 16 | data[ip++] << 24) >>> 0;
      startLoop = (data[ip++] << 0 | data[ip++] << 8 | data[ip++] << 16 | data[ip++] << 24) >>> 0;
      endLoop = (data[ip++] << 0 | data[ip++] << 8 | data[ip++] << 16 | data[ip++] << 24) >>> 0;
      sampleRate = (data[ip++] << 0 | data[ip++] << 8 | data[ip++] << 16 | data[ip++] << 24) >>> 0;
      originalPitch = data[ip++];
      pitchCorrection = data[ip++] << 24 >> 24;
      sampleLink = data[ip++] | data[ip++] << 8;
      sampleType = data[ip++] | data[ip++] << 8;
      let sample = new Int16Array(new Uint8Array(data.subarray(this.samplingData.offset + start * 2, this.samplingData.offset + end * 2)).buffer);
      startLoop -= start;
      endLoop -= start;

      if (sampleRate > 0) {
        const adjust = this.adjustSampleData(sample, sampleRate);
        sample = adjust.sample;
        sampleRate *= adjust.multiply;
        startLoop *= adjust.multiply;
        endLoop *= adjust.multiply;
      }

      samples.push(sample);
      sampleHeader.push({
        sampleName: sampleName,
        start: start,
        end: end,
        startLoop: startLoop,
        endLoop: endLoop,
        sampleRate: sampleRate,
        originalPitch: originalPitch,
        pitchCorrection: pitchCorrection,
        sampleLink: sampleLink,
        sampleType: sampleType
      });
    }
  }

  /**
   * @param {Array} sample
   * @param {number} sampleRate
   * @return {object}
   */
  adjustSampleData(sample, sampleRate) {
    /** @type {Int16Array} */
    let newSample;
    /** @type {number} */

    let i;
    /** @type {number} */

    let il;
    /** @type {number} */

    let j;
    /** @type {number} */

    let multiply = 1; // buffer

    while (sampleRate < this.sampleRate) {
      // AudioContextのサンプルレートに変更
      newSample = new Int16Array(sample.length * 2);

      for (i = j = 0, il = sample.length; i < il; ++i) {
        newSample[j++] = sample[i];
        newSample[j++] = sample[i];
      }

      sample = newSample;
      multiply *= 2;
      sampleRate *= 2;
    }

    return {
      sample: sample,
      multiply: multiply
    };
  }

  /**
   * @param {RiffChunk} chunk
   * @return {Array.<Object>}
   */
  parseModulator(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset;
    /** @type {number} */

    const size = chunk.offset + chunk.size;
    /** @type {number} */

    let code;
    /** @type {string} */

    let key;
    /** @type {Array.<Object>} */

    const output = [];

    while (ip < size) {
      // Src  Oper
      // TODO
      ip += 2; // Dest Oper

      code = data[ip++] | data[ip++] << 8;
      key = this.GeneratorEnumeratorTable[code];

      if (key === void 0) {
        // Amount
        output.push({
          type: key,
          value: {
            code: code,
            amount: data[ip] | data[ip + 1] << 8 << 16 >> 16,
            lo: data[ip++],
            hi: data[ip++]
          }
        });
      } else {
        // Amount
        switch (key) {
          case 'keyRange':
          /* FALLTHROUGH */

          case 'velRange':
          /* FALLTHROUGH */

          case 'keynum':
          /* FALLTHROUGH */

          case 'velocity':
            output.push({
              type: key,
              value: {
                lo: data[ip++],
                hi: data[ip++]
              }
            });
            break;

          default:
            output.push({
              type: key,
              value: {
                amount: data[ip++] | data[ip++] << 8 << 16 >> 16
              }
            });
            break;
        }
      } // AmtSrcOper
      // TODO


      ip += 2; // Trans Oper
      // TODO

      ip += 2;
    }

    return output;
  }

  /**
   * @param {RiffChunk} chunk
   * @return {Array.<Object>}
   */
  parseGenerator(chunk) {
    /** @type {ByteArray} */
    const data = this.input;
    /** @type {number} */

    let ip = chunk.offset;
    /** @type {number} */

    const size = chunk.offset + chunk.size;
    /** @type {number} */

    let code;
    /** @type {string} */

    let key;
    /** @type {Array.<Object>} */

    const output = [];

    while (ip < size) {
      code = data[ip++] | data[ip++] << 8;
      key = this.GeneratorEnumeratorTable[code];

      if (key === void 0) {
        output.push({
          type: key,
          value: {
            code: code,
            amount: data[ip] | data[ip + 1] << 8 << 16 >> 16,
            lo: data[ip++],
            hi: data[ip++]
          }
        });
        continue;
      }

      switch (key) {
        case 'keynum':
        /* FALLTHROUGH */

        case 'keyRange':
        /* FALLTHROUGH */

        case 'velRange':
        /* FALLTHROUGH */

        case 'velocity':
          output.push({
            type: key,
            value: {
              lo: data[ip++],
              hi: data[ip++]
            }
          });
          break;

        default:
          output.push({
            type: key,
            value: {
              amount: data[ip++] | data[ip++] << 8 << 16 >> 16
            }
          });
          break;
      }
    }

    return output;
  }

  /**
   * @return {Array.<object>}
   */
  createInstrument() {
    /** @type {Array.<Object>} */
    const instrument = this.instrument;
    /** @type {Array.<Object>} */

    const zone = this.instrumentZone;
    /** @type {Array.<Object>} */

    const output = [];
    /** @type {number} */

    let bagIndex;
    /** @type {number} */

    let bagIndexEnd;
    /** @type {Array.<Object>} */

    let zoneInfo;
    /** @type {{generator: Object, generatorInfo: Array.<Object>}} */

    let instrumentGenerator;
    /** @type {{modulator: Object, modulatorInfo: Array.<Object>}} */

    let instrumentModulator;
    /** @type {number} */

    let i;
    /** @type {number} */

    let il;
    /** @type {number} */

    let j;
    /** @type {number} */

    let jl; // instrument -> instrument bag -> generator / modulator

    for (i = 0, il = instrument.length; i < il; ++i) {
      bagIndex = instrument[i].instrumentBagIndex;
      bagIndexEnd = instrument[i + 1] ? instrument[i + 1].instrumentBagIndex : zone.length;
      zoneInfo = []; // instrument bag

      for (j = bagIndex, jl = bagIndexEnd; j < jl; ++j) {
        instrumentGenerator = this.createInstrumentGenerator_(zone, j);
        instrumentModulator = this.createInstrumentModulator_(zone, j);
        zoneInfo.push({
          generator: instrumentGenerator.generator,
          generatorSequence: instrumentGenerator.generatorInfo,
          modulator: instrumentModulator.modulator,
          modulatorSequence: instrumentModulator.modulatorInfo
        });
      }

      output.push({
        name: instrument[i].instrumentName,
        info: zoneInfo
      });
    }

    return output;
  }

  /**
   * @return {Array.<object>}
   */
  createPreset() {
    /** @type {Array.<Object>} */
    const preset = this.presetHeader;
    /** @type {Array.<Object>} */

    const zone = this.presetZone;
    /** @type {Array.<Object>} */

    const output = [];
    /** @type {number} */

    let bagIndex;
    /** @type {number} */

    let bagIndexEnd;
    /** @type {Array.<Object>} */

    let zoneInfo;
    /** @type {number} */

    let instrument;
    /** @type {{generator: Object, generatorInfo: Array.<Object>}} */

    let presetGenerator;
    /** @type {{modulator: Object, modulatorInfo: Array.<Object>}} */

    let presetModulator;
    /** @type {number} */

    let i;
    /** @type {number} */

    let il;
    /** @type {number} */

    let j;
    /** @type {number} */

    let jl; // preset -> preset bag -> generator / modulator

    for (i = 0, il = preset.length; i < il; ++i) {
      bagIndex = preset[i].presetBagIndex;
      bagIndexEnd = preset[i + 1] ? preset[i + 1].presetBagIndex : zone.length;
      zoneInfo = []; // preset bag

      for (j = bagIndex, jl = bagIndexEnd; j < jl; ++j) {
        presetGenerator = this.createPresetGenerator_(zone, j);
        presetModulator = this.createPresetModulator_(zone, j);
        zoneInfo.push({
          generator: presetGenerator.generator,
          generatorSequence: presetGenerator.generatorInfo,
          modulator: presetModulator.modulator,
          modulatorSequence: presetModulator.modulatorInfo
        });
        instrument = presetGenerator.generator['instrument'] !== void 0 ? presetGenerator.generator['instrument'].amount : presetModulator.modulator['instrument'] !== void 0 ? presetModulator.modulator['instrument'].amount : null;
      }

      output.push({
        name: preset[i].presetName,
        info: zoneInfo,
        header: preset[i],
        instrument: instrument
      });
    }

    return output;
  }

  /**
   * @param {Array.<Object>} zone
   * @param {number} index
   * @return {{generator: Object, generatorInfo: Array.<Object>}}
   * @private
   */
  createInstrumentGenerator_(zone, index) {
    const modgen = this.createBagModGen_(zone, zone[index].instrumentGeneratorIndex, zone[index + 1] ? zone[index + 1].instrumentGeneratorIndex : this.instrumentZoneGenerator.length, this.instrumentZoneGenerator);
    return {
      generator: modgen.modgen,
      generatorInfo: modgen.modgenInfo
    };
  }

  /**
   * @param {Array.<Object>} zone
   * @param {number} index
   * @return {{modulator: Object, modulatorInfo: Array.<Object>}}
   * @private
   */
  createInstrumentModulator_(zone, index) {
    const modgen = this.createBagModGen_(zone, zone[index].presetModulatorIndex, zone[index + 1] ? zone[index + 1].instrumentModulatorIndex : this.instrumentZoneModulator.length, this.instrumentZoneModulator);
    return {
      modulator: modgen.modgen,
      modulatorInfo: modgen.modgenInfo
    };
  }

  /**
   * @param {Array.<Object>} zone
   * @param {number} index
   * @return {{generator: Object, generatorInfo: Array.<Object>}}
   * @private
   */
  createPresetGenerator_(zone, index) {
    const modgen = this.createBagModGen_(zone, zone[index].presetGeneratorIndex, zone[index + 1] ? zone[index + 1].presetGeneratorIndex : this.presetZoneGenerator.length, this.presetZoneGenerator);
    return {
      generator: modgen.modgen,
      generatorInfo: modgen.modgenInfo
    };
  }

  /**
   * @param {Array.<Object>} zone
   * @param {number} index
   * @return {{modulator: Object, modulatorInfo: Array.<Object>}}
   * @private
   */
  createPresetModulator_(zone, index) {
    /** @type {{modgen: Object, modgenInfo: Array.<Object>}} */
    const modgen = this.createBagModGen_(zone, zone[index].presetModulatorIndex, zone[index + 1] ? zone[index + 1].presetModulatorIndex : this.presetZoneModulator.length, this.presetZoneModulator);
    return {
      modulator: modgen.modgen,
      modulatorInfo: modgen.modgenInfo
    };
  }

  /**
   * @param {Array.<Object>} zone
   * @param {number} indexStart
   * @param {number} indexEnd
   * @param {Array} zoneModGen
   * @return {{modgen: Object, modgenInfo: Array.<Object>}}
   * @private
   */
  createBagModGen_(zone, indexStart, indexEnd, zoneModGen) {
    /** @type {Array.<Object>} */
    const modgenInfo = [];
    /** @type {Object} */

    const modgen = {
      'unknown': [],
      'keyRange': {
        hi: 127,
        lo: 0
      }
    }; // TODO

    /** @type {Object} */

    let info;
    /** @type {number} */

    let i;
    /** @type {number} */

    let il;

    for (i = indexStart, il = indexEnd; i < il; ++i) {
      info = zoneModGen[i];
      modgenInfo.push(info);

      if (info.type === 'unknown') {
        modgen.unknown.push(info.value);
      } else {
        modgen[info.type] = info.value;
      }
    }

    return {
      modgen: modgen,
      modgenInfo: modgenInfo
    };
  }

}

/**
 * Synthesizer Class
 * @private
 */

class Synthesizer {
  /**
   * @param {Uint8Array} input
   */
  constructor(input) {
    /** @type {number} */
    let i;
    /** @type {number} */

    let il;
    /** @type {Uint8Array} */

    this.input = input;
    /** @type {SoundFont.Parser} */

    this.parser = {};
    /** @type {number} */

    this.bank = 0;
    /** @type {Array.<Array.<Object>>} */

    this.bankSet = {};
    /** @type {number} */

    this.bufferSize = 2048;
    /** @type {AudioContext} */

    this.ctx = this.getAudioContext();
    /** @type {GainNode} */

    this.gainMaster = this.ctx.createGain();
    /** @type {AudioBufferSourceNode} */

    this.bufSrc = this.ctx.createBufferSource();
    /** @type {Array.<number>} */

    this.channelInstrument = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    /** @type {Array.<number>} */

    this.channelBank = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 127, 0, 0, 0, 0];
    /** @type {Array.<number>} */

    this.channelVolume = [127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127];
    /** @type {Array.<number>} */

    this.channelPanpot = [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64];
    /** @type {Array.<number>} */

    this.channelPitchBend = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    /** @type {Array.<number>} */

    this.channelPitchBendSensitivity = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    /** @type {Array.<number>} */

    this.channelExpression = [127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127];
    /** @type {Array.<number>} */

    this.channelAttack = [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64];
    /** @type {Array.<number>} */

    this.channelDecay = [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64];
    /** @type {Array.<number>} */

    this.channelSustin = [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64];
    /** @type {Array.<number>} */

    this.channelRelease = [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64];
    /** @type {Array.<boolean>} */

    this.channelHold = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
    /** @type {Array.<number>} */

    this.channelHarmonicContent = [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64];
    /** @type {Array.<number>} */

    this.channelCutOffFrequency = [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64];
    /** @type {boolean} */

    this.isGS = false;
    /** @type {boolean} */

    this.isXG = false;
    /** @type {Array.<Array.<string>>} */

    this.programSet = [];
    /** @type {Array.<boolean>} */

    this.channelMute = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
    /** @type {Array.<Array.<SoundFont.SynthesizerNote>>} */

    this.currentNoteOn = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []];
    /** @type {number} @const */

    this.baseVolume = 1 / 0xffff;
    /** @type {number} */

    this.masterVolume = 16384;
    /** @type {Array.<boolean>} */

    this.percussionPart = [false, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false];
    /** @type {Array.<number>} */

    this.percussionVolume = new Array(128);

    for (i = 0, il = this.percussionVolume.length; i < il; ++i) {
      this.percussionVolume[i] = 127;
    }

    this.programSet = {};
    /** @type {Array.<Reverb>}リバーブエフェクト（チャンネル毎に用意する） */

    this.reverb = [];
    /** @type {Array.<BiquadFilterNode>} フィルタ（ビブラートなど） */

    this.filter = [];

    for (i = 0; i < 16; ++i) {
      this.reverb[i] = new Reverb(this.ctx, {
        mix: 0.315
      }); // リバーブエフェクトのデフォルト値は40なので40/127の値をドライ／ウェット値となる
      // フィルタを定義

      this.filter[i] = this.ctx.createBiquadFilter();
    }
  }
  /**
   * @return {AudioContext}
   */


  getAudioContext() {
    /** @type {AudioContext} */
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); // for legacy browsers

    ctx.createGain = ctx.createGain || ctx.createGainNode; // Defreeze AudioContext for iOS.

    const initAudioContext = () => {
      document.removeEventListener('touchstart', initAudioContext); // wake up AudioContext

      const emptySource = ctx.createBufferSource();
      emptySource.start();
      emptySource.stop();
    };

    document.addEventListener('touchstart', initAudioContext);
    return ctx;
  }
  /**
   * System Reset
   * @param {string} mode
   */


  init(mode = 'GM') {
    this.gainMaster.disconnect();
    /** @type {number} */

    let i;
    this.parser = new Parser(this.input, {
      sampleRate: this.ctx.sampleRate
    });
    this.bankSet = this.createAllInstruments();
    this.isXG = false;
    this.isGS = false;

    if (mode == 'XG') {
      this.isXG = true;
    } else if (mode == 'GS') {
      this.isGS = true;
    }

    for (i = 0; i < 16; ++i) {
      this.programChange(i, 0x00);
      this.volumeChange(i, 0x64);
      this.panpotChange(i, 0x40);
      this.pitchBend(i, 0x00, 0x40); // 8192

      this.pitchBendSensitivity(i, 2);
      this.channelHold[i] = false;
      this.channelExpression[i] = 127;
      this.channelBank[i] = i === 9 ? 127 : 0;
      this.attackTime(i, 64);
      this.decayTime(i, 64);
      this.sustinTime(i, 64);
      this.releaseTime(i, 64);
      this.harmonicContent(i, 64);
      this.cutOffFrequency(i, 64);
      this.reverbDepth(i, 40);
      this.updateBankSelect(i);
      this.updateProgramSelect(i);
    }

    this.setPercussionPart(9, true);

    for (i = 0; i < 128; ++i) {
      this.percussionVolume[i] = 127;
    }

    this.gainMaster.connect(this.ctx.destination);
    /*
    if (this.element) {
      this.element.querySelector('.header div:before').innerText = mode + ' Mode';
      this.element.dataset.mode = mode;
    }
    */
  }
  /**
   */


  close() {
    this.ctx.close();
  }
  /**
   * @param {Uint8Array} input
   */


  refreshInstruments(input) {
    this.input = input;
    this.parser = new Parser(input);
    this.bankSet = this.createAllInstruments();
  }
  /** @return {Array.<Array.<Object>>} */


  createAllInstruments() {
    /** @type {SoundFont.Parser} */
    const parser = this.parser;
    parser.parse();
    /** @type {Array} TODO */

    const presets = parser.createPreset();
    /** @type {Array} TODO */

    const instruments = parser.createInstrument();
    /** @type {Array} */

    const banks = [];
    /** @type {Array.<Array.<Object>>} */

    let bank;
    /** @type {number} */

    let bankNumber;
    /** @type {Object} TODO */

    let preset;
    /** @type {Object} */

    let instrument;
    /** @type {number} */

    let presetNumber;
    /** @type {number} */

    let i;
    /** @type {number} */

    let il;
    /** @type {number} */

    let j;
    /** @type {number} */

    let jl;
    /** @type {string} */

    let presetName;
    const programSet = [];

    for (i = 0, il = presets.length; i < il; ++i) {
      preset = presets[i];
      presetNumber = preset.header.preset;
      bankNumber = preset.header.bank;
      presetName = preset.name.replace(/\0*$/, '');

      if (typeof preset.instrument !== 'number') {
        continue;
      }

      instrument = instruments[preset.instrument];

      if (instrument.name.replace(/\0*$/, '') === 'EOI') {
        continue;
      } // select bank


      if (banks[bankNumber] === void 0) {
        banks[bankNumber] = [];
      }

      bank = banks[bankNumber];
      bank[presetNumber] = {};
      bank[presetNumber].name = presetName;

      for (j = 0, jl = instrument.info.length; j < jl; ++j) {
        this.createNoteInfo(parser, instrument.info[j], bank[presetNumber]);
      }

      if (!programSet[bankNumber]) {
        programSet[bankNumber] = {};
      }

      programSet[bankNumber][presetNumber] = presetName;
    }

    this.programSet = programSet;
    return banks;
  }
  /**
   * @param {Parser} parser
   * @param {*} info
   * @param {*} preset
   */


  createNoteInfo(parser, info, preset) {
    /** @type {Generator} */
    const generator = info.generator;

    if (generator.keyRange === void 0 || generator.sampleID === void 0) {
      return;
    } // console.log(generator);

    /** @type {number} */


    const volDelay = this.getModGenAmount(generator, 'delayVolEnv', -12000);
    /** @type {number} */

    const volAttack = this.getModGenAmount(generator, 'attackVolEnv', -12000);
    /** @type {number} */

    const volHold = this.getModGenAmount(generator, 'holdVolEnv', -12000);
    /** @type {number} */

    const volDecay = this.getModGenAmount(generator, 'decayVolEnv', -12000);
    /** @type {number} */

    const volSustain = this.getModGenAmount(generator, 'sustainVolEnv');
    /** @type {number} */

    const volRelease = this.getModGenAmount(generator, 'releaseVolEnv', -12000);
    /** @type {number} */

    const modDelay = this.getModGenAmount(generator, 'delayModEnv', -12000);
    /** @type {number} */

    const modAttack = this.getModGenAmount(generator, 'attackModEnv', -12000);
    /** @type {number} */

    const modHold = this.getModGenAmount(generator, 'holdModEnv', -12000);
    /** @type {number} */

    const modDecay = this.getModGenAmount(generator, 'decayModEnv', -12000);
    /** @type {number} */

    const modSustain = this.getModGenAmount(generator, 'sustainModEnv');
    /** @type {number} */

    const modRelease = this.getModGenAmount(generator, 'releaseModEnv', -12000);
    /** @type {number} */

    const scale = this.getModGenAmount(generator, 'scaleTuning', 100) / 100;
    /** @type {number} */

    const freqVibLFO = this.getModGenAmount(generator, 'freqVibLFO');
    /** @type {number} */

    const pan = this.getModGenAmount(generator, 'pan');
    /** @type {number} */

    const tune = this.getModGenAmount(generator, 'coarseTune') + this.getModGenAmount(generator, 'fineTune') / 100;

    for (let i = generator.keyRange.lo, il = generator.keyRange.hi; i <= il; ++i) {
      if (preset[i]) {
        continue;
      }
      /** @type {number} */


      const sampleId = this.getModGenAmount(generator, 'sampleID');
      /** @type {object} */

      const sampleHeader = parser.sampleHeader[sampleId];
      preset[i] = {
        'sample': parser.sample[sampleId],
        'sampleRate': sampleHeader.sampleRate,
        'sampleModes': this.getModGenAmount(generator, 'sampleModes'),
        'basePlaybackRate': 1.0594630943592953 // Math.pow(2, 1 / 12)
        ** ((i - this.getModGenAmount(generator, 'overridingRootKey', sampleHeader.originalPitch) + tune + sampleHeader.pitchCorrection / 100) * scale),
        'modEnvToPitch': this.getModGenAmount(generator, 'modEnvToPitch') / 100,
        'scaleTuning': scale,
        'start': this.getModGenAmount(generator, 'startAddrsCoarseOffset') * 32768 + this.getModGenAmount(generator, 'startAddrsOffset'),
        'end': this.getModGenAmount(generator, 'endAddrsCoarseOffset') * 32768 + this.getModGenAmount(generator, 'endAddrsOffset'),
        'loopStart': // (sampleHeader.startLoop - sampleHeader.start) +
        sampleHeader.startLoop + this.getModGenAmount(generator, 'startloopAddrsCoarseOffset') * 32768 + this.getModGenAmount(generator, 'startloopAddrsOffset'),
        'loopEnd': // (sampleHeader.endLoop - sampleHeader.start) +
        sampleHeader.endLoop + this.getModGenAmount(generator, 'endloopAddrsCoarseOffset') * 32768 + this.getModGenAmount(generator, 'endloopAddrsOffset'),
        'volDelay': 2 ** (volDelay / 1200),
        'volAttack': 2 ** (volAttack / 1200),
        'volHold': 2 ** (volHold / 1200) * 2 ** ((60 - i) * this.getModGenAmount(generator, 'keynumToVolEnvHold') / 1200),
        'volDecay': 2 ** (volDecay / 1200) * 2 ** ((60 - i) * this.getModGenAmount(generator, 'keynumToVolEnvDecay') / 1200),
        'volSustain': volSustain / 1000,
        'volRelease': 2 ** (volRelease / 1200),
        'modDelay': 2 ** (modDelay / 1200),
        'modAttack': 2 ** (modAttack / 1200),
        'modHold': 2 ** (modHold / 1200) * 2 ** ((60 - i) * this.getModGenAmount(generator, 'keynumToModEnvHold') / 1200),
        'modDecay': 2 ** (modDecay / 1200) * 2 ** ((60 - i) * this.getModGenAmount(generator, 'keynumToModEnvDecay') / 1200),
        'modSustain': modSustain / 1000,
        'modRelease': 2 ** (modRelease / 1200),
        'initialFilterFc': this.getModGenAmount(generator, 'initialFilterFc', 13500),
        'modEnvToFilterFc': this.getModGenAmount(generator, 'modEnvToFilterFc'),
        'initialFilterQ': this.getModGenAmount(generator, 'initialFilterQ'),
        'reverbEffectSend': this.getModGenAmount(generator, 'reverbEffectSend'),
        'initialAttenuation': this.getModGenAmount(generator, 'initialAttenuation'),
        'freqVibLFO': freqVibLFO ? 2 ** (freqVibLFO / 1200) * 8.176 : void 0,
        'pan': pan ? pan / 1200 : void 0
      };
    }
  }

  /**
   * @param {Object} generator
   * @param {string} enumeratorType
   * @param {number=} optDefault
   * @return {number}
   */
  getModGenAmount(generator, enumeratorType, optDefault = null) {
    return generator[enumeratorType] ? generator[enumeratorType].amount : optDefault;
  }
  /**
   */


  start() {
    this.connect();
    this.bufSrc.start(0);
    this.setMasterVolume(16383);
  }
  /**
   * @param {number} volume
   */


  setMasterVolume(volume) {
    this.masterVolume = volume;
    this.gainMaster.gain.value = this.baseVolume * (volume / 16384);
  }
  /**
   */


  connect() {
    this.bufSrc.connect(this.gainMaster);
  }
  /**
   */


  disconnect() {
    this.bufSrc.disconnect(this.gainMaster);
    this.bufSrc.buffer = null;
  }
  /**
   * @param {number} channel NoteOn するチャンネル.
   * @param {number} key NoteOn するキー.
   * @param {number} velocity 強さ.
   */


  noteOn(channel, key, velocity) {
    /** @type {number} */
    const bankIndex = this.channelBank[channel];
    /** @type {Object} */

    const bank = typeof this.bankSet[bankIndex] === 'object' ? this.bankSet[bankIndex] : this.bankSet[0];
    /** @type {Object} */

    let instrument;

    if (typeof bank[this.channelInstrument[channel]] === 'object') {
      // 音色が存在する場合
      instrument = bank[this.channelInstrument[channel]];
    } else if (this.percussionPart[channel] == true) {
      // パーカッションバンクが選択されている場合で音色が存在しない場合Standard Kitを選択
      instrument = this.bankSet[this.isXG ? 127 : 128][0];
    } else {
      // 通常バンクが選択されている状態で音色が存在しない場合バンク0を選択
      instrument = this.bankSet[0][this.channelInstrument[channel]];
    }

    if (instrument[key] === void 0) {
      // TODO
      console.warn('instrument not found: bank=%s instrument=%s channel=%s key=%s', bankIndex, this.channelInstrument[channel], channel, key);
      return;
    }
    /** @type {Object} */


    const instrumentKey = instrument[key];
    /** @type {number} */

    let panpot = this.channelPanpot[channel] === 0 ? Math.random() * 127 | 0 : this.channelPanpot[channel] - 64;
    panpot /= panpot < 0 ? 64 : 63; // create note information

    instrumentKey['channel'] = channel;
    instrumentKey['key'] = key;
    instrumentKey['velocity'] = velocity;
    instrumentKey['panpot'] = panpot;
    instrumentKey['volume'] = this.channelVolume[channel] / 127;
    instrumentKey['pitchBend'] = this.channelPitchBend[channel] - 8192;
    instrumentKey['expression'] = this.channelExpression[channel];
    instrumentKey['pitchBendSensitivity'] = Math.round(this.channelPitchBendSensitivity[channel]);
    instrumentKey['mute'] = this.channelMute[channel];
    instrumentKey['releaseTime'] = this.channelRelease[channel];
    instrumentKey['cutOffFrequency'] = this.cutOffFrequency[channel];
    instrumentKey['harmonicContent'] = this.harmonicContent[channel];
    instrumentKey['reverb'] = this.reverb[channel]; // percussion

    if (bankIndex > 125) {
      if (key === 42 || key === 44) {
        // 42: Closed Hi-Hat
        // 44: Pedal Hi-Hat
        // 46: Open Hi-Hat
        this.noteOff(channel, 46, 0);
      }

      if (key === 80) {
        // 80: Mute Triangle
        // 81: Open Triangle
        this.noteOff(channel, 81, 0);
      }

      instrument['volume'] *= this.percussionVolume[key] / 127;
    } // note on

    /** @type {SynthesizerNote} */


    const note = new SynthesizerNote(this.ctx, this.gainMaster, instrumentKey);
    note.noteOn();
    this.currentNoteOn[channel].push(note);
    this.updateSynthElement(channel, key, velocity);
  }
  /**
   * @param {number} channel NoteOff するチャンネル.
   * @param {number} key NoteOff するキー.
   * @param {number} velocity 強さ.
   */


  noteOff(channel, key, velocity) {
    /** @type {number} */
    let i;
    /** @type {number} */

    let il;
    /** @type {Array.<SynthesizerNote>} */

    const currentNoteOn = this.currentNoteOn[channel];
    /** @type {SynthesizerNote} */

    let note;
    /** @type {boolean} */

    const hold = this.channelHold[channel];

    for (i = 0, il = currentNoteOn.length; i < il; ++i) {
      note = currentNoteOn[i];

      if (note.key === key) {
        note.noteOff(); // hold している時は NoteOff にはするがリリースはしない

        if (!hold) {
          note.release();
          currentNoteOn.splice(i, 1);
          --i;
          --il;
        }
      }
    }

    this.updateSynthElement(channel, key, 0);
  }
  /**
   * @param {number} channel ホールドするチャンネル
   * @param {number} value 値
   */


  hold(channel, value) {
    /** @type {Array.<SynthesizerNote>} */
    const currentNoteOn = this.currentNoteOn[channel];
    /** @type {boolean} */

    const hold = this.channelHold[channel] = !(value < 64);
    /** @type {SynthesizerNote} */

    let note;
    /** @type {number} */

    let i;
    /** @type {number} */

    let il;

    if (!hold) {
      for (i = 0, il = currentNoteOn.length; i < il; ++i) {
        note = currentNoteOn[i];

        if (note.isNoteOff()) {
          note.release();
          currentNoteOn.splice(i, 1);
          --i;
          --il;
        }
      }
    }

    if (this.element) {
      /** @type {HTMLDivElement} */
      const channelElement = this.element.querySelector('.instrument > .channel:nth-child(' + (channel + 1) + ')');

      if (this.channelHold[channel]) {
        channelElement.classList.add('hold');
      } else {
        channelElement.classList.remove('hold');
      }
    }
  }
  /**
   * @param {number} channel チャンネルのバンクセレクトMSB
   * @param {number} value 値
   */


  bankSelectMsb(channel, value) {
    if (this.isXG) {
      // 念の為バンクを0にリセット
      this.channelBank[channel] = 0; // XG音源は、MSB→LSBの優先順でバンクセレクトをする。

      if (value === 64) {
        // Bank Select MSB #64 (Voice Type: SFX)
        this.channelBank[channel] = 125;
        this.percussionPart[channel] = true;
      } else if (value === 126 || value === 127) {
        // Bank Select MSB #126 (Voice Type: Drum)
        // Bank Select MSB #127 (Voice Type: Drum)
        this.channelBank[channel] = value;
        this.percussionPart[channel] = true;
      }
    } else if (this.isGS) {
      // GS音源
      // ※チャンネル10のバンク・セレクト命令は無視する。
      this.channelBank[channel] = channel === 9 ? 128 : value;
      this.percussionPart[channel] = value === 128;
    } else {
      // GM音源モードのときはバンク・セレクトを無視
      return;
    }

    this.updateBankSelect(channel);
  }
  /**
   * @param {number} channel チャンネルのバンクセレクトLSB
   * @param {number} value 値
   */


  bankSelectLsb(channel, value) {
    // XG音源以外は処理しない
    if (!this.isXG || this.percussionPart[channel] === true) {
      return;
    } // 125より値が大きい場合、パーカッションとして処理


    this.percussionPart[channel] = value >= 125;
    this.channelBank[channel] = value;
    this.updateBankSelect(channel);
  }
  /**
   * @param {number} channel 音色を変更するチャンネル.
   * @param {number} instrument 音色番号.
   */


  programChange(channel, instrument) {
    this.channelInstrument[channel] = instrument;
    this.bankChange(channel, this.channelBank[channel]);

    if (this.element) {
      this.element.querySelector('.instrument > .channel:nth-child(' + (channel + 1) + ') .program > select').value = instrument;
    }
  }
  /**
   * @param {number} channel 音色を変更するチャンネル.
   * @param {number} bank バンク・セレクト.
   */


  bankChange(channel, bank) {
    if (typeof this.bankSet[bank] === 'object') {
      // バンクが存在するとき
      this.channelBank[channel] = bank;
    } else {
      // バンクが存在しないとき
      if (this.percussionPart[channel]) {
        // パーカッション
        this.channelBank[channel] = !this.isXG ? 128 : 127;
      } else {
        // 存在しない場合0を選択
        this.channelBank[channel] = 0;
      }
    } // TODO: 厳密にはMIDI音源はプログラムチェンジがあったときにバンク・セレクトが反映される。


    this.updateProgramSelect(channel);

    if (this.element) {
      this.element.querySelector('.instrument > .channel:nth-child(' + (channel + 1) + ') > .bank > select').value = bank;
    }
  }
  /**
   * @param {number} channel 音量を変更するチャンネル.
   * @param {number} volume 音量(0-127).
   */


  volumeChange(channel, volume) {
    if (this.element) {
      this.element.querySelector('.instrument > .channel:nth-child(' + (channel + 1) + ') > .volume var').innerText = volume;
    }

    this.channelVolume[channel] = volume;
  }
  /**
   * @param {number} channel 音量を変更するチャンネル.
   * @param {number} expression 音量(0-127).
   */


  expression(channel, expression) {
    /** @type {number} */
    let i;
    /** @type {number} */

    let il;
    /** @type {Array.<SynthesizerNote>} */

    const currentNoteOn = this.currentNoteOn[channel];

    for (i = 0, il = currentNoteOn.length; i < il; ++i) {
      currentNoteOn[i].updateExpression(expression);
    }

    this.channelExpression[channel] = expression;
  }
  /**
   * @param {number} channel panpot を変更するチャンネル.
   * @param {number} panpot panpot(0-127).
   */


  panpotChange(channel, panpot) {
    if (this.element) {
      this.element.querySelector('.instrument > .channel:nth-child(' + (channel + 1) + ') > .panpot > meter').value = panpot;
    }

    this.channelPanpot[channel] = panpot;
  }
  /**
   * @param {number} channel panpot を変更するチャンネル.
   * @param {number} lowerByte
   * @param {number} higherByte
   */


  pitchBend(channel, lowerByte, higherByte) {
    /** @type {number} */
    const bend = lowerByte & 0x7f | (higherByte & 0x7f) << 7;
    /** @type {number} */

    let i;
    /** @type {number} */

    let il;
    /** @type {Array.<SoundFont.SynthesizerNote>} */

    const currentNoteOn = this.currentNoteOn[channel];
    /** @type {number} */

    const calculated = bend - 8192;

    if (this.element) {
      this.element.querySelector('.instrument > .channel:nth-child(' + (channel + 1) + ') > .pitchBend > meter').value = calculated;
    }

    for (i = 0, il = currentNoteOn.length; i < il; ++i) {
      currentNoteOn[i].updatePitchBend(calculated);
    }

    this.channelPitchBend[channel] = bend;
  }
  /**
   * @param {number} channel pitch bend sensitivity を変更するチャンネル.
   * @param {number} sensitivity
   */


  pitchBendSensitivity(channel, sensitivity) {
    if (this.element) {
      document.querySelector('.instrument > .channel:nth-child(' + (channel + 1) + ') > .pitchBendSensitivity > var').innerText = sensitivity;
    }

    this.channelPitchBendSensitivity[channel] = sensitivity;
  }
  /**
   * @param {number} channel
   * @param {number} attackTime
   */


  attackTime(channel, attackTime) {
    this.channelAttack[channel] = attackTime;
  }
  /**
   * @param {number} channel
   * @param {number} decayTime
   */


  decayTime(channel, decayTime) {
    this.channelDecay[channel] = decayTime;
  }
  /**
   * @param {number} channel
   * @param {number} sustinTime
   */


  sustinTime(channel, sustinTime) {
    this.channelSustin[channel] = sustinTime;
  }
  /**
   * @param {number} channel
   * @param {number} releaseTime
   */


  releaseTime(channel, releaseTime) {
    this.channelRelease[channel] = releaseTime;
  }
  /**
   * @param {number} channel
   * @param {number} value
   */


  harmonicContent(channel, value) {
    this.channelHarmonicContent[channel] = value;
  }
  /**
   * @param {number} channel
   * @param {number} value
   */


  cutOffFrequency(channel, value) {
    this.channelCutOffFrequency[channel] = value;
  }
  /**
   * リバーブエフェクト
   * @param {number} channel
   * @param {number} depth
   */


  reverbDepth(channel, depth) {
    // リバーブ深度は、ドライ／ウェット比とする。
    this.reverb[channel].mix(depth / 127);
  }
  /**
   * モデュレーター
   * @param {number} channel
   * @param {number} depth
   */


  modulationDepth(channel, depth) {} // TODO: LFOの反映量
  // this.filter[channel].mix(depth / 127);

  /**
   * @param {number} channel pitch bend sensitivity を取得するチャンネル.
   * @return {number}
   */


  getPitchBendSensitivity(channel) {
    return this.channelPitchBendSensitivity[channel];
  }
  /**
   * @param {number} key
   * @param {number} volume
   */


  drumInstrumentLevel(key, volume) {
    this.percussionVolume[key] = volume;
  }
  /**
   * @param {number} channel NoteOff するチャンネル.
   */


  allNoteOff(channel) {
    /** @type {Array.<SynthesizerNote>} */
    const currentNoteOn = this.currentNoteOn[channel]; // ホールドを解除

    this.hold(channel, 0); // 再生中の音をすべて止める

    while (currentNoteOn.length > 0) {
      this.noteOff(channel, currentNoteOn[0].key, 0);
    }
  }
  /**
   * @param {number} channel 音を消すチャンネル.
   */


  allSoundOff(channel) {
    /** @type {Array.<SynthesizerNote>} */
    const currentNoteOn = this.currentNoteOn[channel];
    /** @type {SynthesizerNote} */

    let note;

    while (currentNoteOn.length > 0) {
      note = currentNoteOn.shift();
      this.noteOff(channel, note.key, 0);
      note.release();
      note.disconnect();
    } // ホールドを解除


    this.hold(channel, 0);
  }
  /**
   * @param {number} channel リセットするチャンネル
   */


  resetAllControl(channel) {
    this.allNoteOff(channel);
    this.expression(channel, 127);
    this.pitchBend(channel, 0x00, 0x40);
  }
  /**
   * @param {number} channel ミュートの設定を変更するチャンネル.
   * @param {boolean} mute ミュートにするなら true.
   */


  mute(channel, mute) {
    /** @type {Array.<SynthesizerNote>} */
    const currentNoteOn = this.currentNoteOn[channel];
    /** @type {number} */

    let i;
    /** @type {number} */

    let il;
    this.channelMute[channel] = mute;

    if (mute) {
      for (i = 0, il = currentNoteOn.length; i < il; ++i) {
        currentNoteOn[i].disconnect();
      }
    } else {
      for (i = 0, il = currentNoteOn.length; i < il; ++i) {
        currentNoteOn[i].connect();
      }
    }
  }
  /**
   * @param {number} channel TODO:ドラムパートとしてセットするチャンネル
   * @param {boolean} sw ドラムか通常かのスイッチ
   */


  setPercussionPart(channel, sw) {
    if (!this.isXG) {
      this.channelBank[channel] = 128;
    } else {
      this.channelBank[channel] = 127;
    }

    this.percussionPart[channel] = sw;
  }

}

/**
 * @param {File} file
 */

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = error => reject(error);

    reader.readAsArrayBuffer(file);
  });
}
/**
 * @param {string} URL
 */


async function fetchResourceAsArrayBuffer(url) {
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

class SoundFont {
  constructor() {
    this.synth = undefined;
    this._channel = 0;
    this._bankIndex = 0;
    this._programIndex = 0;
  }

  set channel(channel) {
    this._channel = channel;
  }
  /**
   *
   * @param {File} file
   */


  async loadSoundFontFromFile(file) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    this.bootSynth(arrayBuffer);
  }
  /**
   *
   * @param {string} url
   */


  async loadSoundFontFromURL(url) {
    const arrayBuffer = await fetchResourceAsArrayBuffer(url);
    this.bootSynth(arrayBuffer);
  }

  set bank(index) {
    this._bankIndex = index;
    this.synth.bankChange(this._channel, index);
  }

  get banks() {
    return Object.keys(this.synth.programSet).map(id => ({
      id,
      name: ('000' + parseInt(id, 10)).slice(-3)
    }));
  }

  set program(index) {
    this._programIndex = index;
    this.synth.programChange(this._channel, index);
  }

  get programs() {
    const {
      programSet
    } = this.synth;
    return Object.keys(programSet[this._bankIndex]).map(id => ({
      id,
      name: ('000' + (parseInt(id) + 1)).slice(-3) + ':' + programSet[this._bankIndex][id]
    }));
  }
  /**
   * @param {ArrayBuffer} arrayBuffer
   */


  async bootSynth(arrayBuffer) {
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


  noteOn(midiNumber) {
    const volume = 127;
    this.synth.noteOn(this._channel, midiNumber, volume);
  }
  /**
   *
   * @param {number} midiNumber
   */


  noteOff(midiNumber) {
    const volume = 127;
    this.synth.noteOff(this._channel, midiNumber, volume);
  }

}

export default SoundFont;
//# sourceMappingURL=index.js.map
