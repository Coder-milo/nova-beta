'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle as CircleNotch, Mic as Microphone, Send as PaperPlaneTilt, Square as Stop, Trash2 as Trash } from 'lucide-react'
interface VoiceNoteRecorderProps {
  onSendAudio: (audioBlob: Blob, durationSec: number) => void
  onCancel: () => void
}

export function VoiceNoteRecorder({ onSendAudio, onCancel }: VoiceNoteRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    startRecording()
    return () => {
      stopTimer()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const startTimer = () => {
    stopTimer()
    setSeconds(0)
    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      setRecording(true)
      startTimer()
    } catch (err) {
      console.error('Error al acceder al micrófono:', err)
      onCancel()
    }
  }

  const handleStopRecording = () => {
    stopTimer()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleSend = () => {
    if (audioBlob) {
      onSendAudio(audioBlob, seconds)
    }
  }

  return (
    <div className="flex flex-1 min-w-0 items-center justify-between overflow-hidden rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
        <span className="flex size-2.5 shrink-0 animate-ping rounded-full bg-rose-500" />
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
          {formatTime(seconds)}
        </span>
        <span className="hidden sm:inline truncate text-muted-foreground">
          {recording ? 'Grabando...' : 'Listo'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {recording ? (
          <button
            type="button"
            onClick={handleStopRecording}
            className="flex items-center gap-1 rounded-lg bg-rose-500 px-2.5 py-1 font-bold text-white shadow hover:bg-rose-600 text-xs"
          >
            <Stop className="size-3.5" />
            <span>Detener</span>
          </button>
        ) : (
          audioUrl && (
            <audio src={audioUrl} controls className="h-7 w-28 sm:w-36 max-w-[130px] sm:max-w-[150px]" />
          )
        )}

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
          title="Descartar"
        >
          <Trash className="size-3.5" />
        </button>

        {!recording && (
          <button
            type="button"
            onClick={handleSend}
            className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow hover:brightness-110"
            title="Enviar audio"
          >
            <PaperPlaneTilt className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
