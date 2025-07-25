'use client'

import { useRef, useState } from "react"
import { BlobDownloadTool } from "../tools/BlobDownloadTool"

export default function MediaRecorderCard() {
    const mediaStream = useRef<MediaStream>(null)
    const mediaRecorder = useRef<MediaRecorder>(null)
    const chunks = useRef<Blob[]>([])

    const [isRecording, setRecording] = useState(false)

    async function handleClick() {
        if (isRecording) {
            // 録画を止める
            setRecording(false)
            mediaRecorder.current?.stop()
            mediaStream?.current?.getTracks()?.forEach((track) => track.stop())
            // Blob にして保存
            BlobDownloadTool.download(new Blob([...chunks.current], { type: 'video/webm' }), `javascript-mediarecorder-${Date.now()}.webm`)
            chunks.current = []
        } else {
            try {
                // 画面
                mediaStream.current = await window.navigator.mediaDevices.getDisplayMedia({ video: true, audio: { channelCount: 2 } })
                mediaRecorder.current = new MediaRecorder(mediaStream.current, { mimeType: 'video/webm; codecs="vp9"' })

                // 録画データが細切れになって呼ばれる
                mediaRecorder.current.ondataavailable = (event) => {
                    chunks.current.push(event.data)
                }
                // 録画開始
                mediaRecorder.current.start(100)
                setRecording(true)
            } catch {
                // 画面選択をやめたときなど
            }
        }
    }

    return (
        <div className="flex flex-col space-y-2 p-5 border-2 border-red-400 rounded-2xl">
            <h2 className="text-red-400 text-2xl">MediaRecorder で画面録画する</h2>
            <p>JavaScript の MediaRecorder で画面録画するだけです。</p>
            <p>そのままではシークできないので、下のツールを使ってください。</p>
            <input
                onClick={handleClick}
                className="border-2 border-red-400 rounded-2xl"
                type="button"
                value={isRecording ? '終了' : '画面録画開始'} />
        </div>
    )
}