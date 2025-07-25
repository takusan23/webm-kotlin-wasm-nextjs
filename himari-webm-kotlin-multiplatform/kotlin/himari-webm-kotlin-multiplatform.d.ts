type Nullable<T> = T | null | undefined
declare function KtSingleton<T>(): T & (abstract new() => any);
export declare function fixSeekableWebm(webmByteArray: not.exported.kotlin.js.Array<number>): not.exported.kotlin.js.Array<number>;
export declare function createMuxerWebm(): unknown;
export declare function setAudioTrack(muxerRef: unknown, samplingRateFloat: number, channelCount: number): void;
export declare function setVideoTrack(muxerRef: unknown, videoWidth: number, videoHeight: number): void;
export declare function writeAudioTrack(muxerRef: unknown, encodeData: not.exported.kotlin.js.Array<number>, durationMs: number, isKeyFrame: boolean): void;
export declare function writeVideoTrack(muxerRef: unknown, encodeData: not.exported.kotlin.js.Array<number>, durationMs: number, isKeyFrame: boolean, _unuse: boolean): void;
export declare function muxerBuild(muxerRef: unknown): not.exported.kotlin.js.Array<number>;
export declare function parseWebm(webmByteArray: not.exported.kotlin.js.Array<number>): unknown;
export declare function getAudioCodecFromWebmParseResult(reference: unknown): Nullable<not.exported.kotlin.js.Array<number>>;
export declare function getAudioSamplingRateFromWebmParseResult(reference: unknown): Nullable<number>;
export declare function getAudioChannelCountFromWebmParseResult(reference: unknown): Nullable<number>;
export declare function getVideoCodecFromWebmParseResult(reference: unknown): Nullable<not.exported.kotlin.js.Array<number>>;
export declare function getVideoWidthFromWebmParseResult(reference: unknown): Nullable<number>;
export declare function getVideoHeightFromWebmParseResult(reference: unknown): Nullable<number>;
export declare function getAudioEncodeDataFromWebmParseResult(reference: unknown): Nullable<not.exported.kotlin.js.Array<unknown>>;
export declare function getVideoEncodeDataFromWebmParseResult(reference: unknown): Nullable<not.exported.kotlin.js.Array<unknown>>;
export declare function getTrackIndexFromEncodeData(reference: unknown): number;
export declare function getTimeFromEncodeData(reference: unknown): number;
export declare function isKeyFrameFromEncodeData(reference: unknown): boolean;
export declare function getEncodeDataSizeFromEncodeData(reference: unknown): number;
export declare function getEncodeDataFromEncodeData(reference: unknown): not.exported.kotlin.js.Array<number>;
declare namespace not.exported.kotlin.js {
    class Array<T> {
        constructor();
        get length(): number;
        get _hashCode(): number;
        set _hashCode(value: number);
    }
    /** @deprecated $metadata$ is used for internal purposes, please don't use it in your code, because it can be removed at any moment */
    namespace Array.$metadata$ {
        const constructor: abstract new <T>() => Array<T>;
    }
}