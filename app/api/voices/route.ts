import { NextResponse } from 'next/server';

const ALLOWED_VOICES = [
  {
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    description: 'Young warm & confident adult female',
  },
  {
    voice_id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    description: 'Velvety British female voice',
  },
  {
    voice_id: 'SAz9YHcvj6GT2YYXdXww',
    name: 'River',
    description: 'Relaxed neutral voice',
  },
  {
    voice_id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica',
    description: 'Young, playful American female voice',
  },
  {
    voice_id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    description: 'Young confident, energetic Australian male voice',
  },
  {
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    description: 'Warm, resonant, captivating voice',
  },
  {
    voice_id: 'N2lVS1w4EtoT3dr4eOWO',
    name: 'Callum',
    description: 'Gravelly and unsettling voice',
  },
  {
    voice_id: 'iP95p4xoKVk53GoZ742B',
    name: 'Chris',
    description: 'Down-to-earth male voice',
  },
  {
    voice_id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    description: 'Middle-aged resonant comforting tone',
  },
  {
    voice_id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    description: 'Strong professional voice',
  },
];

export async function GET() {
  return NextResponse.json({ voices: ALLOWED_VOICES });
}
