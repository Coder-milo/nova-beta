'use client'

import { useEffect, useRef, useState } from 'react'
import {
  MicrophoneIcon as Microphone,
  StopIcon as Stop,
  TrashIcon as Trash,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  CircleNotchIcon as CircleNotch,
} from '@phosphor-icons/react'

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
    <div className="flex flex-1 items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs">
      <div className="flex items-center gap-3">
        <span className="flex size-3 animate-ping rounded-full bg-rose-500" />
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
          {formatTime(seconds)}
        </span>
        <span className="text-muted-foreground">
          {recording ? 'Grabando nota de voz...' : 'Audio listo'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {recording ? (
          <button
            type="button"
            onClick={handleStopRecording}
            className="flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 font-bold text-white shadow hover:bg-rose-600"
          >
            <Stop className="size-4" />
            <span>Detener</span>
          </button>
        ) : (
          audioUrl && (
            <audio src={audioUrl} controls className="h-8 w-40" />
          )
        )}

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Descartar"
        >
          <Trash className="size-4" />
        </button>

        {!recording && (
          <button
            type="button"
            onClick={handleSend}
            className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow hover:brightness-110"
            title="Enviar audio"
          >
            <PaperPlaneTilt className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
