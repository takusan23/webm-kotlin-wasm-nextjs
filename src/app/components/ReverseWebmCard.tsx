'use client'

import { useRef, useState } from "react"
import { BlobDownloadTool } from "../tools/BlobDownloadTool"
import KotlinToJsArray from "../tools/KotlinToJsArray"

export default function ReverseWebmCard() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isRunning, setRunning] = useState(false)

    async function handleFileSelect(file?: File) {
        if (!file) return

        // クライアントでロードする
        const {
            getEncodeDataFromEncodeData,
            getTimeFromEncodeData,
            getVideoEncodeDataFromWebmParseResult,
            getVideoHeightFromWebmParseResult,
            getVideoWidthFromWebmParseResult,
            isKeyFrameFromEncodeData,
            parseWebm,
            createMuxerWebm,
            setAudioTrack,
            setVideoTrack,
            writeAudioTrack,
            writeVideoTrack,
            muxerBuild,
            getAudioCodecFromWebmParseResult,
            getAudioSamplingRateFromWebmParseResult,
            getAudioChannelCountFromWebmParseResult,
            getAudioEncodeDataFromWebmParseResult
        } = await import("himari-webm-kotlin-multiplatform")
        setRunning(true)

        // WebM をパース
        const arrayBuffer = await file.arrayBuffer()
        const intArray = new Int8Array(arrayBuffer)
        const parseRef = parseWebm(intArray as any)
        const hasAudioTrack = getAudioCodecFromWebmParseResult(parseRef) !== null

        // トラックのサンプルを取る
        const videoTrackEncodeDataList = Array.from(getVideoEncodeDataFromWebmParseResult(parseRef) as any).map((ref) => ({
            time: getTimeFromEncodeData(ref),
            encodeData: getEncodeDataFromEncodeData(ref),
            isKeyFrame: isKeyFrameFromEncodeData(ref)
        }))
        const audioTrackEncodeDataList = hasAudioTrack
            ? Array.from(getAudioEncodeDataFromWebmParseResult(parseRef) as any).map((ref) => ({
                time: getTimeFromEncodeData(ref),
                encodeData: getEncodeDataFromEncodeData(ref),
                isKeyFrame: isKeyFrameFromEncodeData(ref)
            }))
            : []

        // 時間等を出す
        const durationMs = videoTrackEncodeDataList[videoTrackEncodeDataList.length - 1].time
        const videoHeight = Number(getVideoHeightFromWebmParseResult(parseRef))
        const videoWidth = Number(getVideoWidthFromWebmParseResult(parseRef))
        const samplingRateOrNull = hasAudioTrack ? Number(getAudioSamplingRateFromWebmParseResult(parseRef)) : null
        const channelCountOrNull = hasAudioTrack ? Number(getAudioChannelCountFromWebmParseResult(parseRef)) : null

        // とりあえず canvas に描画
        const ctx = canvasRef.current?.getContext('2d')

        // マルチプレクサ
        const muxerRef = createMuxerWebm()
        setVideoTrack(muxerRef, videoWidth, videoHeight)
        if (hasAudioTrack && samplingRateOrNull && channelCountOrNull) {
            setAudioTrack(muxerRef, samplingRateOrNull, channelCountOrNull)
        }

        // VideoCodec コールバック
        let decoderOutput: (videoFrame: VideoFrame) => void = () => {/* do nothing */ }
        let encoderOutput: (encodedVideoChunk: EncodedVideoChunk) => void = () => {/* do nothing */ }

        // 逆からデコードしたものをエンコードする
        const videoEncoder = new VideoEncoder({
            error: (err) => { console.log(err) },
            output: (chunk) => { encoderOutput(chunk) }
        })
        videoEncoder.configure({
            codec: 'vp09.00.10.08',
            height: videoHeight,
            width: videoWidth,
            framerate: 30
        })

        // デコーダー用意
        const videoDecoder = new VideoDecoder({
            error: (err) => { console.log(err) },
            output: (videoFrame) => { decoderOutput(videoFrame) }
        })
        videoDecoder.configure({
            codec: 'vp09.00.10.08',
            codedHeight: videoHeight,
            codedWidth: videoWidth
        })

        /** データが足りないのか、webm の sample を渡してもコールバックが呼ばれない時がある。そこで タイムアウトつき。 */
        async function videoDecodePromise() {
            const callbackPromise = new Promise<VideoFrame>((resolve) => {
                decoderOutput = (videoFrame) => {
                    resolve(videoFrame)
                }
            })
            return Promise.race(
                [
                    new Promise((resolve) => setTimeout(resolve, 1000)).then(_ => null),
                    callbackPromise
                ]
            )
        }

        async function videoEncodePromise() {
            const callbackPromise = new Promise<EncodedVideoChunk>((resolve) => {
                encoderOutput = (chunk) => {
                    resolve(chunk)
                }
            })
            return Promise.race(
                [
                    new Promise((resolve) => setTimeout(resolve, 1000)).then(_ => null),
                    callbackPromise
                ]
            )
        }

        // エンコードされているデータをデコードしていく
        // 単位はマイクロ秒
        // 逆再生したい
        for (let frameIndex = videoTrackEncodeDataList.length - 1; frameIndex >= 0; frameIndex--) {
            const encodeChunkData = videoTrackEncodeDataList[frameIndex]
            const frameMs = Number(encodeChunkData.time)

            // キーフレームじゃない場合はキーフレームまで戻る
            if (!encodeChunkData.isKeyFrame) {
                const keyFrameIndex = videoTrackEncodeDataList.findLastIndex((chunk) => chunk.isKeyFrame && chunk.time < frameMs)
                for (let iFrameIndex = keyFrameIndex; iFrameIndex < frameIndex; iFrameIndex++) {
                    const iFrameChunk = videoTrackEncodeDataList[iFrameIndex]
                    const iFrameVideoChunk = new EncodedVideoChunk({
                        data: KotlinToJsArray.toJsByteArray(iFrameChunk.encodeData).buffer as any,
                        timestamp: (durationMs - Number(iFrameChunk.time)) * 1_000,
                        type: iFrameChunk.isKeyFrame ? 'key' : 'delta'
                    })
                    const promise = videoDecodePromise()
                    videoDecoder.decode(iFrameVideoChunk)
                    const unUseVideoFrame = await promise
                    unUseVideoFrame?.close()
                }
            }

            // 戻ったのでデコード
            const videoChunk = new EncodedVideoChunk({
                data: KotlinToJsArray.toJsByteArray(encodeChunkData.encodeData).buffer as any,
                timestamp: (durationMs - Number(encodeChunkData.time)) * 1_000,
                type: encodeChunkData.isKeyFrame ? 'key' : 'delta'
            })

            // Promise を作ってデコーダーに入れた後 await 待つ
            const videoFramePromise = videoDecodePromise()
            videoDecoder.decode(videoChunk)
            const videoFrame = await videoFramePromise
            if (!videoFrame) break

            // https://stackoverflow.com/questions/23104582/
            if (canvasRef.current) {
                var hRatio = canvasRef.current.width / videoFrame.displayWidth
                var vRatio = canvasRef.current.height / videoFrame.displayHeight
                var ratio = Math.min(hRatio, vRatio)
                ctx?.drawImage(videoFrame, 0, 0, videoFrame.displayWidth, videoFrame.displayHeight, 0, 0, videoFrame.displayWidth * ratio, videoFrame.displayHeight * ratio)
            }

            // 逆からとったフレームをエンコーダーに入れる
            const chunkPromise = videoEncodePromise()
            videoEncoder.encode(videoFrame)
            const chunk = await chunkPromise
            if (!chunk) break

            // WebM に書き込む
            const frameData = new Uint8Array(chunk.byteLength)
            chunk.copyTo(frameData)
            console.log({ durationMs: chunk.timestamp / 1_000, isKeyFrame: chunk.type === "key", length: chunk.byteLength })
            writeVideoTrack(muxerRef, frameData as any, chunk.timestamp / 1_000, chunk.type === "key", false)

            videoFrame.close()
        }

        // 音声トラックがあれば
        if (hasAudioTrack && samplingRateOrNull && channelCountOrNull) {
            // VideoCodec コールバック
            let decoderOutput: (audioData: AudioData) => void = () => {/* do nothing */ }
            let encoderOutput: (chunk: EncodedAudioChunk) => void = () => {/* do nothing */ }

            // デコーダを用意
            const audioDecoder = new AudioDecoder({
                error: (err) => { console.log(err) },
                output: (audioData) => { decoderOutput(audioData) }
            })
            audioDecoder.configure({
                codec: 'opus',
                sampleRate: samplingRateOrNull,
                numberOfChannels: channelCountOrNull
            })

            // エンコーダーを用意
            const audioEncoder = new AudioEncoder({
                error: (err) => { console.log(err) },
                output: (chunk, metadata) => { encoderOutput(chunk) }
            })
            audioEncoder.configure({
                codec: 'opus',
                sampleRate: samplingRateOrNull,
                numberOfChannels: channelCountOrNull
            })

            /** 待ち合わせの方法がない（アイドル状態とかも取れない）ので、指定した時間のフレームが来るまで */
            async function audioDecodePromise(time: number) {
                const audioDataList: AudioData[] = []
                const callbackPromise = new Promise<AudioData[]>((resolve) => {
                    decoderOutput = (audioData) => {
                        audioDataList.push(audioData)
                        if (time <= audioData.timestamp) {
                            resolve(audioDataList)
                        }
                    }
                })
                return Promise.race(
                    [
                        new Promise((resolve) => setTimeout(resolve, 10_000)).then(_ => null),
                        callbackPromise
                    ]
                )
            }
            async function audioEncodePromise(time: number) {
                const encodeAudioList: EncodedAudioChunk[] = []
                const callbackPromise = new Promise<EncodedAudioChunk[]>((resolve) => {
                    encoderOutput = (chunk) => {
                        encodeAudioList.push(chunk)
                        if (time <= chunk.timestamp) {
                            resolve(encodeAudioList)
                        }
                    }
                })
                return Promise.race(
                    [
                        new Promise((resolve) => setTimeout(resolve, 10_000)).then(_ => null),
                        callbackPromise
                    ]
                )
            }

            // 音声を逆にする
            const decodeAudioList: AudioData[] = []
            // まず全てを PCM にデコードする
            // 単位はマイクロ秒
            for (const audioChunk of audioTrackEncodeDataList) {
                const encodeChunk = new EncodedAudioChunk({
                    data: KotlinToJsArray.toJsByteArray(audioChunk.encodeData).buffer as any,
                    timestamp: Number(audioChunk.time) * 1_000,
                    type: audioChunk.isKeyFrame ? 'key' : 'delta'
                })
                const decodeListPromise = audioDecodePromise(audioChunk.time)
                audioDecoder.decode(encodeChunk)

                // 一旦配列に
                // close() は後で
                const decodePcmList = await decodeListPromise
                if (!decodePcmList) break
                decodeAudioList.push(...decodePcmList)
            }

            // AudioData を渡してエンコードする
            async function encodeAudioData(audioData: AudioData) {
                // 多分 16bit
                // なぜか float32 だった...
                // webcodecs の世界ではこうなのだろうか
                const float32Array = new Float32Array(audioData.numberOfFrames * audioData.numberOfChannels)
                audioData.copyTo(float32Array, { planeIndex: 0 })

                // エンコード
                const reversePcm = new AudioData({
                    data: float32Array,
                    format: audioData.format!,
                    timestamp: (durationMs * 1_000) - Number(audioData.timestamp),
                    numberOfFrames: audioData.numberOfFrames,
                    numberOfChannels: audioData.numberOfChannels,
                    sampleRate: audioData.sampleRate
                })
                const encodeAudioListPromise = audioEncodePromise(reversePcm.timestamp)
                audioEncoder.encode(reversePcm)
                const encodeAudioListData = await encodeAudioListPromise
                return encodeAudioListData
            }

            /**
             *  [1,2,3,4,5,6] を [[1,2],[3,4],[5,6]] する
             */
            function chunked<T>(origin: T[], size: number) {
                return origin
                    .map((_, i) => i % size === 0 ? origin.slice(i, i + size) : null)
                    .filter((nullabeList) => nullabeList !== null)
            }

            // 逆にしてデコーダーに入れる
            // 2 チャンネルある場合は、サンプルを二つ連続で取る必要がある
            // forEach だと一個ずつなので、二つの配列の配列（チャンク）にして、逆にする
            const reverseChannelDecodeAudioList = chunked(decodeAudioList, channelCountOrNull).reverse()
            console.log({ reverseChannelDecodeAudioList })
            for (const sample of reverseChannelDecodeAudioList) {
                console.log({ sample })
                // チャンネル数取り出す todo 2ch
                const channel1 = sample[0]
                const channel2 = sample[1]
                if (!channel1) continue
                if (!channel2) continue

                // エンコードする
                const encodeAudioListData1 = await encodeAudioData(channel1)
                const encodeAudioListData2 = await encodeAudioData(channel2)
                console.log({ encodeAudioListData1, encodeAudioListData2 })
                // WebM へ
                // 複数あるかもなので
                Array.of(encodeAudioListData1, encodeAudioListData2)
                    .flat()
                    .filter((encodeChunk) => encodeChunk !== null)
                    .forEach((encodeChunk) => {
                        const frameData = new Uint8Array(encodeChunk.byteLength)
                        encodeChunk.copyTo(frameData)
                        writeAudioTrack(muxerRef, frameData as any, encodeChunk.timestamp / 1_000, encodeChunk.type === "key")
                    })
            }

            // close()
            decodeAudioList.forEach((audioData) => audioData.close())
        }

        // エンコードが終わったらマルチプレクサを終了
        const byteArray = muxerBuild(muxerRef)
        const jsByteArray = KotlinToJsArray.toJsByteArray(byteArray)

        // ダウンロード
        const blob = new Blob([jsByteArray], { type: 'video/webm' })
        BlobDownloadTool.download(blob, `reverse-video-webcodecs-${Date.now()}.webm`)
    }

    return (
        <div className="flex flex-col space-y-2 p-5 border-2 border-violet-400 rounded-2xl">
            <h2 className="text-violet-400 text-2xl">WebM ファイルを逆再生して保存する</h2>
            <p>WebCodecs を使って、逆からフレームを取り出して再エンコードします。</p>
            <p>コンテナフォーマット（.webm）の読み書きは Kotlin で書いたものを Wasm で呼び出しています。</p>
            <p>コンテナフォーマットが WebM、映像コーデックが VP9、音声コーデックが Opus である必要があります。。</p>

            {
                isRunning
                    ? <>
                        <p>プレビュー Canvas</p>
                        <canvas ref={canvasRef} width={300} height={300} />
                    </>
                    : <input
                        onChange={(ev) => handleFileSelect(ev.target.files?.[0])}
                        className="border-2 border-violet-400 rounded-2xl"
                        type="file"
                        accept="video/webm" />
            }
        </div>
    )
}