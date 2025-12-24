'use client'

import { useRef, useState } from "react"
import { BlobDownloadTool } from "../tools/BlobDownloadTool"

export default function ReverseWebmCard() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isRunning, setRunning] = useState(false)
    const [enableSoftware, setEnableSoftware] = useState(false)

    /** 処理を開始する */
    async function process(file?: File) {
        if (!file) return
        if (!canvasRef.current) return
        setRunning(true)

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

        // WebM をパース
        const arrayBuffer = await file.arrayBuffer()
        const intArray = new Int8Array(arrayBuffer)
        const parseRef = parseWebm(intArray as any)

        // 音無しの動画にも対応するため
        const hasAudioTrack = !!getAudioCodecFromWebmParseResult(parseRef)

        // エンコードされたデータを取得する
        // TODO メモリに優しくない
        const videoTrackEncodeDataList = Array.from(getVideoEncodeDataFromWebmParseResult(parseRef) as any).map((ref) => ({
            time: getTimeFromEncodeData(ref),
            encodeData: getEncodeDataFromEncodeData(ref),
            isKeyFrame: isKeyFrameFromEncodeData(ref)
        }))
        const audioTrackEncodeDataList =
            hasAudioTrack
                ? Array.from(getAudioEncodeDataFromWebmParseResult(parseRef) as any).map((ref) => ({
                    time: getTimeFromEncodeData(ref),
                    encodeData: getEncodeDataFromEncodeData(ref),
                    isKeyFrame: isKeyFrameFromEncodeData(ref)
                }))
                : []

        // 時間やデコーダー起動に必要な値を出す
        const durationMs = videoTrackEncodeDataList[videoTrackEncodeDataList.length - 1].time
        const videoHeight = Number(getVideoHeightFromWebmParseResult(parseRef))
        const videoWidth = Number(getVideoWidthFromWebmParseResult(parseRef))
        const samplingRateOrNull =
            hasAudioTrack
                ? Number(getAudioSamplingRateFromWebmParseResult(parseRef))
                : null
        const channelCountOrNull =
            hasAudioTrack
                ? Number(getAudioChannelCountFromWebmParseResult(parseRef))
                : null

        // 進捗具合を canvas に描画
        const ctx = canvasRef.current?.getContext('2d')

        // WebM に書き込むクラス作成 + 映像トラック追加 + 音声トラック追加
        const muxerRef = createMuxerWebm()
        setVideoTrack(muxerRef, videoWidth, videoHeight)
        if (hasAudioTrack && samplingRateOrNull && channelCountOrNull) {
            setAudioTrack(muxerRef, samplingRateOrNull, channelCountOrNull)
        }

        /** 映像トラックを逆からデコードしてエンコードする処理 */
        async function processVideoTrack() {
            // WebCodecs のコールバックを Promise にする
            let decoderOutput: ((videoFrame: VideoFrame) => void) = () => { }
            let encoderOutput: ((chunk: EncodedVideoChunk) => void) = () => { }

            // 映像エンコーダー・デコーダー用意
            const videoDecoder = new VideoDecoder({
                error: (err) => { alert('映像デコーダーでエラーが発生しました') },
                output: (videoFrame) => { decoderOutput(videoFrame) }
            })
            videoDecoder.configure({
                codec: 'vp09.00.10.08',
                codedHeight: videoHeight,
                codedWidth: videoWidth,
                hardwareAcceleration: enableSoftware ? 'prefer-software' : 'no-preference'
            })
            const videoEncoder = new VideoEncoder({
                error: (err) => { alert('映像エンコーダーでエラーが発生しました') },
                output: (chunk) => { encoderOutput(chunk) }
            })
            videoEncoder.configure({
                codec: 'vp09.00.10.08',
                height: videoHeight,
                width: videoWidth,
                framerate: 30,
                hardwareAcceleration: enableSoftware ? 'prefer-software' : 'no-preference'
            })

            // コールバックを Proimise にする関数
            function awaitDecoderOutput() {
                return new Promise<VideoFrame>((resolve) => {
                    decoderOutput = (videoFrame) => {
                        resolve(videoFrame)
                    }
                })
            }
            function awaitEncoderOutput() {
                return new Promise<EncodedVideoChunk>((resolve) => {
                    encoderOutput = (chunk) => {
                        resolve(chunk)
                    }
                })
            }

            // エンコードされているデータを逆からデコードして、エンコーダーに突っ込む
            // 単位はマイクロ秒
            for (let frameIndex = videoTrackEncodeDataList.length - 1; frameIndex >= 0; frameIndex--) {
                const encodeChunkData = videoTrackEncodeDataList[frameIndex]
                const frameMs = Number(encodeChunkData.time)

                // キーフレームじゃない場合はキーフレームまで戻る
                if (!encodeChunkData.isKeyFrame) {
                    const keyFrameIndex = videoTrackEncodeDataList.findLastIndex((chunk) => chunk.isKeyFrame && chunk.time < frameMs)
                    for (let iFrameIndex = keyFrameIndex; iFrameIndex < frameIndex; iFrameIndex++) {
                        const iFrameChunk = videoTrackEncodeDataList[iFrameIndex]
                        const iFrameVideoChunk = new EncodedVideoChunk({
                            data: new Int8Array(iFrameChunk.encodeData as any).buffer as any,
                            timestamp: (durationMs - Number(iFrameChunk.time)) * 1_000,
                            type: iFrameChunk.isKeyFrame ? 'key' : 'delta'
                        })
                        // デコーダー出力の Promise を待つが特に使わずに close()
                        const promise = awaitDecoderOutput()
                        videoDecoder.decode(iFrameVideoChunk)
                        const unUseVideoFrame = await promise
                        unUseVideoFrame?.close()
                    }
                }

                // 戻ったのででデコード
                const videoChunk = new EncodedVideoChunk({
                    data: new Int8Array(encodeChunkData.encodeData as any).buffer as any,
                    timestamp: (durationMs - Number(encodeChunkData.time)) * 1_000,
                    type: encodeChunkData.isKeyFrame ? 'key' : 'delta'
                })

                // Promise を作ってデコーダーに入れた後 await 待つ
                const videoFramePromise = awaitDecoderOutput()
                videoDecoder.decode(videoChunk)
                const videoFrame = await videoFramePromise

                // プレビュー、アスペクト比を保持して拡大縮小
                // https://stackoverflow.com/questions/23104582/
                if (canvasRef.current) {
                    var hRatio = canvasRef.current.width / videoFrame.displayWidth
                    var vRatio = canvasRef.current.height / videoFrame.displayHeight
                    var ratio = Math.min(hRatio, vRatio)
                    ctx?.drawImage(videoFrame, 0, 0, videoFrame.displayWidth, videoFrame.displayHeight, 0, 0, videoFrame.displayWidth * ratio, videoFrame.displayHeight * ratio)
                }

                // 逆からとったフレームをエンコーダーに入れて待つ
                const chunkPromise = awaitEncoderOutput()
                videoEncoder.encode(videoFrame)
                const chunk = await chunkPromise

                // エンコード結果を WebM に書き込む
                const frameData = new Uint8Array(chunk.byteLength)
                chunk.copyTo(frameData)
                writeVideoTrack(muxerRef, frameData as any, chunk.timestamp / 1_000, chunk.type === "key", false)
                videoFrame.close()
            }

            // リソース解放
            videoDecoder.close()
            videoEncoder.close()
        }

        /** 音声トラックをデコードしたあと、逆からエンコードする処理 */
        async function processAudioTrack() {
            // 音声トラックがない場合は return
            if (!hasAudioTrack) return
            if (!samplingRateOrNull) return
            if (!channelCountOrNull) return

            // VideoCodec コールバック
            let decoderOutput: (audioData: AudioData) => void = () => { }
            let encoderOutput: (chunk: EncodedAudioChunk) => void = () => { }

            // エンコーダー・デコーダー用意
            const audioDecoder = new AudioDecoder({
                error: (err) => { alert('音声デコーダーでエラーが発生しました') },
                output: (audioData) => { decoderOutput(audioData) }
            })
            audioDecoder.configure({
                codec: 'opus',
                sampleRate: samplingRateOrNull,
                numberOfChannels: channelCountOrNull
            })
            const audioEncoder = new AudioEncoder({
                error: (err) => { alert('音声エンコーダーでエラーが発生しました') },
                output: (chunk, metadata) => { encoderOutput(chunk) }
            })
            audioEncoder.configure({
                codec: 'opus',
                sampleRate: samplingRateOrNull,
                numberOfChannels: channelCountOrNull,
            })

            // コールバックを Promise にする
            function awaitDecoderOutput() {
                return new Promise<AudioData>((resolve) => {
                    decoderOutput = (audioData) => {
                        resolve(audioData)
                    }
                })
            }
            function awaitEncoderOutput() {
                return new Promise<EncodedAudioChunk>((resolve) => {
                    encoderOutput = (chunk) => {
                        resolve(chunk)
                    }
                })
            }

            /**
             * [1,2,3,4,5,6] を size の数で二重の配列にする
             * 2 の場合は [[1,2],[3,4],[5,6]] する
             */
            function chunked<T>(origin: T[], size: number) {
                return origin
                    .map((_, i) => i % size === 0 ? origin.slice(i, i + size) : null)
                    .filter((nullabeList) => nullabeList !== null)
            }

            // 音声の場合はとりあえずすべてのデータをデコードしちゃう
            const decodeAudioList: AudioData[] = []
            for (const audioChunk of audioTrackEncodeDataList) {
                const encodeChunk = new EncodedAudioChunk({
                    data: new Int8Array(audioChunk.encodeData as any).buffer as any,
                    timestamp: Number(audioChunk.time) * 1_000,
                    type: audioChunk.isKeyFrame ? 'key' : 'delta' // 音声は常にキーフレームかも
                })
                const audioDataPromise = awaitDecoderOutput()
                audioDecoder.decode(encodeChunk)

                // 一旦配列に。後で配列で使うので close() しない
                const audioData = await audioDataPromise
                decodeAudioList.push(audioData)
            }

            // デコードした音声データ（PCM）を逆にする。まずは全部くっつけて一つの配列に
            const pcmDataList = decodeAudioList
                .map((audioData) => {
                    const float32Array = new Float32Array(audioData.numberOfFrames * audioData.numberOfChannels)
                    audioData.copyTo(float32Array, { planeIndex: 0 })
                    return Array.from(float32Array)
                })
                .flat()

            // 次に reverse() するのだが、このときチャンネル数を考慮する必要がある
            // 2チャンネルなら [[右,左],[右,左],[右,左],] のように、ペアにした後に reverse() する必要がある
            // flat() で戻す
            const channelReversePcmList = chunked(pcmDataList, channelCountOrNull).reverse().flat()

            // WebM に一度に書き込むサイズ、どれくらいが良いのか知らないので 20ms 間隔にしてみた
            // 10ms とか 2ms とかの小さすぎるとエンコーダーに入れても何もでてこなくなる
            // 暗黙的に最小バッファサイズ的なのが？あるはず？
            const ENCODE_FRAME_SIZE = ((samplingRateOrNull * channelCountOrNull) / 1_000) * 20
            const chunkedPcmList = chunked(channelReversePcmList, ENCODE_FRAME_SIZE)

            // for でエンコーダーへ
            let timestamp = 0
            for (const pcmList of chunkedPcmList) {
                // エンコードする
                const reversePcm = new AudioData({
                    data: Float32Array.of(...pcmList),
                    format: 'f32',
                    timestamp: timestamp * 1_000,
                    numberOfFrames: (pcmList.length / channelCountOrNull), // [右,左,右,左] になっているので、フレーム数を数える時は 右左 のペアで
                    numberOfChannels: channelCountOrNull,
                    sampleRate: samplingRateOrNull
                })
                timestamp += ENCODE_FRAME_SIZE
                const chunkPromise = awaitEncoderOutput()
                audioEncoder.encode(reversePcm)
                const chunk = await chunkPromise

                // WebM に入れる
                const frameData = new Uint8Array(chunk.byteLength)
                chunk.copyTo(frameData)
                writeAudioTrack(muxerRef, frameData as any, chunk.timestamp / 1_000, chunk.type === "key")
            }

            // リソース解放
            decodeAudioList.forEach((audioData) => audioData.close())
            audioDecoder.close()
            audioEncoder.close()
        }

        // それぞれの処理を待つ
        await processVideoTrack()
        await processAudioTrack()

        // 書き込みが終わったため WebM ファイルを完成させる
        const byteArray = muxerBuild(muxerRef)
        const jsByteArray = new Int8Array(byteArray as any)

        // ダウンロード
        const blob = new Blob([jsByteArray], { type: 'video/webm' })
        BlobDownloadTool.download(blob, `reverse-video-webcodecs-${Date.now()}.webm`)
        setRunning(false)
    }

    return (
        <div className="flex flex-col space-y-2 p-5 border-2 border-violet-400 rounded-2xl">
            <h2 className="text-violet-400 text-2xl">WebM ファイルを逆再生して保存する</h2>
            <p>WebCodecs を使って、逆からフレームを取り出して再エンコードします。</p>
            <p>コンテナフォーマット（.webm）の読み書きは Kotlin で書いたものを Wasm で呼び出しています。</p>
            <p>コンテナフォーマットが WebM、映像コーデックが VP9、音声コーデックが Opus である必要があります。。</p>

            {
                !isRunning && (<>
                    <input
                        onChange={(ev) => process(ev.target.files?.[0])}
                        className="border-2 border-violet-400 rounded-2xl"
                        type="file"
                        accept="video/webm" />
                    <div>
                        <input
                            type="checkbox"
                            name="software"
                            checked={enableSoftware}
                            onChange={(ev) => setEnableSoftware(ev.currentTarget.checked)} />
                        <label htmlFor="software">ソフトウェアデコーダー・エンコーダーを利用する（途中で止まってしまう場合は試してください）</label>
                    </div>
                </>)
            }

            <p>プレビュー Canvas</p>
            <canvas ref={canvasRef} width={300} height={300} />
        </div>
    )
}