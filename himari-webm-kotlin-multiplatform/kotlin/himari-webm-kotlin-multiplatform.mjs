

import { instantiate } from './himari-webm-kotlin-multiplatform.uninstantiated.mjs';


const exports = (await instantiate({

})).exports;

export const {
fixSeekableWebm,
createMuxerWebm,
setAudioTrack,
setVideoTrack,
writeAudioTrack,
writeVideoTrack,
muxerBuild,
parseWebm,
getAudioCodecFromWebmParseResult,
getAudioSamplingRateFromWebmParseResult,
getAudioChannelCountFromWebmParseResult,
getVideoCodecFromWebmParseResult,
getVideoWidthFromWebmParseResult,
getVideoHeightFromWebmParseResult,
getAudioEncodeDataFromWebmParseResult,
getVideoEncodeDataFromWebmParseResult,
getTrackIndexFromEncodeData,
getTimeFromEncodeData,
isKeyFrameFromEncodeData,
getEncodeDataSizeFromEncodeData,
getEncodeDataFromEncodeData,
memory,
_initialize
} = exports


