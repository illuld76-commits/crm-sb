import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Mic, Square, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AudioRecorderProps {
  onRecorded: (blob: Blob, transcription: string) => void;
}

export default function AudioRecorder({ onRecorded }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const [showApproval, setShowApproval] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        await transcribeAudio(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio_base64: base64, mime_type: blob.type },
      });

      if (error) throw error;

      setTranscription(data.transcription || '');
      setShowApproval(true);
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error('Transcription failed. You can still add the audio with manual notes.');
      setTranscription('');
      setShowApproval(true);
    }
    setTranscribing(false);
  };

  const approveTranscription = () => {
    if (audioBlob) {
      onRecorded(audioBlob, transcription);
      resetState();
      toast.success('Audio note added!');
    }
  };

  const resetState = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscription('');
    setShowApproval(false);
  };

  if (showApproval) {
    return (
      <Card className="p-4 space-y-4 border-primary/30">
        <p className="text-sm font-medium">Review AI Transcription</p>
        {audioUrl && <audio src={audioUrl} controls className="w-full" />}
        <Textarea
          value={transcription}
          onChange={e => setTranscription(e.target.value)}
          placeholder="Edit transcription or add notes manually..."
          rows={4}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={approveTranscription} className="dental-gradient">
            <Check className="w-3 h-3 mr-1" /> Approve & Add
          </Button>
          <Button size="sm" variant="outline" onClick={resetState}>
            <X className="w-3 h-3 mr-1" /> Discard
          </Button>
        </div>
      </Card>
    );
  }

  if (transcribing) {
    return (
      <Card className="p-8 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Transcribing audio with AI...</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-lg border border-dashed border-border">
      {recording ? (
        <>
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
            <div className="w-4 h-4 rounded-full bg-destructive" />
          </div>
          <p className="text-sm text-muted-foreground">Recording...</p>
          <Button variant="destructive" size="sm" onClick={stopRecording}>
            <Square className="w-3 h-3 mr-1" /> Stop Recording
          </Button>
        </>
      ) : (
        <>
          <Button size="lg" variant="outline" onClick={startRecording} className="rounded-full w-16 h-16">
            <Mic className="w-6 h-6" />
          </Button>
          <p className="text-sm text-muted-foreground">Click to record audio notes</p>
          <p className="text-xs text-muted-foreground">AI will transcribe and format into orthodontic terminology</p>
        </>
      )}
    </div>
  );
}
